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
