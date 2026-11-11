const test = require('node:test');
const assert = require('node:assert/strict');
const History = require('../src/history-store');
function storage() {
  const data = {};
  return { getItem: key => data[key], setItem: (key, value) => { data[key] = value; } };
}
test('history keeps the latest 100 videos and persists their metadata', () => {
  const local = storage();
  let items = [];
  for (let i = 1; i <= 105; i++) {
    items = History.record(local, items, { id: String(i), title: `Video ${i}`, duration: 62, channelName: 'Channel', channelUrl: 'https://www.youtube.com/@channel' }, i);
  }
  assert.equal(items.length, 100);
  assert.equal(items[0].id, '105');
  assert.equal(items[99].id, '6');
  assert.deepEqual(History.load(local), items);
  assert.equal(items[0].duration, 62);
  assert.equal(items[0].channelName, 'Channel');
});
test('watching again moves an existing video to the top without duplicates', () => {
  const local = storage();
  let items = History.record(local, [], { id: 'a', title: 'First' }, 1);
  items = History.record(local, items, { id: 'b' }, 2);
  items = History.record(local, items, { ...items[1], title: 'Updated' }, 3);
  assert.deepEqual(items.map(item => item.id), ['a', 'b']);
  assert.equal(items[0].title, 'Updated');
  assert.equal(items[0].addedAt, 3);
});
test('history handles corrupted storage and sorts and deduplicates saved records', () => {
  const local = storage();
  local.setItem(History.STORAGE_KEY, '{');
  assert.deepEqual(History.load(local), []);
  const items = History.save(local, [{id: 'a', addedAt: 1}, null, {id: 'b', addedAt: 2}, {id: 'a', addedAt: 3}]);
  assert.deepEqual(items.map(item => item.id), ['a', 'b']);
  assert.equal(items[0].addedAt, 3);
});
