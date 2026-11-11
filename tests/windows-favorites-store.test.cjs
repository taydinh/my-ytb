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

test('list membership survives metadata updates and saving old favorites', () => {
  const storage = memoryStorage();
  const old = FavoritesStore.sanitize({ id: 'old' });
  assert.equal(old.listId, '');
  const saved = FavoritesStore.save(storage, [{ ...old, listId: 'music', title: 'Updated' }]);
  assert.equal(saved[0].listId, 'music');
  assert.equal(FavoritesStore.load(storage)[0].listId, 'music');
});

test('favorite lists persist independently including empty lists and reject malformed entries', () => {
  const storage = memoryStorage();
  assert.deepEqual(FavoritesStore.loadLists(storage), []);
  FavoritesStore.saveLists(storage, [{ id: 'music', name: '  Nhạc   hay ' }, { id: 'music', name: 'Duplicate' }, { id: 'empty', name: ' ' }, null]);
  assert.deepEqual(FavoritesStore.loadLists(storage), [{ id: 'music', name: 'Nhạc hay' }]);
  storage.setItem('favoriteLists', '{broken');
  assert.deepEqual(FavoritesStore.loadLists(storage), []);
});

test('renaming a list preserves its id and video membership after reload', () => {
  const storage = memoryStorage();
  FavoritesStore.saveLists(storage, [{ id: 'music', name: 'Nhạc' }]);
  FavoritesStore.save(storage, [{ id: 'a', listId: 'music' }]);
  FavoritesStore.saveLists(storage, FavoritesStore.loadLists(storage).map(list => ({ ...list, name: 'Nhạc mới' })));
  assert.deepEqual(FavoritesStore.loadLists(storage), [{ id: 'music', name: 'Nhạc mới' }]);
  assert.equal(FavoritesStore.load(storage)[0].listId, 'music');
});

test('deleting only a list keeps its videos and clears membership without mutating input', () => {
  const lists = [{ id: 'music', name: 'Nhạc' }, { id: 'other', name: 'Khác' }];
  const videos = [{ id: 'a', listId: 'music' }, { id: 'b', listId: 'other' }, { id: 'c', listId: '' }];
  const result = FavoritesStore.removeList(lists, videos, 'music');
  assert.deepEqual(result.lists, [lists[1]]);
  assert.deepEqual(result.videos, [{ id: 'a', listId: '' }, videos[1], videos[2]]);
  assert.equal(videos[0].listId, 'music');
  assert.equal(lists.length, 2);
  const storage = memoryStorage();
  FavoritesStore.saveLists(storage, result.lists);
  FavoritesStore.save(storage, result.videos);
  assert.equal(FavoritesStore.load(storage).length, 3);
  assert.equal(FavoritesStore.load(storage)[0].listId, '');
  assert.deepEqual(FavoritesStore.loadLists(storage), [lists[1]]);
});

test('deleting a list with videos removes only its members from favorites', () => {
  const lists = [{ id: 'music', name: 'Nhạc' }, { id: 'other', name: 'Khác' }];
  const videos = [{ id: 'a', listId: 'music' }, { id: 'b', listId: 'other' }, { id: 'c', listId: 'music' }, { id: 'd', listId: '' }];
  const result = FavoritesStore.removeList(lists, videos, 'music', true);
  assert.deepEqual(result.videos, [videos[1], videos[3]]);
  assert.deepEqual(result.lists, [lists[1]]);
  assert.equal(videos.length, 4);
  const storage = memoryStorage();
  FavoritesStore.save(storage, result.videos);
  assert.deepEqual(FavoritesStore.load(storage).map(video => video.id), ['b', 'd']);
  assert.deepEqual(FavoritesStore.removeList(lists, videos, 'missing', true), { lists, videos });
  assert.deepEqual(FavoritesStore.removeList([{ id: 'empty', name: 'Trống' }], videos, 'empty', true), { lists: [], videos });
});
