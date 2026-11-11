const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/renderer.js'), 'utf8');
const advance = source.slice(source.indexOf('function advanceFavoritePlaylist('), source.indexOf('function openFavoriteListDialog'));
function setup(mode = 'off', current = 'b', ids = ['a', 'b', 'c']) {
  const context = vm.createContext({ playlistQueue: ids, favoriteVideos: ids.map(id => ({ id })),
    loopEnabled: false, currentVideoId: current, favoritePlaybackMode: { value: mode },
    played: [], loadVideo(id, fromPlaylist) { this; context.played.push([id, fromPlaylist]); }, setStatus() {} });
  vm.runInContext(advance, context);
  return context;
}
test('playlist advances in order and stops at the end without repeat', () => {
  const c = setup();
  assert.equal(c.advanceFavoritePlaylist('b'), true);
  assert.equal(c.played[0][0], 'c');
  c.currentVideoId = 'c'; c.advanceFavoritePlaylist('c');
  assert.equal(c.playlistQueue, null);
});
test('repeat all wraps and single-video Loop takes priority', () => {
  const c = setup('all', 'c');
  c.loopEnabled = true;
  assert.equal(c.advanceFavoritePlaylist('c'), false);
  assert.equal(c.played.length, 0);
  c.loopEnabled = false; c.advanceFavoritePlaylist('c');
  assert.equal(c.played[0][0], 'a');
});
test('shuffle avoids immediate repeats and supports one video', () => {
  const c = setup('shuffle'); c.advanceFavoritePlaylist('b');
  assert.ok(['a', 'c'].includes(c.played[0][0]));
  const single = setup('shuffle', 'a', ['a']); single.advanceFavoritePlaylist('a');
  assert.equal(single.played[0][0], 'a');
});
test('deleted videos are skipped and stale ended events are ignored', () => {
  const c = setup('all'); c.favoriteVideos = [{ id: 'a' }, { id: 'b' }];
  assert.equal(c.advanceFavoritePlaylist('a'), false);
  c.advanceFavoritePlaylist('b'); assert.equal(c.played[0][0], 'a');
});
