## Feedback Analyzer

Analyze customer reviews at scale with a FastAPI backend and a Next.js dashboard. The app precomputes sentiment and emotions for fast, accurate aggregates and serves a compact sample of reviews for UI rendering.

## What's inside

- Backend (Python / FastAPI)
	- Entry: `src/fastapi_serve.py`
	- Auto precompute on first start: saves caches under `outputs/`
	- Endpoints: `/dashboard_data`, `/refresh_dashboard`, `/query`, `/analyze_review(s)`, `/health`
- Frontend (Next.js App Router)
	- Entry: `frontend/`
	- Dashboard, Department browser, and Product pages
	- Department filter always shows all departments
- Data & caches
	- Source CSV (example): `Womens Clothing E-Commerce Reviews.csv` or `outputs/clean_csv.csv`
	- Precomputed caches: `outputs/dashboard_reviews.jsonl`, `outputs/dashboard_summary.json`

## Prerequisites

- Windows PowerShell (v5+) or Terminal
- Python 3.10+ recommended
- Node.js 18+ and npm 9+

## Backend setup (FastAPI)

1) Create a virtual environment and install deps

```powershell
cd D:\DES646-Project
python -m venv .venv
./.venv/Scripts/Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

2) Optional: set environment variables (if you plan to use LLM features)

```powershell
$env:GOOGLE_API_KEY = "<your_api_key>"
```

3) Run the server

```powershell
python src/fastapi_serve.py
# FastAPI defaults here to 127.0.0.1:8000
```

On first start, the server will precompute dashboard caches (sentiment + emotions) and write them to `outputs/`. Subsequent starts use the cache for speed.

### Key endpoints

- GET `/dashboard_data?max_items=1000&department=Bottoms`
	- Returns exact aggregates (totals, average rating, NPS, positive%) and compact sample of reviews for the UI.
	- Also returns `sentiment_counts` and `emotion_counts` (top N) from the full precomputed data, filtered by department when provided.

- POST `/refresh_dashboard`
	- Forces a full recompute of caches from the current CSV without restarting.

- GET `/health` → `{ status: "ok", ready: true/false }`

## Frontend setup (Next.js)

```powershell
cd D:\DES646-Project\frontend
npm install
npm run dev
# Serves at http://localhost:9002 (see package.json)
```

Open http://localhost:9002 in your browser.

## Chrome Extension (MV3)

Analyze reviews directly on the product page and send them to the backend without copying text.

### Install and run

- Prereqs: Backend running at http://127.0.0.1:8000; Frontend running at http://localhost:9002
- In Chrome:
	1) Open chrome://extensions
	2) Enable "Developer mode"
	3) Click "Load unpacked" and select the `Chrome_Extension/` folder
	4) Pin the extension for quick access (optional)

### Use it

1) Navigate to a product detail page in the app, e.g. http://localhost:9002/products/123
2) Click the extension and then "Analyze"
	 - The popup extracts up to 100 reviews from the "Customer Feedback" section and POSTs them to `POST /analyze_reviews`
	 - You’ll see aggregate stats (Average Rating, Dominant Sentiment, Summary) and per-review chips (sentiment, emotion, intent, NPS, buy-again)
3) Inline buttons: small "Analyze" buttons also appear on each review card; clicking one sends that review to `POST /analyze_review` and renders the result inline

Notes
- Host permissions are preconfigured for http://localhost:9002/* and http://127.0.0.1:8000/*
- The content script targets pages under `/products/*` and looks for a "Customer Feedback" section

Troubleshooting
- "No reviews detected": Scroll to the feedback section so the DOM is present; ensure the page path matches `/products/*`
- "Receiving end does not exist": The popup will inject the content script automatically and retry. If it persists, refresh the page and click Analyze again
- "Backend error 500" or "Invalid JSON": Make sure FastAPI is running at 127.0.0.1:8000 and reachable from the browser

## How the dashboard works

- “All” view uses exact global aggregates from the backend caches.
- Selecting a department sends `?department=Name` and renders exact per-department totals, average rating, and NPS.
- The emotion chart prefers aggregated `emotion_counts`; if they’re degenerate (only one emotion or >95% dominated), the UI falls back to the review sample’s per-item emotions so you still see variety while the cache is rebuilding.
- The department filter always lists all departments returned by the backend; it won’t shrink when you switch between departments.

## Images and placeholders

- Category placeholders live in `frontend/public/images/departments/`.
- Mappings are defined in `frontend/src/lib/placeholder-images.json`.
- To customize a category image, drop a file into `public/images/departments/` and update the mapping entry for that category ID (e.g., "Dresses", "Jackets", "Intimates").

## Common tasks

- Rebuild caches after changing `emotions.py` or `sentiment.py`:

```powershell
# Option A: recompute in-place (fastest)
Invoke-RestMethod -Method Post http://127.0.0.1:8000/refresh_dashboard

# Option B: delete caches then restart server
Remove-Item -Force .\outputs\dashboard_reviews.jsonl -ErrorAction SilentlyContinue
Remove-Item -Force .\outputs\dashboard_summary.json -ErrorAction SilentlyContinue
python src/fastapi_serve.py
```

- Quick API checks:

```powershell
Invoke-RestMethod "http://127.0.0.1:8000/dashboard_data?max_items=5"
Invoke-RestMethod "http://127.0.0.1:8000/dashboard_data?department=Bottoms&max_items=5"
```

## Analytics details

- NPS (dashboard): computed from ratings using the standard formula: NPS = ((promoters − detractors) / total) × 100, where promoters are ratings ≥ 4, detractors are ratings ≤ 2
- Sentiment counts and emotion counts: pulled from the precomputed dataset for accuracy; charts use these exact aggregates, with a graceful fallback to the current sample if aggregates are degenerate
- Single-review analysis (`/analyze_review`): returns one review’s predicted NPS score and labels
- Batch analysis (`/analyze_reviews`): returns per-review labels plus `average_rating`, `average_nps` (mean of predicted NPS values), `dominant_sentiment`, and a short `summary`

API contracts (abridged)
- POST `/analyze_reviews`
	- Body: `{ reviews: [{ text: string, rating?: number, author?: string }], product?: { title?: string, url?: string } }`
	- Response: `{ reviews: [{ review, sentiment, emotion, intent, nps, buy_again, reply? }], average_rating?, average_nps?, dominant_sentiment, summary }`
- POST `/analyze_review`
	- Body: `{ text: string, rating?: number, author?: string, product?: { title?: string, url?: string } }`
	- Response: `{ review, sentiment, emotion, intent, nps, buy_again, reply? }`

## Troubleshooting

- Hydration warning in the browser console (extensions like Grammarly add attributes):
	- The app includes `suppressHydrationWarning` in `html` and `body` to minimize noisy warnings.

- Emotion Breakdown shows only 1–2 emotions:
	- Make sure caches are refreshed after updating `src/emotions.py`.
	- Requirements include `scipy` enabling an optimal cluster-to-emotion assignment; install deps and restart if needed.

- Slow first startup:
	- Expected during precompute. Subsequent runs are fast thanks to cached JSONL/JSON.

## Repository layout (high-level)

```
DES646-Project/
	README.md
	requirements.txt
	outputs/
		dashboard_reviews.jsonl
		dashboard_summary.json
	src/
		fastapi_serve.py
		emotions.py
		sentiment.py
		rag.py
	frontend/
		package.json
		src/
			components/
			app/
			lib/
```

---

If you want a production deploy (App Hosting/Vercel) or containerization, we can add minimal configs and scripts next.

