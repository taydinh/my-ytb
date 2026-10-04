(function exposeFavoritesStore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FavoritesStore = api;
})(typeof window !== 'undefined' ? window : globalThis, function createFavoritesStoreApi() {
  const STORAGE_KEY = 'favoriteVideos';

  function sanitizeChannelUrl(value) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:' || !/^(?:www\.)?youtube\.com$/i.test(url.hostname)) return '';
      if (!/^\/(?:channel\/[^/?#]+|@[^/?#]+)\/?$/i.test(url.pathname)) return '';
      return `${url.origin}${url.pathname}`;
    } catch {
      return '';
    }
  }

  function sanitize(item) {
    if (!item || typeof item.id !== 'string' || !item.id.trim()) return null;
    const id = item.id.trim();
    return {
      id,
      title: String(item.title || 'Video chưa có tiêu đề').replace(/\s+/g, ' ').trim(),
      duration: Number.isFinite(Number(item.duration)) ? Math.max(0, Math.round(Number(item.duration))) : 0,
      thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`,
      addedAt: Number(item.addedAt) || Date.now(),
      customTitle: Boolean(item.customTitle),
      channelName: String(item.channelName || '').replace(/\s+/g, ' ').trim(),
      channelUrl: sanitizeChannelUrl(item.channelUrl)
    };
  }

  function load(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      const seen = new Set();
      return parsed.map(sanitize).filter((item) => item && !seen.has(item.id) && seen.add(item.id));
    } catch {
      return [];
    }
  }

  function save(storage, items) {
    const clean = Array.isArray(items) ? items.map(sanitize).filter(Boolean) : [];
    storage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return clean;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    if (!total) return '--:--';
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  function move(items, from, to) {
    const copy = [...items];
    if (from < 0 || to < 0 || from >= copy.length || to >= copy.length || from === to) return copy;
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  }

  return { STORAGE_KEY, sanitize, sanitizeChannelUrl, load, save, formatDuration, move };
});
