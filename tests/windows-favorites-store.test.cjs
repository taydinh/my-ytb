const test = require('node:test');
const assert = require('node:assert/strict');

const FavoritesStore = require('../src/favorites-store.js');

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null,
    setItem: (key, value) => { data[key] = String(value); },
    data
  };
}

test('favorites are sanitized, de-duplicated, and persisted locally', () => {
  const storage = memoryStorage({
    favoriteVideos: JSON.stringify([
      { id: 'abc123', title: '  Một   video  ', duration: 62, channelName: ' Kênh   hay ', channelUrl: 'https://www.youtube.com/@kenhhay' },
      { id: 'abc123', title: 'Bản sao' },
      { title: 'Thiếu id' }
    ])
  });
  const favorites = FavoritesStore.load(storage);
  assert.equal(favorites.length, 1);
  assert.equal(favorites[0].title, 'Một video');
  assert.equal(favorites[0].duration, 62);
  assert.match(favorites[0].thumbnail, /abc123/);
  assert.equal(favorites[0].channelName, 'Kênh hay');
  assert.equal(favorites[0].channelUrl, 'https://www.youtube.com/@kenhhay');
  FavoritesStore.save(storage, favorites);
  assert.equal(JSON.parse(storage.data.favoriteVideos).length, 1);
});

test('unsafe channel URLs are discarded', () => {
  assert.equal(FavoritesStore.sanitizeChannelUrl('https://example.com/@fake'), '');
  assert.equal(FavoritesStore.sanitizeChannelUrl('javascript:alert(1)'), '');
  assert.equal(FavoritesStore.sanitizeChannelUrl('https://youtube.com/watch?v=abc'), '');
});

test('duration formatting supports minutes and hours', () => {
  assert.equal(FavoritesStore.formatDuration(0), '--:--');
  assert.equal(FavoritesStore.formatDuration(62), '1:02');
  assert.equal(FavoritesStore.formatDuration(3661), '1:01:01');
});

test('favorites can be reordered without mutating the source list', () => {
  const source = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const moved = FavoritesStore.move(source, 2, 0);
  assert.deepEqual(moved.map(item => item.id), ['c', 'a', 'b']);
  assert.deepEqual(source.map(item => item.id), ['a', 'b', 'c']);
});
