// background.js (service worker)
// Minimal setup; can relay messages if needed.

chrome.runtime.onInstalled.addListener(() => {
  console.log('Feedback Analyzer – Extension installed');
});

// Optional relay between popup and content if needed in future
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'PING') {
    sendResponse({ ok: true, pong: true });
    return true;
  }
});
