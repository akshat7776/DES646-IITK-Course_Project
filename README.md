## Feedback Analyzer

Analyze customer reviews at scale with a FastAPI backend and a Next.js dashboard.  
The app precomputes sentiment and emotions for fast, accurate aggregates and serves a compact sample of reviews for UI rendering.

## Overall architecture

![Overall Architecture](Architecture/Overall%20Architecture.png)

## Folder structure

```
DES646-Project/
├─ Architecture/                # All Architecture images 
│  └─ Overall Architecture.png
├─ Chrome_Extension/
│  ├─ background.js
│  ├─ content.js
│  ├─ manifest.json
│  ├─ popup.html
│  └─ popup.js
├─ frontend/
│  ├─ next.config.ts
│  ├─ package.json
│  ├─ public/
│  │  └─ images/
│  ├─ src/
│  │  ├─ app/
│  │  │  ├─ layout.tsx
│  │  │  ├─ page.tsx
│  │  │  └─ dashboard/
│  │  ├─ components/
│  │  ├─ hooks/
│  │  └─ lib/
├─ src/
│  ├─ data_preprocessing.py
│  ├─ emotions.py
│  ├─ fastapi_serve.py
│  ├─ intent.py
│  ├─ orchestrator.py
│  ├─ precompute_dashboard.py
│  ├─ precompute_native.py
│  ├─ rag.py
│  ├─ reply.py
│  ├─ sentiment.py
│  ├─ summary.py
│  └─ __pycache__/
├─ outputs/
│  ├─ clean_csv.csv
│  ├─ dashboard_reviews.jsonl
│  ├─ dashboard_summary.json
│  ├─ faiss_index/            # LangChain FAISS persistence
│  └─ faiss_index_native/     # native FAISS (index_native.faiss, metadata.json)
├─ data/
│  └─ Womens Clothing E-Commerce Reviews.csv
├─ main.ipynb                 # main file for experiments
├─ README.md
├─ requirements.txt
├─ .env.example
└─ .vscode/
   ├─ launch.json
   └─ tasks.json
```

---

## What's inside

- **Backend (Python / FastAPI)**
	- Entry: `src/fastapi_serve.py`
	- Auto precompute on first start: saves caches under `outputs/`
	- Endpoints: `/dashboard_data`, `/refresh_dashboard`, `/query`, `/analyze_review(s)`, `/health`
- **Frontend (Next.js App Router)**
	- Entry: `frontend/`
	- Dashboard, Department browser, and Product pages
	- Department filter always shows all departments
- **Data & caches**
	- Source CSV (example): `data/Womens Clothing E-Commerce Reviews.csv` or `outputs/clean_csv.csv`
	- Precomputed caches: `outputs/dashboard_reviews.jsonl`, `outputs/dashboard_summary.json`

---

## Prerequisites

- Windows PowerShell (v5+) or Terminal  
- Python 3.10+ recommended  
- Node.js 18+ and npm 9+  

---

## Clone the repository

```powershell
git clone https://github.com/akshat7776/DES646-IITK-Course_Project.git DES646-PROJECT
cd DES646-PROJECT
```

---

## Backend setup (FastAPI)

1) Create a virtual environment and install dependencies:

```powershell
cd D:\DES646-Project
python -m venv .venv
./.venv/Scripts/Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

2) Optional: set environment variables (for LLM features)

```powershell
$env:GOOGLE_API_KEY = "<your_api_key>"
```

3) Run the server

```powershell
python src/fastapi_serve.py
# FastAPI defaults here to 127.0.0.1:8000
```

On first start, the server precomputes dashboard caches (sentiment + emotions) and writes them to `outputs/`. Subsequent runs use the cache for faster load times.

---

### Key endpoints

- **GET** `/dashboard_data?max_items=1000&department=Bottoms`  
  Returns aggregates (totals, average rating, NPS, positive%) and a compact review sample.  
  Also returns `sentiment_counts` and `emotion_counts` filtered by department.  

- **POST** `/refresh_dashboard`  
  Forces a full recompute of caches from the CSV.  

- **GET** `/health` → `{ status: "ok", ready: true/false }`

---

## Frontend setup (Next.js)

```powershell
cd D:\DES646-Project\frontend
npm install
npm run dev
# Serves at http://localhost:9002
```

Open **http://localhost:9002** in your browser.

---

## Chrome Extension (MV3)

Analyze reviews directly on product pages and send them to the backend automatically.

### Install and run

- Prereqs: Backend at `http://127.0.0.1:8000`, Frontend at `http://localhost:9002`
- In Chrome:
	1) Open `chrome://extensions`
	2) Enable “Developer mode”
	3) Click **Load unpacked** and select the `Chrome_Extension/` folder
	4) Optionally pin the extension

### Use

1) Open a product page, e.g. `http://localhost:9002/products/123`  
2) Click the extension → “Analyze”  
   - Extracts up to 100 reviews and POSTs to `/analyze_reviews`  
   - Shows Average Rating, Dominant Sentiment, Summary, and per-review labels  
3) Inline “Analyze” buttons appear on review cards for single-review tests (`/analyze_review`)

**Notes**
- Host permissions: `http://localhost:9002/*`, `http://127.0.0.1:8000/*`
- Content script targets `/products/*` and “Customer Feedback” sections

**Troubleshooting**
- “No reviews detected”: scroll so the DOM loads.  
- “Receiving end does not exist”: refresh and retry.  
- “Backend error 500”: ensure FastAPI is running.

---

## How the dashboard works

- “All” view = global aggregates from caches  
- Department filter = exact per-department stats  
- Emotion chart = falls back to sample emotions if degenerate (>95% single emotion)  
- Department list = always static (all available departments shown)

---

## Images and placeholders

- Images live under `frontend/public/images/departments/`
- Mappings in `frontend/src/lib/placeholder-images.json`
- Customize by replacing an image and editing the mapping entry

---

## Common tasks

- **Rebuild caches** after modifying `emotions.py` or `sentiment.py`:

```powershell
# Option A: recompute in-place
Invoke-RestMethod -Method Post http://127.0.0.1:8000/refresh_dashboard

# Option B: delete and restart
Remove-Item -Force .\outputs\dashboard_reviews.jsonl -ErrorAction SilentlyContinue
Remove-Item -Force .\outputs\dashboard_summary.json -ErrorAction SilentlyContinue
python src/fastapi_serve.py
```

- **Quick API checks:**

```powershell
Invoke-RestMethod "http://127.0.0.1:8000/dashboard_data?max_items=5"
Invoke-RestMethod "http://127.0.0.1:8000/dashboard_data?department=Bottoms&max_items=5"
```

---

## Analytics details

- **NPS formula:**  
  `NPS = ((promoters − detractors) / total) × 100`  
  Promoters ≥ 4 stars, Detractors ≤ 2 stars  

- **Sentiment & emotion counts:**  
  Pulled from precomputed data for accuracy; fallback to sample on degeneration  

- **/analyze_review:**  
  Returns per-review NPS, sentiment, emotion, intent, buy-again, reply  

- **/analyze_reviews:**  
  Returns per-review labels + `average_rating`, `average_nps`, `dominant_sentiment`, `summary`

---

## Troubleshooting

- **Hydration warnings**: ignored using `suppressHydrationWarning`.  
- **Few emotions visible:** ensure `scipy` installed and caches rebuilt.  
- **Slow first start:** expected during precompute; cached runs are faster.

---
