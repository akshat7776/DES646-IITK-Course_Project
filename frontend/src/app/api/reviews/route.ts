import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Locate outputs/clean_reviews_by_dept.json flexibly.
    // When running inside the Next.js app, process.cwd() points to the frontend folder.
    // The data file lives at the project root ../outputs/clean_reviews_by_dept.json
    const cwd = process.cwd();
    const candidates = [
      path.join(cwd, 'outputs', 'clean_reviews_by_dept.json'),
      path.join(cwd, '..', 'outputs', 'clean_reviews_by_dept.json'),
      path.join(cwd, '..', '..', 'outputs', 'clean_reviews_by_dept.json'),
    ];

    const found = candidates.find((p) => fs.existsSync(p));

    if (!found) {
      return NextResponse.json(
        {
          error: 'Data file not found',
          tried: candidates,
        },
        { status: 404 }
      );
    }

    const raw = await fs.promises.readFile(found, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to read file' }, { status: 500 });
  }
}
