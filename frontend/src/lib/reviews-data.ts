import fs from 'fs';
import path from 'path';
import type { Product, Review } from '@/lib/types';

// Helper to create stable slugs
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const imageIds = [
  'product-1',
  'product-2',
  'product-3',
  'product-4',
  'product-5',
  'product-6',
  'product-7',
  'product-8',
];

function findDataFile(): string | null {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'outputs', 'clean_reviews_by_dept.json'),
    path.join(cwd, '..', 'outputs', 'clean_reviews_by_dept.json'),
    path.join(cwd, '..', '..', 'outputs', 'clean_reviews_by_dept.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function loadNestedReviews(): Promise<Record<string, Record<string, any[]>>> {
  const file = findDataFile();
  if (!file) throw new Error('clean_reviews_by_dept.json not found');
  const raw = await fs.promises.readFile(file, 'utf-8');
  return JSON.parse(raw);
}

export async function getCsvProductById(id: string): Promise<Product | null> {
  const data = await loadNestedReviews();
  const deptNames = Object.keys(data);

  for (let di = 0; di < deptNames.length; di++) {
    const deptName = deptNames[di];
    const classes = data[deptName] || {};
    const classNames = Object.keys(classes);

    for (let ci = 0; ci < classNames.length; ci++) {
      const className = classNames[ci];
      const constructedId = `${slugify(deptName)}-${slugify(className)}`;
      if (constructedId === id) {
        const records = (classes as any)[className] as any[];
        const reviews: Review[] = records.map((r: any, idx: number) => {
          const rating = Number(r.Rating ?? r.rating ?? 0) || 0;
          const ageNum = r.Age !== undefined ? Number(r.Age) : undefined;
          const clothing = r['Clothing ID'] !== undefined ? Number(r['Clothing ID']) : undefined;
          const title = r.Title ?? r.title ?? '';
          const text = r['Review Text'] ?? r.review ?? r.text ?? '';
          return {
            id: idx + 1,
            author: title || 'Anonymous',
            date: '2024-01-01',
            rating,
            text,
            title,
            age: Number.isFinite(ageNum) ? (ageNum as number) : undefined,
            clothingId: Number.isFinite(clothing) ? (clothing as number) : undefined,
          };
        });

        // Prefer a canonical category image id when we recognize the class name; otherwise fallback to rotation
        const canonical = className.trim();
        const knownIds = new Set<string>([
          'Dresses','Knits','Blouses','Sweaters','Pants','Jeans','Fine gauge','Skirts','Jackets','Lounge','Swim','Outerwear','Shorts','Sleep','Legwear','Intimates','Layering','Trend','Casual bottoms','Chemises'
        ]);
        const imageId = knownIds.has(canonical)
          ? canonical
          : (className.toLowerCase().includes('sleep') ? 'Sleep' : imageIds[(di + ci) % imageIds.length]);
        const product: Product = {
          id: constructedId,
          name: className,
          department: deptName,
          productAge: '',
          imageId,
          reviews,
        };
        return product;
      }
    }
  }

  return null;
}
