import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Proxy to Python backend /dashboard_data
export async function GET(req: NextRequest) {
  try {
    const base = process.env.RAG_API_BASE || process.env.NEXT_PUBLIC_RAG_API_BASE || 'http://127.0.0.1:8000';
    const url = new URL(req.url);
    const department = url.searchParams.get('department');
    const params = new URLSearchParams({ max_items: '1000' });
    if (department && department !== 'All') params.set('department', department);
    const target = `${String(base).replace(/\/$/, '')}/dashboard_data?${params.toString()}`;
    const res = await fetch(target, { method: 'GET', cache: 'no-store' });
    const text = await res.text();
    return new NextResponse(text, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
