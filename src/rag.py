import pandas as pd
import os
from typing import List, Dict, Any, Optional, TypedDict

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
load_dotenv()
import time
import json
import numpy as np
try:
    import faiss
    _HAS_FAISS = True
except Exception:
    faiss = None
    _HAS_FAISS = False

# LangGraph for decision routing
try:
    from langgraph.graph import StateGraph, START, END
    _HAS_LANGGRAPH = True
except Exception:
    _HAS_LANGGRAPH = False

class RAGbot:
    def __init__(self, df: pd.DataFrame, review_col: Optional[str] = None, k: int = 5, persist_path: Optional[str] = "faiss_index", chunk_size: int = 500, force_rebuild: bool = False):

        self.df = df
        self.review_col = review_col or self._detect_review_column()
        self.k = k
        self.persist_path = persist_path
        self.chunk_size = chunk_size

        # lazy-heavy objects (created on demand)
        self._embeddings = None
        self.vectorstore = None
        self.llm = None
        self.chunks: Optional[List[Document]] = None
        self.retriever = None

        # If a persisted FAISS index exists and the user did not request a rebuild
        self.native_dir = f"{self.persist_path}_native" if self.persist_path else None
        if self.native_dir and os.path.exists(self.native_dir) and not force_rebuild and _HAS_FAISS:
            print(f"Found persisted NATIVE FAISS index at {self.native_dir}, loading (very fast)...")
            t0 = time.perf_counter()
            self._load_native_index(self.native_dir)
            print(f"Loaded NATIVE FAISS index in {time.perf_counter() - t0:.2f}s")
        elif self.persist_path and os.path.exists(self.persist_path) and not force_rebuild:
            print(f"Found persisted FAISS index at {self.persist_path}, loading (fast)...")
            t0 = time.perf_counter()
            # create_vectorstore will detect the persisted index and load it.
            self.vectorstore = self._create_vectorstore()
            print(f"Loaded FAISS index in {time.perf_counter() - t0:.2f}s")
        else:
            # build chunks and vectorstore 
            print("No persisted index found or rebuild requested — creating chunks and building FAISS (this can take several minutes)")
            t1 = time.perf_counter()
            self.chunks = self._create_chunks()
            print(f"Created {len(self.chunks)} chunks in {time.perf_counter() - t1:.2f}s")
            t2 = time.perf_counter()
            self.vectorstore = self._create_vectorstore()
            print(f"Built FAISS vectorstore in {time.perf_counter() - t2:.2f}s")

        # Create retriever now that vectorstore is available
        if self.vectorstore is not None:
            self.retriever = self.vectorstore.as_retriever(search_kwargs={"k": self.k})

    def _detect_review_column(self) -> str:
        # Sample-based detection to avoid scanning huge DataFrames fully.
        obj_cols = [c for c in self.df.columns if self.df[c].dtype == object]
        if not obj_cols:
            raise ValueError("No suitable review text column found.")

        sample_n = min(200, max(10, len(self.df)))
        try:
            sample = self.df[obj_cols].sample(n=sample_n, random_state=1)
        except Exception:
            sample = self.df[obj_cols].head(sample_n)

        for col in obj_cols:
            col_series = sample[col].dropna().astype(str)
            if col_series.empty:
                continue
            avg_len = col_series.str.len().mean()
            if avg_len > 20:
                return col

        # fallback to first object column
        return obj_cols[0]

    def _create_chunks(self) -> List[Document]:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=int(self.chunk_size * 0.1),
            separators=["\n\n", "\n", " ", ""]
        )
        documents: List[Document] = []
        # Avoid repeated to_dict() calls inside inner loop; do it once per row.
        for idx, row in self.df.iterrows():
            raw = row.get(self.review_col) if isinstance(row, dict) else row[self.review_col]
            text = str(raw) if raw is not None and str(raw) != 'nan' else ""
            if not text.strip():
                continue
            splits = text_splitter.split_text(text)
            row_meta = row.to_dict()
            for i, chunk in enumerate(splits):
                metadata = dict(row_meta)
                metadata.update({"chunk_index": i})
                documents.append(Document(page_content=chunk, metadata=metadata))
        return documents

    def _create_vectorstore(self) -> FAISS:
        # reuse embeddings instance to avoid repeated model loads
        if self._embeddings is None:
            self._embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

        # If persisted index exists, try to load it (fast). Otherwise build and save.
        if self.persist_path and os.path.exists(self.persist_path):
            try:
                vs = FAISS.load_local(self.persist_path, self._embeddings)
                return vs
            except Exception:
                # fall through to rebuild
                pass

        # If chunks haven't been created yet (e.g. user loaded a persisted index earlier),
        # create them on-demand before building the index.
        if self.chunks is None:
            self.chunks = self._create_chunks()
        vs = FAISS.from_documents(self.chunks, self._embeddings)
        if self.persist_path:
            try:
                vs.save_local(self.persist_path)
            except Exception:
                # ignore persistence errors but proceed
                pass
        return vs

    # Native FAISS export / load helpers 
    def export_native_index(self, native_dir: str) -> None:
        
        if not _HAS_FAISS:
            raise RuntimeError("faiss python package is required to export native index")

        if self.chunks is None:
            self.chunks = self._create_chunks()

        if self._embeddings is None:
            self._embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

        os.makedirs(native_dir, exist_ok=True)

        # Batch embed documents
        texts = [d.page_content for d in self.chunks]
        batch_size = 256
        vecs = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            emb = self._embeddings.embed_documents(batch)
            # convert each embedding to numpy array
            for v in emb:
                vecs.append(np.array(v, dtype='float32'))

        if len(vecs) == 0:
            raise RuntimeError("No document embeddings produced; cannot build native index")

        arr = np.vstack(vecs).astype('float32')

        # Work with local faiss import to satisfy static checkers
        import faiss as _faiss

        # Build an IndexFlatIP (cosine-style search after normalization) for speed
        dim = arr.shape[1]
        index = _faiss.IndexFlatIP(dim)
        # normalize if using IP
        _faiss.normalize_L2(arr)
        # cast to Any to avoid type-checker issues for faiss index methods
        from typing import Any, cast
        _idx = cast(Any, index)
        _idx.add(arr)

        faiss_path = os.path.join(native_dir, "index_native.faiss")
        _faiss.write_index(index, faiss_path)

        # Save metadata aligned with vectors
        meta_path = os.path.join(native_dir, "metadata.json")
        metadata_list = [{"page_content": d.page_content, "metadata": d.metadata} for d in self.chunks]
        with open(meta_path, "w", encoding="utf-8") as fh:
            json.dump(metadata_list, fh)

        print(f"Exported native FAISS index ({len(self.chunks)} docs) to {native_dir}")

    def _load_native_index(self, native_dir: str) -> None:
        """Load a native faiss index and metadata into memory.

        After calling this, `self._native_index` and `self._native_metadata` are available
        and `answer()` will use the native index for retrieval.
        """
        if not _HAS_FAISS:
            raise RuntimeError("faiss python package not available for native index load")

        faiss_path = os.path.join(native_dir, "index_native.faiss")
        meta_path = os.path.join(native_dir, "metadata.json")
        if not os.path.exists(faiss_path) or not os.path.exists(meta_path):
            raise FileNotFoundError("native faiss index or metadata missing in " + native_dir)

        import faiss as _faiss
        index = _faiss.read_index(faiss_path)
        with open(meta_path, "r", encoding="utf-8") as fh:
            metadata_list = json.load(fh)

        # keep in instance for retrieval
        self._native_index = index
        self._native_metadata = metadata_list
        # embeddings needed to convert queries
        if self._embeddings is None:
            self._embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    def _initialize_gemini_llm(self) -> ChatGoogleGenerativeAI:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set.")
        return ChatGoogleGenerativeAI(google_api_key=api_key, model="gemini-2.5-flash", temperature=0.2)

    def _build_prompt(self, question: str, docs: List[Document]) -> str:
        context_blocks = []
        for d in docs:
            meta = " | ".join(f"{k}: {v}" for k, v in d.metadata.items()) if d.metadata else ""
            block = d.page_content
            if meta:
                block += f"\n\n[Meta: {meta}]"
            context_blocks.append(block)
        context = "\n\n---\n\n".join(context_blocks)
        return (
            "You are an expert assistant. Use ONLY the following context to answer the question. "
            "If the answer is not in the context, say you don't have enough information.\n\n"
            f"Context:\n{context}\n\n"
            f"Question: {question}\n\n"
            "Answer in 3-5 concise sentences.\n\n"
            "After your answer, on the final line ONLY output: INCLUDE_SOURCES: YES or INCLUDE_SOURCES: NO\n"
            "Do not output anything else after that line."
        )

    # Conditional sources decision (LangGraph + Gemini)
    class _State(TypedDict):
        question: str
        answer: str
        include_sources: bool

    def _decide_include_sources(self, question: str, answer: str, docs: List[Document]) -> bool:
        """Decide whether to include sources, preferring LangGraph + Gemini; fallback to LLM or heuristics."""
        def classify_with_llm(q: str, a: str) -> bool:
            prompt = (
                "Decide if the user needs source details (like Clothing ID, Age, Title, Review Text).\n"
                "Reply strictly with YES or NO.\n\n"
                f"Question: {q}\n"
                f"Answer: {a}\n\n"
                "Guidelines:\n"
                "- YES if the user asks to show examples, IDs, specific rows/records, cite evidence, or wants to inspect data.\n"
                "- NO if a high-level summary is sufficient and no explicit request for examples or IDs.\n"
            )
            llm = self.llm or self._initialize_gemini_llm()
            out = llm.invoke(prompt)
            text = getattr(out, "content", str(out)).strip().lower()
            return text.startswith("y")

        if _HAS_LANGGRAPH:
            class_state = self._State
            graph = StateGraph(class_state)

            def decide_node(state):
                inc = classify_with_llm(state["question"], state["answer"]) 
                return {**state, "include_sources": bool(inc)}

            graph.add_node("decide", decide_node)
            graph.add_edge(START, "decide")
            graph.add_edge("decide", END)
            app = graph.compile()
            result = app.invoke({"question": question, "answer": answer, "include_sources": False})
            return bool(result.get("include_sources", False))

        # Fallback: try LLM directly; if fails, use simple keyword heuristic
        try:
            return classify_with_llm(question, answer)
        except Exception:
            ql = (question or "").lower()
            trigger_words = ["show", "list", "id", "ids", "age", "title", "review", "examples", "evidence", "source"]
            return any(w in ql for w in trigger_words)
    def answer(self, query: str) -> Dict[str, Any]:
        # If native index is loaded, use it directly for faster retrieval
        if getattr(self, "_native_index", None) is not None:
            # ensure embeddings available
            if self._embeddings is None:
                self._embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
            # compute query embedding
            q_emb = np.array(self._embeddings.embed_query(query), dtype='float32')
            import faiss as _faiss
            _faiss.normalize_L2(q_emb)
            q_emb = q_emb.reshape(1, -1)
            D, I = self._native_index.search(q_emb, self.k)
            docs = []
            for idx in I[0]:
                if idx < 0 or idx >= len(self._native_metadata):
                    continue
                item = self._native_metadata[idx]
                docs.append(Document(page_content=item.get("page_content", ""), metadata=item.get("metadata", {})))
        else:
            # Ensure retriever is available (may be lazy-loaded)
            if self.retriever is None:
                if self.vectorstore is None:
                    self.vectorstore = self._create_vectorstore()
                self.retriever = self.vectorstore.as_retriever(search_kwargs={"k": self.k})

            docs = self.retriever.invoke(query)
        prompt = self._build_prompt(query, docs)
        llm = self.llm or self._initialize_gemini_llm()
        resp = llm.invoke(prompt)
        raw = getattr(resp, "content", str(resp)).strip()

        # Parse final flag line 'INCLUDE_SOURCES: YES' or NO
        include_sources = False
        lines = [l.rstrip() for l in raw.splitlines() if l.strip()]
        if lines:
            last = lines[-1]
            if last.upper().startswith("INCLUDE_SOURCES:"):
                flag = last.split(":", 1)[1].strip().upper()
                include_sources = flag.startswith("Y")
                answer_text = "\n".join(lines[:-1]).strip()
            else:
                answer_text = raw
        else:
            answer_text = raw

        sources = [{"metadata": d.metadata, "text_snippet": d.page_content} for d in docs]
        return {"answer": answer_text, "sources": sources, "used_gemini": True, "include_sources": include_sources}

if __name__ == "__main__":
    try:
        df = pd.read_csv(r"D:\DES646-Project\outputs\clean_csv.csv") # Path to you clean csv file
        rag_engine = RAGbot(df)
        user_query = "What is worst fitting clothing item?"
        response = rag_engine.answer(user_query)
        print("Answer:", response["answer"])
        if response.get("include_sources"):
            print("\nSources (up to 3):")
            for s in response["sources"][:3]:
                md = s.get("metadata", {}) or {}
                print({
                    "Clothing ID": md.get("Clothing ID", ""),
                    "Age": md.get("Age", ""),
                    "Title": md.get("Title", ""),
                    "Review Text": md.get("Review Text", "")
                })
    except Exception as e:
        print("Error:", e)