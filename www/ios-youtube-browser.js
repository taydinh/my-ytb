(() => {
  if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(location.hostname)) return;
  let selected = false;
  function select(value) {
    const bridge = window.webkit?.messageHandlers?.youtubeSelection;
    if (!bridge) return false;
    let url;
    try { url = new URL(value, location.href); } catch { return false; }
    if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) return false;
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) :
      url.pathname === '/watch' ? url.searchParams.get('v') :
        url.pathname.match(/^\/(?:shorts|live)\/([\w-]{11})\/?$/)?.[1];
    if (!/^[\w-]{11}$/.test(id || '')) return false;
    if (!selected) {
      selected = true;
      document.querySelectorAll('video, audio').forEach(media => media.pause());
      bridge.postMessage(`https://www.youtube.com/watch?v=${id}`);
    }
    return true;
  }
  document.addEventListener('click', event => {
    const link = event.target?.closest?.('a[href]');
    if (link && select(link.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name];
    history[name] = function (...args) {
      if (args[2] != null && select(args[2])) return;
      return original.apply(this, args);
    };
  }
  window.addEventListener('popstate', () => select(location.href));
  select(location.href);
})();
