import os
import pandas as pd
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from rag import RAGbot
from orchestrator import analyze_text 
from reply import ReplyGenerator
from sentiment import vader_sentiment_score, vader_sentiment_label
try:
    from emotions import cluster_emotions  # optional; heavy on first run
    _HAS_EMOTIONS = True
except Exception:
    _HAS_EMOTIONS = False

# Configuration - adjust paths if needed
ROOT = os.path.dirname(os.path.dirname(__file__))
CSV_PATH = os.path.join(ROOT, "outputs", "clean_csv.csv")
PERSIST_PATH = os.path.join(ROOT, "faiss_index")
NATIVE_PATH = os.path.join(ROOT, "faiss_index_native")
CHUNK_SIZE = 500
K = 3

# Cache locations for precomputed dashboard data
REVIEWS_JSONL = os.path.join(ROOT, "outputs", "dashboard_reviews.jsonl")
SUMMARY_JSON = os.path.join(ROOT, "outputs", "dashboard_summary.json")

app = FastAPI(title="Feedback Analyzer FastAPI Server")

# CORS (dev-friendly)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str


class QueryResponse(BaseModel):
    answer: str
    sources: Any
    include_sources: bool


class ReviewIn(BaseModel):
    text: str
    rating: Optional[float] = None
    author: Optional[str] = None


class ProductIn(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None


class AnalyzeRequest(BaseModel):
    reviews: List[ReviewIn]
    product: Optional[ProductIn] = None


class ReviewOut(BaseModel):
    review: str
    sentiment: str
    emotion: str
    intent: str
    nps: float
    buy_again: str
    reply: Optional[str] = None


class AnalyzeResponse(BaseModel):
    reviews: List[ReviewOut]
    average_rating: Optional[float] = None
    average_nps: Optional[float] = None
    dominant_sentiment: str
    summary: str


RAG: RAGbot | None = None
REPLY: ReplyGenerator | None = None
DF: pd.DataFrame | None = None
DFP: pd.DataFrame | None = None  # precomputed reviews: text, rating, department, sentiment, emotion


@app.on_event("startup")
def startup_event():
    global RAG, REPLY, DF, DFP
    if not os.path.exists(CSV_PATH):
        raise RuntimeError(f"CSV file not found at {CSV_PATH}")

    df = pd.read_csv(CSV_PATH)
    DF = df

    # Load or (re)build precomputed dashboard cache
    def _mtime(path: str) -> float:
        try:
            return os.path.getmtime(path)
        except Exception:
            return 0.0

    def _load_reviews_cache() -> pd.DataFrame | None:
        try:
            if os.path.exists(REVIEWS_JSONL):
                return pd.read_json(REVIEWS_JSONL, lines=True)
        except Exception as e:
            print(f"Failed to load {REVIEWS_JSONL}: {e}")
        return None

    def _compute_and_store_cache() -> pd.DataFrame:
        print("[cache] Computing dashboard reviews (sentiment/emotion) once...")
        cols = [c for c in ["Review Text", "Rating", "Department Name"] if c in df.columns]
        d = df[cols].copy().reset_index(drop=True)
        d["Rating"] = pd.to_numeric(d["Rating"], errors="coerce").fillna(0).astype(float)
        d.loc[:, "Review Text"] = d["Review Text"].fillna("")
        d.loc[:, "Department Name"] = d["Department Name"].fillna("Unknown")

        s_scores = d["Review Text"].astype(str).apply(vader_sentiment_score)
        s_labels = s_scores.apply(vader_sentiment_label)
        if _HAS_EMOTIONS and len(d):
            try:
                emos = cluster_emotions(d["Review Text"].astype(str).tolist())
            except Exception:
                emos = ["neutral"] * len(d)
        else:
            emos = ["neutral"] * len(d)

        dfp = pd.DataFrame({
            "text": d["Review Text"].astype(str),
            "rating": d["Rating"].astype(float),
            "department": d["Department Name"].astype(str),
            "sentiment": s_labels.astype(str),
            "emotion": emos,
        })

        os.makedirs(os.path.dirname(REVIEWS_JSONL), exist_ok=True)
        try:
            import json as _json
            with open(REVIEWS_JSONL, "w", encoding="utf-8") as f:
                for rec in dfp.to_dict(orient="records"):
                    f.write(_json.dumps(rec, ensure_ascii=False) + "\n")
        except Exception as e:
            print(f"Warning: failed to write {REVIEWS_JSONL}: {e}")

        try:
            total_reviews = int(len(dfp))
            avg_rating = float(dfp["rating"].mean()) if total_reviews else 0.0
            promoters = int((dfp["rating"] >= 4).sum())
            detractors = int((dfp["rating"] <= 2).sum())
            nps = ((promoters - detractors) / total_reviews) * 100 if total_reviews else 0.0
            positive_pct = float((dfp["sentiment"] == "positive").sum()) / total_reviews * 100 if total_reviews else 0.0
            dept_avg = (
                dfp.groupby("department")["rating"].mean().reset_index().rename(columns={"department": "department", "rating": "averageRating"})
                if total_reviews else pd.DataFrame(columns=["department", "averageRating"])
            )
            department_ratings = [
                {"department": str(r["department"]), "averageRating": float(r["averageRating"])}
                for _, r in dept_avg.iterrows()
            ]
            import json as _json
            with open(SUMMARY_JSON, "w", encoding="utf-8") as f:
                _json.dump({
                    "total_reviews": total_reviews,
                    "average_rating": avg_rating,
                    "nps": nps,
                    "positive_sentiment_pct": positive_pct,
                    "department_ratings": department_ratings,
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Warning: failed to write {SUMMARY_JSON}: {e}")

        return dfp

    use_cache = os.path.exists(REVIEWS_JSONL) and (_mtime(REVIEWS_JSONL) >= _mtime(CSV_PATH))
    DFP = _load_reviews_cache() if use_cache else _compute_and_store_cache()

    print("Starting RAG server - initializing RAGbot (once on startup)")
    RAG = RAGbot(df, k=K, persist_path=PERSIST_PATH, chunk_size=CHUNK_SIZE, force_rebuild=False)
    print("RAG server ready: index loaded and models initialized")

    try:
        REPLY = ReplyGenerator()
        print("ReplyGenerator ready")
    except Exception as e:
        REPLY = None
        print(f"ReplyGenerator init failed: {e}")


def _compute_dashboard_from_df(df: pd.DataFrame, max_reviews: int = 1000, department: Optional[str] = None) -> Dict[str, Any]:
    cols = [c for c in ["Review Text", "Rating", "Department Name"] if c in df.columns]
    base = df[cols]
    if department and "Department Name" in base.columns:
        mask = base["Department Name"].astype(str) == str(department)
        d = base.loc[mask].copy().reset_index(drop=True)
    else:
        d = base.copy().reset_index(drop=True)
    d["Rating"] = pd.to_numeric(d["Rating"], errors="coerce").fillna(0).astype(float)
    d.loc[:, "Review Text"] = d["Review Text"].fillna("")

    total_reviews = int(len(d))
    average_rating = float(d["Rating"].mean()) if total_reviews else 0.0

    promoters = int((d["Rating"] >= 4).sum())
    detractors = int((d["Rating"] <= 2).sum())
    nps = ((promoters - detractors) / total_reviews) * 100 if total_reviews else 0.0

    # Aggregated signals from precomputed DFP for accuracy
    global DFP
    sentiment_counts: Dict[str, int] = {"positive": 0, "neutral": 0, "negative": 0}
    emotion_counts_list: List[Dict[str, Any]] = []
    if DFP is not None:
        dfp = DFP
        if department:
            dfp = dfp[dfp["department"].astype(str) == str(department)]
        # Sentiment counts
        try:
            vc = dfp["sentiment"].value_counts()
            for k in ["positive", "neutral", "negative"]:
                sentiment_counts[k] = int(vc.get(k, 0))
        except Exception:
            pass
        # Emotion counts (top 10)
        try:
            evc = dfp["emotion"].value_counts().head(10)
            emotion_counts_list = [{"emotion": str(idx), "count": int(val)} for idx, val in evc.items()]
        except Exception:
            emotion_counts_list = []
        # Exact NPS from precomputed ratings for the (sub)set
        try:
            total_prec = int(len(dfp))
            if total_prec:
                prom = int((dfp["rating"] >= 4).sum())
                det = int((dfp["rating"] <= 2).sum())
                nps = ((prom - det) / total_prec) * 100.0
                # Override average rating with precise per-filter value for consistency
                average_rating = float(dfp["rating"].mean())
        except Exception:
            pass
    # positive percentage uses aggregated counts if available
    total_for_pct = sum(sentiment_counts.values())
    if total_for_pct > 0:
        positive_pct = (sentiment_counts["positive"] / total_for_pct) * 100.0
    else:
        positive_pct = 0.0

    dept_avg = (
        d.groupby("Department Name")["Rating"].mean().reset_index().rename(columns={"Department Name": "department", "Rating": "averageRating"})
        if "Department Name" in d.columns and total_reviews else pd.DataFrame(columns=["department", "averageRating"]) 
    )
    department_ratings = [
        {"department": str(row["department"]), "averageRating": float(row["averageRating"]) }
        for _, row in dept_avg.iterrows()
    ]

    max_reviews = int(max(0, max_reviews)) or 0
    return_count = min(total_reviews, max_reviews if max_reviews > 0 else min(total_reviews, 1000))
    sample_indices: List[int] = []
    if total_reviews and return_count:
        import numpy as _np
        sample_indices = list(_np.linspace(0, total_reviews - 1, num=return_count, dtype=int))

    reviews: list[dict[str, Any]] = []
    if sample_indices:
        # Compute signals for sampled reviews only (keep payload light)
        texts = [str(d.iloc[idx].get("Review Text", "")) for idx in sample_indices]
        try:
            s_scores_sample = pd.Series(texts).apply(vader_sentiment_score)
            s_labels_sample = s_scores_sample.apply(vader_sentiment_label)
        except Exception:
            s_labels_sample = pd.Series(["neutral"] * len(texts))
        if _HAS_EMOTIONS and len(texts):
            try:
                emos_sample = cluster_emotions(texts)
            except Exception:
                emos_sample = ["neutral"] * len(texts)
        else:
            emos_sample = ["neutral"] * len(texts)

        for pos, idx in enumerate(sample_indices):
            try:
                row = d.iloc[idx]
                review_text = str(row.get("Review Text", ""))
                rating_val = float(row.get("Rating", 0.0))
                dept_val = str(row.get("Department Name", "Unknown"))
            except Exception:
                review_text = ""
                rating_val = 0.0
                dept_val = "Unknown"
            sent = str(s_labels_sample.iloc[pos]) if len(texts) else "neutral"
            emo = emos_sample[pos] if pos < len(emos_sample) else "neutral"

            reviews.append({
                "text": review_text,
                "rating": rating_val,
                "department": dept_val,
                "sentiment": sent,
                "emotion": emo,
            })

    return {
        "total_reviews": total_reviews,
        "average_rating": average_rating,
        "nps": nps,
        "positive_sentiment_pct": positive_pct,
        "department_ratings": department_ratings,
        "reviews": reviews,
        "sample_size": len(reviews),
        "sentiment_counts": sentiment_counts,
        "emotion_counts": emotion_counts_list,
    }


@app.get("/dashboard_data")
def dashboard_data(max_items: int = Query(1000, ge=0, le=10000), department: Optional[str] = Query(None)):
    global DF
    if DF is None:
        raise HTTPException(status_code=503, detail="Dataframe not loaded")
    try:
        data = _compute_dashboard_from_df(DF, max_reviews=int(max_items), department=department)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"dashboard_data failed: {e}")


@app.post("/refresh_dashboard")
def refresh_dashboard():
    """Force recomputation of dashboard cache from the CSV.

    This runs once and overwrites outputs/dashboard_reviews.jsonl and dashboard_summary.json.
    """
    global DF, DFP
    if DF is None:
        raise HTTPException(status_code=503, detail="Dataframe not loaded")
    # Reuse the startup helper by inlining minimal logic
    try:
        # Recompute using current DF and write cache
        cols = [c for c in ["Review Text", "Rating", "Department Name"] if c in DF.columns]
        d = DF[cols].copy().reset_index(drop=True)
        d["Rating"] = pd.to_numeric(d["Rating"], errors="coerce").fillna(0).astype(float)
        d.loc[:, "Review Text"] = d["Review Text"].fillna("")
        d.loc[:, "Department Name"] = d["Department Name"].fillna("Unknown")

        s_scores = d["Review Text"].astype(str).apply(vader_sentiment_score)
        s_labels = s_scores.apply(vader_sentiment_label)
        if _HAS_EMOTIONS and len(d):
            try:
                emos = cluster_emotions(d["Review Text"].astype(str).tolist())
            except Exception:
                emos = ["neutral"] * len(d)
        else:
            emos = ["neutral"] * len(d)

        DFP = pd.DataFrame({
            "text": d["Review Text"].astype(str),
            "rating": d["Rating"].astype(float),
            "department": d["Department Name"].astype(str),
            "sentiment": s_labels.astype(str),
            "emotion": emos,
        })

        import json as _json
        os.makedirs(os.path.dirname(REVIEWS_JSONL), exist_ok=True)
        with open(REVIEWS_JSONL, "w", encoding="utf-8") as f:
            for rec in DFP.to_dict(orient="records"):
                f.write(_json.dumps(rec, ensure_ascii=False) + "\n")

        total_reviews = int(len(DFP))
        avg_rating = float(DFP["rating"].mean()) if total_reviews else 0.0
        promoters = int((DFP["rating"] >= 4).sum())
        detractors = int((DFP["rating"] <= 2).sum())
        nps = ((promoters - detractors) / total_reviews) * 100 if total_reviews else 0.0
        positive_pct = float((DFP["sentiment"] == "positive").sum()) / total_reviews * 100 if total_reviews else 0.0
        dept_avg = (
            DFP.groupby("department")["rating"].mean().reset_index().rename(columns={"department": "department", "rating": "averageRating"})
            if total_reviews else pd.DataFrame(columns=["department", "averageRating"])
        )
        department_ratings = [
            {"department": str(r["department"]), "averageRating": float(r["averageRating"])}
            for _, r in dept_avg.iterrows()
        ]

        with open(SUMMARY_JSON, "w", encoding="utf-8") as f:
            _json.dump({
                "total_reviews": total_reviews,
                "average_rating": avg_rating,
                "nps": nps,
                "positive_sentiment_pct": positive_pct,
                "department_ratings": department_ratings,
            }, f, ensure_ascii=False, indent=2)

        return {"ok": True, "total_reviews": total_reviews}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"refresh_dashboard failed: {e}")


@app.post("/query", response_model=QueryResponse)
def query_endpoint(req: QueryRequest):
    global RAG
    if RAG is None:
        raise HTTPException(status_code=503, detail="RAG not ready")
    result = RAG.answer(req.query)
    return QueryResponse(answer=result.get("answer", ""), sources=result.get("sources"), include_sources=result.get("include_sources", False))


@app.post("/analyze_reviews", response_model=AnalyzeResponse)
def analyze_reviews_endpoint(req: AnalyzeRequest):
    if not req.reviews:
        raise HTTPException(status_code=400, detail="reviews list is empty")

    items: List[ReviewOut] = []
    sentiments: List[str] = []
    nps_values: List[float] = []

    for r in req.reviews:
        txt = (r.text or "").strip()
        if not txt:
            continue
        try:
            res = analyze_text(txt)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"orchestrator error: {e}")

        sent = res.signals.sentiment_label
        emo = res.signals.emotion
        intent = res.signals.intent
        nps = float(res.prediction.nps_score)
        buy = "Yes" if res.prediction.repeat_purchase else "No"

        def _templated_reply(text: str, sentiment: str, emotion: str, intent: str) -> str:
            base = "Thanks for your feedback."
            if intent == "size_issue":
                base = "Thanks for sharing your sizing experience."
            elif intent in ("quality_concern", "complaint"):
                base = "Sorry about your experience."
            elif intent == "praise":
                base = "Thanks for the kind words!"
            tail = " We'll share this with our team. If you need help, please reach us via support."
            return f"{base} ({sentiment}, {emotion}).{tail}"

        reply_text: Optional[str] = None
        try:
            if REPLY is not None:
                reply_text = REPLY.generate_reply(txt)
        except Exception:
            reply_text = None
        if not reply_text:
            reply_text = _templated_reply(txt, sent, emo, intent)

        items.append(ReviewOut(
            review=txt,
            sentiment=sent,
            emotion=emo,
            intent=intent,
            nps=nps,
            buy_again=buy,
            reply=reply_text,
        ))
        sentiments.append(sent)
        nps_values.append(nps)

    if not items:
        raise HTTPException(status_code=400, detail="no valid reviews after filtering")

    avg_nps = float(sum(nps_values) / max(len(nps_values), 1)) if nps_values else None
    ratings = [float(r.rating) for r in req.reviews if r.rating is not None]
    avg_rating = float(sum(ratings) / len(ratings)) if ratings else None
    dom_sent = max(set(sentiments), key=sentiments.count) if sentiments else "neutral"

    top_intents: Dict[str, int] = {}
    for it in [it.intent for it in items]:
        top_intents[it] = top_intents.get(it, 0) + 1
    top_intent = max(top_intents.items(), key=lambda kv: kv[1])[0] if top_intents else "other"
    if avg_rating is not None:
        summary = (
            f"Analyzed {len(items)} reviews. Dominant sentiment is '{dom_sent}'. "
            f"Most common intent appears to be '{top_intent}'. Average rating is {avg_rating:.1f}."
        )
    else:
        summary = (
            f"Analyzed {len(items)} reviews. Dominant sentiment is '{dom_sent}'. "
            f"Most common intent appears to be '{top_intent}'."
        )

    return AnalyzeResponse(
        reviews=items,
        average_rating=avg_rating,
        average_nps=avg_nps,
        dominant_sentiment=dom_sent,
        summary=summary,
    )


class SingleAnalyzeRequest(BaseModel):
    text: str
    rating: Optional[float] = None
    author: Optional[str] = None
    product: Optional[ProductIn] = None


@app.post("/analyze_review", response_model=ReviewOut)
def analyze_review_endpoint(req: SingleAnalyzeRequest):
    txt = (req.text or "").strip()
    if not txt:
        raise HTTPException(status_code=400, detail="text is empty")
    try:
        res = analyze_text(txt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"orchestrator error: {e}")

    sent = res.signals.sentiment_label
    emo = res.signals.emotion
    intent = res.signals.intent
    nps = float(res.prediction.nps_score)
    buy = "Yes" if res.prediction.repeat_purchase else "No"

    def _templated_reply(text: str, sentiment: str, emotion: str, intent: str) -> str:
        base = "Thanks for your feedback."
        if intent == "size_issue":
            base = "Thanks for sharing your sizing experience."
        elif intent in ("quality_concern", "complaint"):
            base = "Sorry about your experience."
        elif intent == "praise":
            base = "Thanks for the kind words!"
        tail = " We'll share this with our team. If you need help, please reach us via support."
        return f"{base} ({sentiment}, {emotion}).{tail}"

    reply_text: Optional[str] = None
    try:
        if REPLY is not None:
            reply_text = REPLY.generate_reply(txt)
    except Exception:
        reply_text = None
    if not reply_text:
        reply_text = _templated_reply(txt, sent, emo, intent)

    return ReviewOut(
        review=txt,
        sentiment=sent,
        emotion=emo,
        intent=intent,
        nps=nps,
        buy_again=buy,
        reply=reply_text,
    )


@app.get("/health")
def health():
    return {"status": "ok", "ready": RAG is not None}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
