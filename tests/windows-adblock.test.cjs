const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { FiltersEngine, Request } = require('@ghostery/adblocker');
const { createAdblock } = require('../src/adblock');

function setup(t, settings) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ytfp-adblock-'));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const bundledPath = path.join(userData, 'bundled.bin');
  fs.writeFileSync(bundledPath, 'valid');
  if (settings) fs.writeFileSync(path.join(userData, 'adblock-settings.json'), JSON.stringify(settings));
  const calls = [];
  const engine = {
    enableBlockingInSession: () => calls.push('enable'),
    disableBlockingInSession: () => calls.push('disable'),
    serialize: () => Buffer.from('updated')
  };
  const ElectronBlocker = {
    deserialize: bytes => { if (Buffer.from(bytes).toString() !== 'valid') throw Error('corrupt'); return engine; },
    fromPrebuiltAdsOnly: async () => engine
  };
  const args = { ElectronBlocker, session: {}, userData, bundledPath };
  return { ...args, calls, controller: createAdblock(args), args };
}

test('enabled before navigation; toggle is idempotent and persists across restart', t => {
  const s = setup(t);
  assert.equal(s.controller.initialize().active, true);
  s.controller.setEnabled(true);
  s.controller.setEnabled(false);
  s.controller.setEnabled(false);
  assert.deepEqual(s.calls, ['enable', 'disable']);
  assert.deepEqual(createAdblock(s.args).initialize(), { enabled: false, active: false, error: '' });
  assert.throws(() => s.controller.setEnabled('true'), TypeError);
});

test('corrupt cache falls back to bundle and is refreshed without swapping active session', async t => {
  const s = setup(t);
  const cache = path.join(s.userData, 'adblock-engine.bin');
  fs.writeFileSync(cache, 'corrupt');
  assert.equal(s.controller.initialize().active, true);
  await s.controller.refresh();
  assert.equal(fs.readFileSync(cache, 'utf8'), 'updated');
  assert.deepEqual(s.calls, ['enable']);
});

test('missing filters fail open with visible error', t => {
  const s = setup(t);
  fs.unlinkSync(s.bundledPath);
  const state = s.controller.initialize();
  assert.equal(state.active, false);
  assert.match(state.error, /tự Skip/);
  assert.deepEqual(s.calls, []);
});

test('offline update preserves current filters and persisted cache', async t => {
  const s = setup(t);
  s.controller.initialize();
  s.ElectronBlocker.fromPrebuiltAdsOnly = async () => { throw Error('offline'); };
  await assert.rejects(s.controller.refresh(), /offline/);
  assert.equal(s.controller.getState().active, true);
  assert.deepEqual(s.calls, ['enable']);
});

test('disabled preference does not download filters', async t => {
  const s = setup(t, { enabled: false });
  s.ElectronBlocker.fromPrebuiltAdsOnly = () => { throw Error('must not fetch'); };
  assert.equal(s.controller.initialize().active, false);
  await s.controller.refresh();
  assert.deepEqual(s.calls, []);
});

test('bundled real filters block ads while allowing YouTube documents and content media', () => {
  const engine = FiltersEngine.deserialize(new Uint8Array(fs.readFileSync(path.join(__dirname, '../assets/adblock-engine.bin'))));
  const match = (url, type) => engine.match(Request.fromRawDetails({ url, type, sourceUrl: 'https://www.youtube.com/watch?v=abc' })).match;
  assert.equal(match('https://googleads.g.doubleclick.net/pagead/id', 'script'), true);
  assert.equal(match('https://www.youtube.com/embed/abc', 'main_frame'), false);
  assert.equal(match('https://www.youtube.com/watch?v=abc', 'main_frame'), false);
  assert.equal(match('https://rr1---sn-a5mekn7z.googlevideo.com/videoplayback?id=abc', 'media'), false);
});
