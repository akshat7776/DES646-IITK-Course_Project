// popup.js

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function setStatus(text, loading = false, isError = false) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = text;
  el.className = isError ? 'error' : 'muted';
  if (loading) {
    el.innerHTML = `<span class="spinner"></span> <span style="margin-left:6px;">${text}</span>`;
  }
}

function renderAggregate(data) {
  const agg = document.getElementById('aggregate');
  const avgRating = document.getElementById('avgRating');
  const domSent = document.getElementById('domSent');
  const summary = document.getElementById('summary');

  if (!agg || !avgRating || !domSent || !summary) return;

  if (typeof data.average_rating === 'number') avgRating.textContent = data.average_rating.toFixed(1);
  if (data.dominant_sentiment) domSent.textContent = data.dominant_sentiment;
  if (data.summary) summary.textContent = data.summary;

  agg.style.display = 'block';
}

function renderReviews(items) {
  const list = document.getElementById('reviews');
  if (!list) return;
  list.innerHTML = '';

  if (!items || items.length === 0) {
    list.innerHTML = '<div class="muted">No reviews found.</div>';
    return;
  }

  for (const r of items) {
    const card = document.createElement('div');
    card.className = 'card';

    const text = document.createElement('div');
    text.textContent = r.review || r.text || '';

    const chips = document.createElement('div');
    chips.className = 'chips';
    const s = document.createElement('span'); s.className = 'chip'; s.textContent = `Sentiment: ${r.sentiment ?? '-'}`;
    const e = document.createElement('span'); e.className = 'chip'; e.textContent = `Emotion: ${r.emotion ?? '-'}`;
    const i = document.createElement('span'); i.className = 'chip'; i.textContent = `Intent: ${r.intent ?? '-'}`;

    const meta = document.createElement('div');
    meta.className = 'chips';
    const nps = document.createElement('span'); nps.className = 'chip'; nps.textContent = `NPS: ${typeof r.nps === 'number' ? r.nps.toFixed(1) : '-'}`;
    const buy = document.createElement('span'); buy.className = 'chip'; buy.textContent = `Buy Again: ${r.buy_again ?? '-'}`;

    chips.appendChild(s); chips.appendChild(e); chips.appendChild(i);
    meta.appendChild(nps); meta.appendChild(buy);

    card.appendChild(text);
    card.appendChild(chips);
    card.appendChild(meta);

    list.appendChild(card);
  }
}

async function analyze() {
  setStatus('Extracting reviews…', true);
  try {
    const tabId = await getActiveTabId();
    if (!tabId) throw new Error('No active tab');

    // Helper: attempt message; if receiving end missing, inject content.js then retry
    async function extractWithFallback(tid) {
      try {
        const res = await chrome.tabs.sendMessage(tid, { type: 'EXTRACT_REVIEWS' });
        if (res && res.ok) return res;
        throw new Error(res?.error || 'Extraction failed');
      } catch (err) {
        const msg = String(err || '');
        if (/Receiving end does not exist|Could not establish connection/i.test(msg) || chrome.runtime.lastError) {
          // Programmatically inject content script, then retry
          await chrome.scripting.executeScript({ target: { tabId: tid }, files: ['content.js'] });
          const retry = await chrome.tabs.sendMessage(tid, { type: 'EXTRACT_REVIEWS' });
          if (retry && retry.ok) return retry;
          throw new Error(retry?.error || 'Extraction failed after inject');
        }
        throw err;
      }
    }

    const extract = await extractWithFallback(tabId);

    const { reviews, product } = extract.data || {};
    if (!reviews || reviews.length === 0) {
      setStatus('No reviews detected on this page.');
      renderReviews([]);
      return;
    }

    document.getElementById('title').textContent = product?.title || 'Feedback Analyzer';

    setStatus('Analyzing with backend…', true);

    const resp = await fetch('http://127.0.0.1:8000/analyze_reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviews, product }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Backend error ${resp.status}: ${t}`);
    }

    let data;
    try {
      data = await resp.json();
    } catch (parseErr) {
      const t = await resp.text();
      throw new Error(`Invalid JSON from backend: ${String(parseErr)} | body: ${t.slice(0, 200)}...`);
    }
    setStatus('Done');

    if (data) {
      try { renderAggregate(data); } catch (e) { console.error('renderAggregate failed', e, data); }
      try { renderReviews(data.reviews || []); } catch (e) { console.error('renderReviews failed', e, data); }
    }
  } catch (err) {
    console.error(err);
    setStatus(String(err), false, true);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refresh').addEventListener('click', analyze);
  analyze();
});
