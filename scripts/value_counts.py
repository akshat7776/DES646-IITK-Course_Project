import os
import sys
import json

CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'outputs', 'clean_csv.csv')

try:
    import pandas as pd
except Exception as e:
    print(json.dumps({"error": f"pandas not installed: {e}"}))
    sys.exit(1)

try:
    df = pd.read_csv(CSV_PATH)
    col = None
    for c in df.columns:
        if c.strip().lower() == 'department name':
            col = c
            break
    if col is None:
        for alt in ['Department', 'department', 'dept', 'dept_name', 'Department_Name']:
            for c in df.columns:
                if c.strip().lower() == alt.strip().lower():
                    col = c
                    break
            if col:
                break
    if col is None:
        raise KeyError('Department Name column not found. Columns: ' + ', '.join(df.columns))

    vc = df[col].value_counts(dropna=False)
    out = {
        'column_used': col,
        'counts': { ('' if pd.isna(k) else str(k)): int(v) for k, v in vc.items() }
    }
    # Write to a file for reliable reading
    out_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'outputs', 'department_counts.json')
    with open(out_path, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
    print(json.dumps(out, ensure_ascii=False))
    print(f"\nWROTE: {out_path}")
except Exception as e:
    print(json.dumps({'error': str(e)}))
    sys.exit(1)
