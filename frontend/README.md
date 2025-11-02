# Feedback Analyzer Frontend

This Next.js app now connects to the Python FastAPI RAG backend exposed by `src/serve_rag.py`.

## RAG integration

- The AI Insights page (`/ai-insights`) calls the backend `POST /query` endpoint to answer questions about your reviews using the FAISS index.
- Answers may include a "Sources" section when the backend decides they are helpful.

## Configure API base URL

Set the backend URL with an environment variable (optional):

```
NEXT_PUBLIC_RAG_API_BASE=http://127.0.0.1:8000
```

If not set, the app defaults to `http://127.0.0.1:8000`.

## Run

1. Start the FastAPI server (from repo root):
	- Ensure the CSV and FAISS index exist as configured in `src/serve_rag.py`.
	- Run the server and wait for "RAG server ready".
2. Start the Next.js dev server (this folder):
	- Install deps and run `pnpm dev`/`npm run dev`.
3. Open `http://localhost:9002/ai-insights` and ask a question.
