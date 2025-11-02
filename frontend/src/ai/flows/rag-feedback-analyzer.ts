/**
 * @fileOverview Frontend helper to call the Python FastAPI RAG backend.
 *
 * We previously used a Genkit prompt with inline context. Now we connect the
 * website to the real RAG service at /query, which performs retrieval over
 * the FAISS index and returns an answer plus optional sources.
 */

export type RAGInput = {
  query: string;
  // Kept for backward-compat with existing callers; ignored by the backend.
  context?: string;
};

export type RAGSource = {
  metadata?: Record<string, unknown>;
  text_snippet?: string;
};

export type RAGOutput = {
  answer: string;
  sources?: RAGSource[];
  include_sources?: boolean;
};

export async function analyzeFeedbackWithRAG(input: RAGInput): Promise<RAGOutput> {
  const baseUrl = process.env.NEXT_PUBLIC_RAG_API_BASE?.replace(/\/$/, '') || 'http://127.0.0.1:8000';
  const res = await fetch(`${baseUrl}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: input.query }),
    // Always use fetch from the browser or server with CORS enabled in FastAPI
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RAG API error ${res.status}: ${text || res.statusText}`);
  }

  const data = (await res.json()) as { answer: string; sources?: RAGSource[]; include_sources?: boolean };
  return {
    answer: data.answer ?? '',
    sources: data.sources ?? [],
    include_sources: data.include_sources ?? false,
  };
}