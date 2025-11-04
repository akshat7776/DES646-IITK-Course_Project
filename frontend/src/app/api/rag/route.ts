import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple proxy API: forwards POST requests to the configured RAG backend.
// This avoids CORS issues when the frontend (Next.js) is served from a different port.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const base = process.env.RAG_API_BASE || process.env.NEXT_PUBLIC_RAG_API_BASE || 'http://127.0.0.1:8000';
    const target = `${String(base).replace(/\/$/, '')}/query`;

    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
