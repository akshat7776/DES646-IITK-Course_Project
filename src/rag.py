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

# LangGraph for decision routing
try:
    from langgraph.graph import StateGraph, START, END
    _HAS_LANGGRAPH = True
except Exception:
    _HAS_LANGGRAPH = False

class RAGbot:
    def __init__(self, df: pd.DataFrame, review_col: Optional[str] = None, k: int = 5):
        self.df = df
        self.review_col = review_col or self._detect_review_column()
        self.k = k
        self.chunks = self._create_chunks()
        self.vectorstore = self._create_vectorstore()
        self.llm = self._initialize_gemini_llm()
        self.retriever = self.vectorstore.as_retriever(search_kwargs={"k": self.k})

    def _detect_review_column(self) -> str:
        for col in self.df.columns:
            if self.df[col].dtype == object and self.df[col].str.len().mean() > 20:
                return col
        raise ValueError("No suitable review text column found.")

    def _create_chunks(self) -> List[Document]:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            separators=["\n\n", "\n", " ", ""]
        )
        documents = []
        for idx, row in self.df.iterrows():
            raw = row.get(self.review_col) if isinstance(row, dict) else row[self.review_col]
            text = str(raw) if raw is not None and str(raw) != 'nan' else ""
            if not text.strip():
                continue
            splits = text_splitter.split_text(text)
            for i, chunk in enumerate(splits):
                metadata = row.to_dict()
                metadata.update({"chunk_index": i})
                documents.append(Document(page_content=chunk, metadata=metadata))
        return documents

    def _create_vectorstore(self) -> FAISS:
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        vectorstore = FAISS.from_documents(self.chunks, embeddings)
        return vectorstore

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
            f"Question: {question}\n"
            "Answer in 3-5 concise sentences."
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
            out = self.llm.invoke(prompt)
            text = getattr(out, "content", str(out)).strip().lower()
            return text.startswith("y")

        if _HAS_LANGGRAPH:
            class_state = self._State
            graph = StateGraph(class_state)

            def decide_node(state: class_state) -> class_state:
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
        docs = self.retriever.invoke(query)
        prompt = self._build_prompt(query, docs)
        resp = self.llm.invoke(prompt)
        answer_text = getattr(resp, "content", str(resp))
        include_sources = self._decide_include_sources(query, answer_text, docs)
        sources = [{"metadata": d.metadata, "text_snippet": d.page_content} for d in docs]
        return {"answer": answer_text, "sources": sources, "used_gemini": True, "include_sources": include_sources}

if __name__ == "__main__":
    try:
        df = pd.read_csv("clean_csv.csv")
        rag_engine = RAGbot(df)
        user_query = "What is 2+2?"
        response = rag_engine.answer(user_query)
        print("Answer:", response["answer"])
        if response.get("include_sources"):
            print("\nSources (up to 4):")
            for s in response["sources"][:4]:
                md = s.get("metadata", {}) or {}
                print({
                    "Clothing ID": md.get("Clothing ID", ""),
                    "Age": md.get("Age", ""),
                    "Title": md.get("Title", ""),
                    "Review Text": md.get("Review Text", "")
                })
    except Exception as e:
        print("Error:", e)