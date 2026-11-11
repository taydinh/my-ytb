(function exposeHistoryStore(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./favorites-store.js') : root.FavoritesStore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HistoryStore = api;
})(typeof window !== 'undefined' ? window : globalThis, function createHistoryStoreApi(favorites) {
  const STORAGE_KEY = 'watchedVideos';
  const LIMIT = 100;

  function normalize(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).map(favorites.sanitize).filter(Boolean)
      .sort((a, b) => b.addedAt - a.addedAt)
      .filter((item) => !seen.has(item.id) && seen.add(item.id)).slice(0, LIMIT);
  }

  function load(storage) {
    try { return normalize(JSON.parse(storage.getItem(STORAGE_KEY) || '[]')); }
    catch { return []; }
  }

  function save(storage, items) {
    const clean = normalize(items);
    storage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return clean;
  }

  function record(storage, items, video, now = Date.now()) {
    return save(storage, [{ ...video, addedAt: now, customTitle: false }, ...items.filter((item) => item.id !== video.id)]);
  }

  return { STORAGE_KEY, LIMIT, load, save, record };
});
