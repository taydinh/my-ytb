(() => {
  // Injected by WKWebView into frames; never run on unrelated websites.
  if (!['www.youtube.com', 'www.youtube-nocookie.com', 'm.youtube.com', 'youtube.com'].includes(location.hostname)) return;
  if (window.__floatingAutoSkip) return;
  window.__floatingAutoSkip = true;

  const selectors = '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-container button';
  const lastClicks = new WeakMap();
  let timer;

  function skip() {
    if (document.hidden) return;
    for (const button of document.querySelectorAll(selectors)) {
      const style = getComputedStyle(button);
      if (button.disabled || button.getAttribute('aria-disabled') === 'true' ||
          button.closest('[hidden], [aria-hidden="true"]') ||
          !button.getClientRects().length || style.visibility !== 'visible' ||
          style.display === 'none' || Number(style.opacity) === 0) continue;
      const now = Date.now();
      if (now - (lastClicks.get(button) ?? -Infinity) < 1000) continue;
      lastClicks.set(button, now);
      button.click();
      break;
    }
  }

  function start() {
    clearInterval(timer);
    skip();
    timer = setInterval(skip, 500);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(timer);
    else start();
  });
  window.addEventListener('pagehide', () => clearInterval(timer));
  window.addEventListener('pageshow', start);
  start();
})();
