"""
Precompute dashboard signals from outputs/clean_csv.csv and save cache files.

Writes:
- outputs/dashboard_reviews.jsonl  (one JSON per line with: text, rating, department, sentiment, emotion)
- outputs/dashboard_summary.json    (aggregated totals and per-department averages)

Run:
  python src/precompute_dashboard.py
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, List

import pandas as pd

from sentiment import vader_sentiment_score, vader_sentiment_label

try:
    from emotions import cluster_emotions
    _HAS_EMOTIONS = True
except Exception:
    _HAS_EMOTIONS = False


ROOT = os.path.dirname(os.path.dirname(__file__))
CSV_PATH = os.path.join(ROOT, "outputs", "clean_csv.csv")
REVIEWS_JSONL = os.path.join(ROOT, "outputs", "dashboard_reviews.jsonl")
SUMMARY_JSON = os.path.join(ROOT, "outputs", "dashboard_summary.json")


def _load_df() -> pd.DataFrame:
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(f"CSV file not found: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    # Normalize columns we need
    need = [c for c in ["Review Text", "Rating", "Department Name"] if c in df.columns]
    d = df[need].copy().reset_index(drop=True)
    # Ensure required columns exist even if missing in CSV
    if "Review Text" not in d.columns:
        d["Review Text"] = ""
    if "Rating" not in d.columns:
        d["Rating"] = 0
    if "Department Name" not in d.columns:
        d["Department Name"] = "Unknown"

    d["Rating"] = pd.to_numeric(d["Rating"], errors="coerce").fillna(0).astype(float)
    # Avoid chained-assignment warnings: assign the filled series back
    d.loc[:, "Review Text"] = d["Review Text"].fillna("")
    d.loc[:, "Department Name"] = d["Department Name"].fillna("Unknown")
    return d


def _compute_signals(d: pd.DataFrame) -> pd.DataFrame:
    # Sentiment via VADER
    s_scores = d["Review Text"].astype(str).apply(vader_sentiment_score)
    s_labels = s_scores.apply(vader_sentiment_label)

    # Emotions (optional)
    if _HAS_EMOTIONS:
        try:
            emos: List[str] = cluster_emotions(d["Review Text"].astype(str).tolist())
        except Exception:
            emos = ["neutral"] * len(d)
    else:
        emos = ["neutral"] * len(d)

    out = pd.DataFrame(
        {
            "text": d["Review Text"].astype(str),
            "rating": d["Rating"].astype(float),
            "department": d["Department Name"].astype(str),
            "sentiment": s_labels.astype(str),
            "emotion": emos,
        }
    )
    return out


def _write_reviews_jsonl(dfp: pd.DataFrame) -> None:
    with open(REVIEWS_JSONL, "w", encoding="utf-8") as f:
        for rec in dfp.to_dict(orient="records"):
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def _write_summary(dfp: pd.DataFrame) -> None:
    total_reviews = int(len(dfp))
    avg_rating = float(dfp["rating"].mean()) if total_reviews else 0.0
    promoters = int((dfp["rating"] >= 4).sum())
    detractors = int((dfp["rating"] <= 2).sum())
    nps = ((promoters - detractors) / total_reviews) * 100 if total_reviews else 0.0
    positive_pct = float((dfp["sentiment"] == "positive").sum()) / total_reviews * 100 if total_reviews else 0.0

    dept_avg = (
        dfp.groupby("department")["rating"].mean().reset_index().rename(columns={"department": "department", "rating": "averageRating"})
        if total_reviews
        else pd.DataFrame(columns=["department", "averageRating"])
    )
    department_ratings = [
        {"department": str(r["department"]), "averageRating": float(r["averageRating"])}
        for _, r in dept_avg.iterrows()
    ]

    summary: Dict[str, Any] = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "source_csv": os.path.relpath(CSV_PATH, ROOT),
        "total_reviews": total_reviews,
        "average_rating": avg_rating,
        "nps": nps,
        "positive_sentiment_pct": positive_pct,
        "department_ratings": department_ratings,
    }

    with open(SUMMARY_JSON, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)


def main() -> int:
    d = _load_df()
    dfp = _compute_signals(d)
    os.makedirs(os.path.dirname(REVIEWS_JSONL), exist_ok=True)
    _write_reviews_jsonl(dfp)
    _write_summary(dfp)
    print(f"Wrote {REVIEWS_JSONL} and {SUMMARY_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
