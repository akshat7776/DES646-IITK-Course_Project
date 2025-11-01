import os
import pandas as pd
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import your RAG implementation
from rag import RAGbot
from orchestrator import analyze_text  # single-feedback analyzer (sentiment/emotion/intent + Gemini)

# Configuration - adjust paths if needed
ROOT = os.path.dirname(os.path.dirname(__file__))
CSV_PATH = os.path.join(ROOT, "outputs", "clean_csv.csv")
PERSIST_PATH = os.path.join(ROOT, "faiss_index")
NATIVE_PATH = os.path.join(ROOT, "faiss_index_native")
CHUNK_SIZE = 500
K = 5

app = FastAPI(title="RAG Server - keeps FAISS & LLM in memory")

# CORS for extension & local site (dev-friendly: allow all)
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


# ----- Reviews analyze endpoint models ---------------------------------------
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


class AnalyzeResponse(BaseModel):
    reviews: List[ReviewOut]
    average_nps: float
    dominant_sentiment: str
    summary: str

# Global RAG instance
RAG: RAGbot | None = None

@app.on_event("startup")
def startup_event():
    global RAG
    # Load dataframe once (if you have a different location, change CSV_PATH)
    if not os.path.exists(CSV_PATH):
        raise RuntimeError(f"CSV file not found at {CSV_PATH}")

    df = pd.read_csv(CSV_PATH)

    # Initialize RAGbot: prefer native index if present
    print("Starting RAG server - initializing RAGbot (this happens once on startup)")
    RAG = RAGbot(df, k=K, persist_path=PERSIST_PATH, chunk_size=CHUNK_SIZE, force_rebuild=False)
    print("RAG server ready: index loaded and models initialized")

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
            # If orchestrator fails entirely, return a basic error mapping for that review
            raise HTTPException(status_code=500, detail=f"orchestrator error: {e}")

        sent = res.signals.sentiment_label
        emo = res.signals.emotion
        intent = res.signals.intent
        nps = float(res.prediction.nps_score)
        buy = "Yes" if res.prediction.repeat_purchase else "No"

        items.append(ReviewOut(
            review=txt,
            sentiment=sent,
            emotion=emo,
            intent=intent,
            nps=nps,
            buy_again=buy,
        ))
        sentiments.append(sent)
        nps_values.append(nps)

    if not items:
        raise HTTPException(status_code=400, detail="no valid reviews after filtering")

    # Aggregates
    avg_nps = float(sum(nps_values) / max(len(nps_values), 1))
    # Dominant sentiment by frequency
    dom_sent = max(set(sentiments), key=sentiments.count) if sentiments else "neutral"

    # Simple heuristic summary
    # You can replace with a call to a summarizer if desired.
    top_intents = {}
    for it in [it.intent for it in items]:
        top_intents[it] = top_intents.get(it, 0) + 1
    top_intent = max(top_intents.items(), key=lambda kv: kv[1])[0] if top_intents else "other"
    summary = (
        f"Analyzed {len(items)} reviews. Dominant sentiment is '{dom_sent}'. "
        f"Most common intent appears to be '{top_intent}'. Average NPS is {avg_nps:.1f}."
    )

    return AnalyzeResponse(
        reviews=items,
        average_nps=avg_nps,
        dominant_sentiment=dom_sent,
        summary=summary,
    )

@app.get("/health")
def health():
    return {"status": "ok", "ready": RAG is not None}

if __name__ == "__main__":
    # Run the server with a single worker so the index stays in memory
    # When running the script directly, pass the app object instead of the module path
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
