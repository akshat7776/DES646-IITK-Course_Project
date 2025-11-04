RAG (Retrieval-Augmented Generation) — README

Overview
--------
This repository contains a small RAG pipeline that:
- splits product review text into chunks,
- embeds chunks with a HuggingFace sentence-transformer,
- stores embeddings in a FAISS index,
- answers user queries using retrieved chunks + Gemini (Google Generative AI) LLM.

Two fast usage modes are available:
- Native FAISS index (recommended for fast single-run loads): precompute a native `index_native.faiss` and `metadata.json` with `src/precompute_native.py`.
- Long-lived server mode (recommended for repeated queries): run `src/fastapi_serve.py` which loads the index once and serves queries via a REST API.

Files of interest
-----------------
- `src/rag.py` - Main RAG engine (class `RAGbot`). Supports loading LangChain FAISS indexes or a native FAISS binary index.
- `src/precompute_native.py` - Script to build a native FAISS index (`faiss.write_index`) and aligned `metadata.json` (faster subsequent loads).
- `src/fastapi_serve.py` - FastAPI server that loads the index and answers queries (keeps index and LLM in memory).
- `scripts/test_rag.py` - Small Python client (uses `requests`) to exercise `/health` and `/query` endpoints.
- `faiss_index/` - (optional) LangChain FAISS index saved by `RAGbot.save_local()`.
- `faiss_index_native/` - (optional) Native FAISS index directory produced by `export_native_index` (`index_native.faiss`, `metadata.json`).

Prerequisites
-------------
- Python 3.8+ (this repo used 3.10+ in development). Confirm your Python version.
- pip packages (install into a venv):
  - requests
  - fastapi
  - uvicorn
  - pandas
  - numpy
  - python-dotenv
  - langchain-* packages used by this project (see `requirements.txt` if present) or install the following minimally:
    - langchain-huggingface (or the package you were using for HuggingFaceEmbeddings)
    - langchain-community (FAISS wrapper) or `faiss` directly
  - faiss (fast startup path requires `faiss-cpu` or `faiss-gpu`)

Example install (basic):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install pandas numpy requests fastapi uvicorn python-dotenv
pip install faiss-cpu        # or faiss-gpu if you have GPU support
# install your LangChain / embeddings packages used in the project
```

Configuration
-------------
- GEMINI API key: the LLM initialization expects an environment variable `GEMINI_API_KEY` set so the `ChatGoogleGenerativeAI` client can be created. Set it in your shell or in a `.env` file at repo root.

Quick workflows
---------------
1) Fast single-run (recommended after precomputing native index)
   - Build native index once (this computes embeddings for all chunks and writes a fast faiss binary + metadata):
     ```powershell
     python .\src\precompute_native.py
     ```
     By default this writes to `D:\DES646-Project\faiss_index_native` (edit the script paths if your repo is elsewhere).

   - Run the main script (loads native index if present):
     ```powershell
     python .\src\rag.py
     ```
     This will detect `faiss_index_native/` and load the native FAISS index quickly, then answer the sample query in `__main__`.

2) Long-lived server mode (best for repeated queries)
   - Start the server (loads index once and keeps it in memory):
     ```powershell
  python .\src\fastapi_serve.py
     # or use uvicorn from repo root
  uvicorn src.fastapi_serve:app --host 127.0.0.1 --port 8000
     ```
   - Call the server from another terminal:
     ```powershell
     # Use PowerShell's Invoke-RestMethod
     Invoke-RestMethod -Uri "http://127.0.0.1:8000/query" -Method POST -ContentType "application/json" -Body '{"query":"Which item fits worst?"}'
     ```
   - Or use the included Python client:
     ```powershell
     python .\scripts\test_rag.py --query "Which item fits worst?" --count 1
     ```

Notes on performance and consistency
-----------------------------------
- Embedding model must match between export and query time. If you export the native index using `sentence-transformers/all-MiniLM-L6-v2`, be sure the runtime uses the same model; `RAGbot` currently uses that model by default.
- Native FAISS directory naming: the code expects `<persist_path>_native` (for example if `persist_path` is `faiss_index` then native dir is `faiss_index_native`). `precompute_native.py` writes to `faiss_index_native` by default.
- Native FAISS load uses `faiss.read_index()` and `metadata.json` — loading this is typically seconds instead of minutes.
- If you change data or want to rebuild the index, run `precompute_native.py` again (or delete the native dir and re-run `RAGbot` with `force_rebuild=True`).

Troubleshooting
---------------
- "7-minute startup": this is usually the cost of deserializing a large FAISS index or computing embeddings. Use the native index path or keep the server running to avoid repeated loads.
- Missing `GEMINI_API_KEY`: you will get an error when `RAGbot` attempts to initialize the LLM. Set the environment variable and restart.
- `ModuleNotFoundError: No module named 'src'` when running `uvicorn src.fastapi_serve:app`: either run `uvicorn` from repo root, or run `python src/fastapi_serve.py` which calls `uvicorn.run(app, ...)` directly.

Advanced options
----------------
- Use a GPU-backed faiss and embeddings model for faster indexing and retrieval.
- Use approximate FAISS indexes (HNSW, IVF) to trade small accuracy loss for large speedups on queries.
- Run `RAGbot` behind a queue if you expect many concurrent requests to the LLM; this avoids overloading the LLM client.

If you want, I can:
- Add a small README section in the project's root `README.md` instead of this file.
- Make `precompute_native.py` configurable via CLI arguments.
- Add request timing metrics to `fastapi_serve.py` and expose a metrics endpoint.

