const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/renderer.js'), 'utf8');
const template = source.match(/const script = (`[\s\S]*?`);\n\s*const source = player.src/)[1];

function setup({ errorText = '', errorPanel = false, pathname = '/embed/test', videoTitle = '' } = {}) {
  let ad = true;
  let clicks = 0;
  let disabled = false;
  let time = 1000;
  let tick;
  const createStyle = () => ({ values: {}, setProperty(name, value, priority) {
    this.values[name] = { value, priority };
  } });
  const video = { style: createStyle(), muted: false, volume: 0.4, playbackRate: 1.5, duration: 30,
    currentTime: 0, readyState: 1, paused: false, pause() { this.paused = true; },
    play() { this.paused = false; return Promise.resolve(); } };
  const button = { isConnected: true, getClientRects: () => [{}], closest() { return this; },
    get disabled() { return disabled; }, getAttribute: () => null, click: () => clicks++ };
  const videoContainer = { style: createStyle() };
  const root = { style: createStyle(), classList: { contains: () => ad },
    querySelector: selector => selector === '.html5-video-container' ? videoContainer : video,
    getVideoData: () => ({ title: videoTitle, isLive: false }) };
  const document = { documentElement: { style: createStyle() }, body: { style: createStyle(), innerText: errorText },
    querySelector(selector) {
      if (selector === '.ytp-error-content-wrap, .ytp-error') return errorPanel ? { innerText: errorText } : null;
      if (selector === '#movie_player, .html5-video-player') return root;
      if (selector === '#movie_player video, .html5-video-player video') return video;
      if (selector === '.ytp-ad-skip-button') return button;
      if (selector === '.ytp-title-link, .ytp-title-text') return videoTitle ? { textContent: videoTitle } : null;
      return null;
    }, querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { pathname },
    Date: { now: () => time }, MutationObserver: class { observe() {} },
    setInterval: fn => { tick = fn; }, setTimeout, clearTimeout });
  function inject({ cleanMode = true, loopEnabled = true, pendingRestore = null } = {}) {
    const script = vm.runInNewContext(template, { cleanMode, loopEnabled, pendingRestore });
    return vm.runInContext(script, context);
  }
  return { video, videoContainer, root, document, context, inject, tick: () => tick(), clicks: () => clicks,
    setAd: value => { ad = value; }, setDisabled: value => { disabled = value; }, advance: () => { time += 600; } };
}

test('ad fallback skips once, mutes, seeks; content restores sound/speed and loops', () => {
  const s = setup();
  s.inject();
  assert.equal(s.clicks(), 1);
  assert.equal(s.video.muted, true);
  assert.equal(s.video.playbackRate, 16);
  assert.equal(s.video.loop, false);
  s.tick();
  assert.equal(s.clicks(), 1);
  s.setAd(false);
  s.tick();
  assert.equal(s.video.muted, false);
  assert.equal(s.video.volume, 0.4);
  assert.equal(s.video.playbackRate, 1.5);
  assert.equal(s.video.loop, true);
});

test('recognizes the Vietnamese 152 - 4 error from the screenshot', () => {
  const result = setup({ errorText: 'Video này không hoạt động\nMã lỗi: 152 - 4', errorPanel: true }).inject();
  assert.equal(result.unavailable, true);
  assert.equal(result.errorCode, '152-4');
});

test('recognizes embed errors without a panel and English error codes', () => {
  for (const errorText of ['Mã lỗi: 152 - 4', 'Error code: 152 - 4']) {
    const result = setup({ errorText }).inject();
    assert.equal(result.unavailable, true);
    assert.equal(result.errorCode, '152-4');
  }
  assert.equal(setup({ errorText: 'Video này không hoạt động' }).inject().unavailable, true);
});

test('watch page text outside the player does not trigger a playback error', () => {
  assert.equal(setup({ errorText: 'Video unavailable Error code: 153', pathname: '/watch' }).inject().unavailable, false);
  assert.equal(setup().inject().unavailable, false);
});

test('watch fallback is forced to fill the viewport at every window size', () => {
  const s = setup({ pathname: '/watch' });
  const result = s.inject();
  assert.equal(result.directWatch, true);
  assert.deepEqual(s.root.style.values.position, { value: 'fixed', priority: 'important' });
  assert.deepEqual(s.root.style.values.width, { value: '100vw', priority: 'important' });
  assert.deepEqual(s.root.style.values.height, { value: '100vh', priority: 'important' });
  assert.deepEqual(s.video.style.values['object-fit'], { value: 'contain', priority: 'important' });
  assert.deepEqual(s.videoContainer.style.values.inset, { value: '0', priority: 'important' });
  assert.deepEqual(s.document.body.style.values.overflow, { value: 'hidden', priority: 'important' });
});

test('disabled Skip is not clicked and turning helper off restores media', () => {
  const s = setup();
  s.setDisabled(true);
  s.inject();
  assert.equal(s.clicks(), 0);
  s.inject({ cleanMode: false });
  assert.equal(s.video.muted, false);
  assert.equal(s.video.playbackRate, 1.5);
  s.advance();
  s.tick();
  assert.equal(s.clicks(), 0);
});

test('returns the player title only after ads finish', () => {
  const s = setup({ videoTitle: 'Bài hát test' });
  assert.equal(s.inject().title, '');
  s.setAd(false);
  s.tick();
  assert.equal(s.inject().title, 'Bài hát test');
});

test('reload restore waits through ads and restores position and paused state only once', () => {
  const s = setup();
  const pendingRestore = { time: 12, muted: true, volume: 0.7, rate: 2, paused: true };
  s.inject({ pendingRestore });
  assert.notEqual(s.video.currentTime, 12);
  s.setAd(false);
  s.tick();
  assert.equal(s.video.currentTime, 12);
  assert.equal(s.video.paused, true);
  assert.equal(s.video.playbackRate, 2);
  s.video.currentTime = 15;
  s.inject({ pendingRestore });
  s.tick();
  assert.equal(s.video.currentTime, 15);
});
