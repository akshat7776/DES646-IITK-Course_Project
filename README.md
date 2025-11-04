# DES646-IITK-Course_Project
This repo includes all the files for DES646 Course Project

## Dashboard precompute and cache

To make the dashboard load instantly, we precompute review signals (sentiment and emotion) once from `outputs/clean_csv.csv` and cache the results:

- Per-review cache: `outputs/dashboard_reviews.jsonl`
- Aggregates: `outputs/dashboard_summary.json`

Run the precompute script manually:

```bash
python src/precompute_dashboard.py
```

Or trigger a rebuild from the server:

- HTTP: `POST http://127.0.0.1:8000/refresh_dashboard`

On server startup, `src/fastapi_serve.py` will automatically use the cache if it’s newer than the CSV; otherwise it computes the cache once and saves it. The dashboard API samples reviews to keep payloads small and accepts a `max_items` query parameter (default 1000).

