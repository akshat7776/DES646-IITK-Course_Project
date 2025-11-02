import csv
import json
import os
from collections import defaultdict

INPUT_CSV = os.path.join(os.path.dirname(__file__), '..', 'outputs', 'clean_csv.csv')
OUTPUT_JSON = os.path.join(os.path.dirname(__file__), '..', 'outputs', 'clean_reviews_by_dept.json')

def read_csv(path):
    rows = []
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return rows

def build_nested(rows):
    nested = defaultdict(lambda: defaultdict(list))
    # common column names we'll try to extract
    for r in rows:
        dept = (r.get('Department Name') or r.get('department') or r.get('Department') or '').strip()
        cls = (r.get('Class Name') or r.get('class') or r.get('Class') or '').strip()
        review = (r.get('Review Text') or r.get('review_text') or r.get('review') or '').strip()

        if not dept:
            dept = 'Unknown'
        if not cls:
            cls = 'Unknown'

        if not review:
            # skip empty review rows
            continue

        # collect meta fields if present
        record = {
            'Review Text': review
        }

        for field in ['Title', 'title', 'Age', 'age', 'Clothing ID', 'Clothing_ID', 'clothing id', 'Clothing Id', 'ClothingID', 'Rating', 'rating']:
            if field in r and r[field] is not None and r[field] != '':
                # normalize key name
                key = field if field in ['Title', 'Age', 'Clothing ID', 'Rating'] else field.title()
                record[key] = r[field]

        nested[dept][cls].append(record)

    # convert defaultdicts to normal dicts
    out = {dept: dict(classes) for dept, classes in nested.items()}
    return out

def main():
    if not os.path.exists(INPUT_CSV):
        print(f"Input CSV not found at {INPUT_CSV}")
        return 1

    print(f"Reading CSV from: {INPUT_CSV}")
    rows = read_csv(INPUT_CSV)
    print(f"Read {len(rows)} rows")

    nested = build_nested(rows)

    # write output
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(nested, f, ensure_ascii=False, indent=2)

    # basic summary
    dept_count = len(nested)
    total_reviews = sum(sum(len(v) for v in classes.values()) for classes in nested.values())
    print(f"Wrote nested JSON to: {OUTPUT_JSON}")
    print(f"Departments: {dept_count}, total reviews: {total_reviews}")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
