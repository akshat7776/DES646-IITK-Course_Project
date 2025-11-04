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
  // Use same-origin proxy route so the browser won't hit CORS issues.
  // The proxy will forward to the configured backend (RAG_API_BASE).
  const proxyPath = '/api/rag';

  try {
    const res = await fetch(proxyPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: input.query }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`RAG API (proxy) error ${res.status}: ${text || res.statusText}`);
    }

    const data = (await res.json()) as { answer: string; sources?: RAGSource[]; include_sources?: boolean };
    return {
      answer: data.answer ?? '',
      sources: data.sources ?? [],
      include_sources: data.include_sources ?? false,
    };
  } catch (err: any) {
    // Helpful error message for devs — often this is CORS or backend not running.
    console.error('Failed to call RAG proxy:', err);
    throw new Error(
      `Failed to call RAG service. Ensure the Python backend is running and RAG_API_BASE/NEXT_PUBLIC_RAG_API_BASE is set. Details: ${String(
        err?.message || err
      )}`
    );
  }
}