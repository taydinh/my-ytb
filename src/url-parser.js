(function exposeUrlParser(root) {
  function extractVideoId(value) {
    const input = String(value || '').trim();
    if (/^[\w-]{11}$/.test(input)) return input;
    const validId = (candidate) => (/^[\w-]{11}$/.test(candidate || '') ? candidate : null);
    try {
      const url = new URL(input.startsWith('http') ? input : `https://${input}`);
      const host = url.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') return validId(url.pathname.split('/').filter(Boolean)[0]);
      if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
        if (url.pathname === '/watch') return validId(url.searchParams.get('v'));
        const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/);
        return validId(match?.[1]);
      }
    } catch {}
    return null;
  }

  function extractBrowsableVideoId(value) {
    try {
      const url = new URL(String(value || '').trim());
      const host = url.hostname.replace(/^www\./, '');
      if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return null;
      if (url.pathname === '/watch') return extractVideoId(url.href);
      if (/^\/(?:shorts|live)\//.test(url.pathname)) return extractVideoId(url.href);
    } catch {}
    return null;
  }

  const api = { extractVideoId, extractBrowsableVideoId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.YouTubeUrl = api;
})(typeof window !== 'undefined' ? window : globalThis);
