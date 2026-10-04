const { ipcRenderer } = require('electron');

function selectedVideoUrl(target) {
  const path = target?.composedPath?.() || [];
  const anchor = path.find((node) => node?.tagName === 'A' && node.href)
    || target?.target?.closest?.('a[href]');
  if (!anchor?.href) return null;
  try {
    const url = new URL(anchor.href, location.href);
    if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return null;
    if (url.pathname === '/watch' && url.searchParams.get('v')) return url.href;
    if (/^\/(shorts|live)\/[^/]+/i.test(url.pathname)) return url.href;
  } catch {}
  return null;
}

window.addEventListener('click', (event) => {
  if (event.button !== 0) return;
  const url = selectedVideoUrl(event);
  if (!url) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  ipcRenderer.sendToHost('youtube-video-selected', url);
}, { capture: true, passive: false });
