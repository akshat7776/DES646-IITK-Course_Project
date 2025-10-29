import os
import pandas as pd
from typing import Any, Dict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Import your RAG implementation
from rag import RAGbot

# Configuration - adjust paths if needed
ROOT = os.path.dirname(os.path.dirname(__file__))
CSV_PATH = os.path.join(ROOT, "outputs", "clean_csv.csv")
PERSIST_PATH = os.path.join(ROOT, "faiss_index")
NATIVE_PATH = os.path.join(ROOT, "faiss_index_native")
CHUNK_SIZE = 500
K = 5

app = FastAPI(title="RAG Server - keeps FAISS & LLM in memory")

class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    answer: str
    sources: Any
    include_sources: bool

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

@app.get("/health")
def health():
    return {"status": "ok", "ready": RAG is not None}

if __name__ == "__main__":
    # Run the server with a single worker so the index stays in memory
    # When running the script directly, pass the app object instead of the module path
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
