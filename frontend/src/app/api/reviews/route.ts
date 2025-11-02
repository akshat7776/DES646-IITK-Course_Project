import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Project root -> outputs/clean_reviews_by_dept.json
    const root = process.cwd();
    const filePath = path.join(root, 'outputs', 'clean_reviews_by_dept.json');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Data file not found' }, { status: 404 });
    }

    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to read file' }, { status: 500 });
  }
}
