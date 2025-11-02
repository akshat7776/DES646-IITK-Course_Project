// content.js
// Extracts reviews from product page at http://localhost:3000/products/*

function extractReviewsFromDOM() {
  // Find the "Customer Feedback" section
  const headings = Array.from(document.querySelectorAll('h2'));
  const feedbackHeader = headings.find(h => /customer feedback/i.test(h.textContent || ''));

  const root = feedbackHeader ? feedbackHeader.parentElement?.parentElement : document.body;
  const container = root || document;

  // Strategy: find review cards by nearby structure
  // - Review text appears in <p class="italic"> "text" inside cards
  // - Author often in <p class="font-headline"> within the same card
  // - Rating is rendered as stars, not numeric; set null when not parseable

  const reviewTextNodes = Array.from(container.querySelectorAll('p.italic'));

  const reviews = reviewTextNodes.map(node => {
    const card = node.closest('.shadow-sm') || node.closest('div');
    const textRaw = (node.textContent || '').trim();
    const text = textRaw.replace(/^\"+|\"+$/g, '').replace(/^"+|"+$/g, '');

    // Author
    let author = null;
    if (card) {
      const a = card.querySelector('p.font-headline');
      if (a && a.textContent) author = a.textContent.trim();
    }

    // Rating (not directly available in DOM as number). Attempt to infer by counting amber stars.
    let rating = null;
    if (card) {
      const starContainer = card.querySelector('div.text-amber-400');
      if (starContainer) {
        const fullStars = starContainer.querySelectorAll('svg.w-4.h-4.fill-current').length;
        // If we detect any star icons, at least set the integer count
        if (fullStars > 0) rating = fullStars;
      }
    }

    return { text, rating, author };
  }).filter(r => r.text && r.text.trim().length > 0);

  // Limit to avoid overwhelming the popup UI
  const limited = reviews.slice(0, 100);

  const product = {
    title: document.title || '',
    url: location.href,
  };

  return { reviews: limited, product };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'EXTRACT_REVIEWS') {
    try {
      const data = extractReviewsFromDOM();
      sendResponse({ ok: true, data });
    } catch (err) {
      console.error('EXTRACT_REVIEWS failed', err);
      sendResponse({ ok: false, error: String(err) });
    }
    return true; // keep channel open for async
  }
});

// ---------------- Inline per-review analysis UI -----------------
// Configurable selectors to find review cards and parts on the page
const FA_SEL = {
  card: ['.shadow-sm', '[data-testid="review-card"]', '.review-card', '.feedback-card', 'li[data-review]'],
  text: ['p.italic', '[data-testid="review-text"]', '.review-text', 'blockquote', 'p'],
  rating: ['div.text-amber-400', '[data-testid="rating"]', '.rating', '[aria-label*="star"]', '[aria-label*="stars"]'],
  author: ['p.font-headline', '[data-testid="author"]', '.author', '.user', 'cite']
};

function fa_q1(root, selectors) {
  for (const s of selectors) {
    const el = root.querySelector(s);
    if (el) return el;
  }
  return null;
}

function fa_parseRating(el) {
  if (!el) return null;
  const aria = el.getAttribute('aria-label') || '';
  const m = aria.match(/(\d+(?:\.\d+)?)/);
  if (m) return Number(m[1]);
  const filled = el.querySelectorAll('svg.w-4.h-4.fill-current, svg[fill="currentColor"], .star.filled, .star-full').length;
  const total = el.querySelectorAll('svg, .star').length || 5;
  if (filled > 0) return Math.min(filled, total);
  return null;
}

function fa_extractCard(card) {
  const textEl = fa_q1(card, FA_SEL.text);
  const ratingEl = fa_q1(card, FA_SEL.rating);
  const authorEl = fa_q1(card, FA_SEL.author);
  const raw = (textEl?.textContent || '').trim();
  if (!raw) return null;
  const text = raw.replace(/^\"+|\"+$/g, '').replace(/^"+|"+$/g, '');
  return {
    text,
    rating: fa_parseRating(ratingEl),
    author: (authorEl?.textContent || '').trim() || null,
  };
}

function fa_injectStyles() {
  if (document.getElementById('fa-inline-style')) return;
  const css = `
  .fa-mini-btn { font: 12px/1.2 system-ui; padding:4px 6px; border:1px solid #e5e7eb; border-radius:6px; background:#fff; cursor:pointer; }
  .fa-panel { margin-top:6px; border:1px solid #e5e7eb; border-radius:8px; padding:8px; background:#fafafa; }
  .fa-chips { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
  .fa-chip { font-size:11px; background:#f3f4f6; padding:3px 6px; border-radius:999px; }
  `;
  const style = document.createElement('style');
  style.id = 'fa-inline-style';
  style.textContent = css;
  document.head.appendChild(style);
}

async function fa_analyzeOne(review) {
  const resp = await fetch('http://127.0.0.1:8000/analyze_review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review)
  });
  if (!resp.ok) throw new Error(`Backend ${resp.status}`);
  return await resp.json();
}

function fa_renderPanel(card, result) {
  let panel = card.querySelector(':scope > .fa-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'fa-panel';
    card.appendChild(panel);
  }
  panel.innerHTML = `
    <div>${result.review || ''}</div>
    <div class="fa-chips">
      <span class="fa-chip">Sentiment: ${result.sentiment ?? '-'}</span>
      <span class="fa-chip">Emotion: ${result.emotion ?? '-'}</span>
      <span class="fa-chip">Intent: ${result.intent ?? '-'}</span>
      <span class="fa-chip">NPS: ${typeof result.nps === 'number' ? Number(result.nps).toFixed(1) : '-'}</span>
      <span class="fa-chip">Buy Again: ${result.buy_again ?? '-'}</span>
    </div>
    ${result.reply ? `<div style="margin-top:6px;"><strong>Reply:</strong> ${result.reply}</div>` : ''}
  `;
}

function fa_attachButton(card) {
  if (card.querySelector(':scope > .fa-mini-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'fa-mini-btn';
  btn.textContent = 'Analyze';
  btn.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const review = fa_extractCard(card);
    if (!review) return;
    btn.disabled = true; btn.textContent = 'Analyzing…';
    try {
      const out = await fa_analyzeOne(review);
      fa_renderPanel(card, out);
    } catch (err) {
      fa_renderPanel(card, { review: review.text, sentiment: '-', emotion: '-', intent: '-', nps: '-', buy_again: '-', reply: String(err) });
    } finally {
      btn.disabled = false; btn.textContent = 'Analyze';
    }
  });
  card.insertBefore(btn, card.firstChild);
}

function fa_getFeedbackContainer() {
  // Find the H2 header and then the list container below it (frontend uses 'space-y-6')
  const headings = Array.from(document.querySelectorAll('h2'));
  const feedbackHeader = headings.find(h => /customer feedback/i.test(h.textContent || ''));
  if (!feedbackHeader) return null;
  const parent = feedbackHeader.parentElement;
  if (!parent) return null;
  // Prefer the sibling list
  let list = feedbackHeader.nextElementSibling;
  if (list && list.matches('.space-y-6')) return list;
  // Fallback: search within the same parent for a likely list container
  list = parent.querySelector('.space-y-6');
  return (list || null);
}

function fa_scanAndInject() {
  fa_injectStyles();
  const container = fa_getFeedbackContainer();
  if (!container) return; // Only inject on the feedback section of product page

  const cardSel = FA_SEL.card.join(',');
  const textSel = FA_SEL.text.join(',');
  const cards = Array.from(container.querySelectorAll(cardSel))
    .filter(card => card.querySelector(textSel)); // only true review cards

  cards.forEach(fa_attachButton);
}

// Initial run and observe DOM changes (Next.js can stream/rehydrate)
try {
  fa_scanAndInject();
  const mo = new MutationObserver(() => fa_scanAndInject());
  mo.observe(document.body, { childList: true, subtree: true });
} catch (e) {
  // Non-fatal; popup still works
  console.warn('FA inline injection failed', e);
}
