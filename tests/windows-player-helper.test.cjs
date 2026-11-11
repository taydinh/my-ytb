const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { DEFAULTS: AMBIENT_DEFAULTS } = require('../src/ambient-settings');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/renderer.js'), 'utf8');
const template = source.match(/const script = (`[\s\S]*?`);\r?\n\s*const source = player.src/)[1];

function setup({ errorText = '', errorPanel = false, pathname = '/embed/test', videoTitle = '' } = {}) {
  let ad = true;
  let clicks = 0;
  let disabled = false;
  let time = 1000;
  let tick;
  let frame;
  const createStyle = () => ({ values: {}, setProperty(name, value, priority) {
    this.values[name] = { value, priority };
  } });
  const video = { style: createStyle(), muted: false, volume: 0.4, playbackRate: 1.5, duration: 30,
    currentTime: 0, readyState: 1, paused: false, pause() { this.paused = true; },
    play() { this.paused = false; return Promise.resolve(); } };
  const button = { isConnected: true, getClientRects: () => [{}], closest() { return this; },
    get disabled() { return disabled; }, getAttribute: () => null, click: () => clicks++ };
  const videoContainer = { style: createStyle() };
  let ambientWrap;
  let frameData = new Uint8ClampedArray(128 * 128 * 4).fill(200);
  let ambientDraws = 0;
  const drawCalls = [];
  const root = { style: createStyle(), classList: { contains: () => ad },
    querySelector: selector => selector === '#__ytfp_ambient_wrap' ? ambientWrap : selector === '.html5-video-container' ? videoContainer : video,
    prepend: element => { ambientWrap = element; },
    getVideoData: () => ({ title: videoTitle, isLive: false }) };
  const classes = new Set();
  const document = { adoptedStyleSheets: [], documentElement: { style: createStyle(), classList: {
      contains: name => classes.has(name), toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); } } }, body: { style: createStyle(), innerText: errorText },
    createElement: () => ({ isConnected: true, style: {}, dataset: {}, setAttribute() {}, append(...children) { this.children = children; },
      remove() { ambientWrap = undefined; }, getContext: () => ({
        drawImage: (...args) => { ambientDraws++; drawCalls.push(args.slice(1)); }, getImageData: () => ({ data: frameData })
      }) }),
    querySelector(selector) {
      if (selector === '.ytp-error-content-wrap, .ytp-error') return errorPanel ? { innerText: errorText } : null;
      if (selector === '#movie_player, .html5-video-player') return root;
      if (selector === '#movie_player video, .html5-video-player video' || selector === '#movie_player video') return video;
      if (selector === '.ytp-ad-skip-button') return button;
      if (selector === '.ytp-title-link, .ytp-title-text') return videoTitle ? { textContent: videoTitle } : null;
      return null;
    }, querySelectorAll: () => [] };
  const context = vm.createContext({ document, location: { pathname },
    Date: { now: () => time }, MutationObserver: class { observe() {} },
    setInterval: fn => { tick = fn; }, setTimeout, clearTimeout,
    requestAnimationFrame: fn => { frame = fn; return 1; }, cancelAnimationFrame: () => { frame = null; },
    CSSStyleSheet: class { replaceSync(text) { this.text = text; } } });
  function inject({ cleanMode = true, loopEnabled = true, pendingRestore = null, youtubeView = false, playerViewMode = youtubeView ? 'youtube' : 'video', ambient = {} } = {}) {
    // Most helper tests cover the classic glow; extend mode has its own test.
    const ambientSettings = { ...AMBIENT_DEFAULTS, fps: 0, extend: false, ...ambient };
    const script = vm.runInNewContext(template, { cleanMode, loopEnabled, pendingRestore, youtubeView, playerViewMode, playlistGeneration: 0, ambientSettings });
    return vm.runInContext(script, context);
  }
  return { video, videoContainer, root, document, classes, context, inject, tick: () => tick(),
    frame: () => { const next = frame; frame = null; next?.(); return Boolean(next); }, clicks: () => clicks,
    ambient: () => ambientWrap?.children[0], wrap: () => ambientWrap, ambientDraws: () => ambientDraws, drawCalls, setFrame: data => { frameData = data; },
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

test('watch fallback is forced to fill the viewport with one adopted stylesheet', () => {
  const s = setup({ pathname: '/watch' });
  const result = s.inject();
  assert.equal(result.directWatch, true);
  assert.equal(s.document.adoptedStyleSheets.length, 1);
  const css = s.document.adoptedStyleSheets[0].text;
  assert.match(css, /html\.__ytfp-fit #movie_player\{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important/);
  assert.match(css, /object-fit:contain!important/);
  assert.match(css, /html\.__ytfp-fit,html\.__ytfp-fit body\{[^}]*overflow:hidden!important/);
  assert.deepEqual([...s.classes], ['__ytfp-fit']);
  s.inject();
  assert.equal(s.document.adoptedStyleSheets.length, 1);
});

test('YouTube view preserves the native watch layout while playback helpers still work', () => {
  const s = setup({ pathname: '/watch' });
  s.inject({ youtubeView: true });
  assert.deepEqual([...s.classes], []);
  assert.equal(s.clicks(), 1);
  s.setAd(false);
  s.tick();
  assert.equal(s.video.loop, true);
  assert.deepEqual([...s.classes], []);
});

test('view modes switch in place on the same page, without a reload', () => {
  const s = setup({ pathname: '/watch' });
  s.setAd(false);
  s.video.readyState = 2;
  s.inject({ youtubeView: true });
  assert.deepEqual([...s.classes], []);
  s.inject({ playerViewMode: 'ambient' });
  assert.deepEqual([...s.classes].sort(), ['__ytfp-ambient', '__ytfp-fit']);
  s.tick();
  assert.ok(s.ambient());
  s.inject();
  assert.deepEqual([...s.classes], ['__ytfp-fit']);
  s.tick();
  assert.equal(s.ambient(), undefined);
  assert.equal(s.frame(), false);
  s.inject({ youtubeView: true });
  assert.deepEqual([...s.classes], []);
});

test('ambient view blends content frames smoothly, settles when paused and hides ads', () => {
  const s = setup();
  s.inject({ playerViewMode: 'ambient' });
  assert.equal(s.ambientDraws(), 0);
  assert.equal(s.ambient().style.opacity, '0');
  assert.match(s.document.adoptedStyleSheets[0].text, /#__ytfp_ambient\{[^}]*animation:__ytfpAmbientDrift var\(--ytfp-motion-dur/);
  assert.ok(s.classes.has('__ytfp-ambient'));
  s.setAd(false);
  s.video.readyState = 2;
  s.tick();
  assert.equal(s.ambientDraws(), 0);
  assert.equal(s.frame(), true);
  assert.equal(s.ambientDraws(), 1);
  assert.equal(s.ambient().style.opacity, '1');
  // Playing video keeps the animation loop running every frame.
  assert.equal(s.frame(), true);
  assert.equal(s.ambientDraws(), 2);
  // A paused, unchanged frame keeps blending briefly, then the loop stops.
  s.video.paused = true;
  let frames = 0;
  while (s.frame()) frames++;
  assert.ok(frames > 30 && frames < 120, String(frames));
  const settled = s.ambientDraws();
  s.tick();
  assert.equal(s.frame(), false);
  // Seeking while paused restarts blending.
  s.video.currentTime = 12;
  s.tick();
  assert.equal(s.frame(), true);
  assert.equal(s.ambientDraws(), settled + 1);
  s.setAd(true);
  s.tick();
  assert.equal(s.ambient().style.opacity, '0');
  assert.equal(s.frame(), true);
  assert.equal(s.ambientDraws(), settled + 1);
});

test('ambient settings become live CSS variables on the page', () => {
  const s = setup({ pathname: '/watch' });
  s.inject({ playerViewMode: 'ambient', ambient: { videoSize: 80, top: false, blur: 60, motion: false, shadowSize: 0, videoContrast: 120 } });
  const vars = Object.fromEntries(Object.entries(s.document.documentElement.style.values).map(([name, item]) => [name, item.value]));
  assert.equal(vars['--ytfp-size'], '80%');
  assert.equal(vars['--ytfp-inset'], '10%');
  assert.equal(vars['--ytfp-dir-clip'], 'inset(10% 0 0 0)');
  assert.equal(vars['--ytfp-blur'], '60px');
  assert.equal(vars['--ytfp-shadow'], 'none');
  assert.equal(vars['--ytfp-video-filter'], 'brightness(1) contrast(1.2) saturate(1)');
  assert.equal(vars['--ytfp-amt'], '0');
  assert.ok(s.classes.has('__ytfp-still'));
  s.inject({ playerViewMode: 'ambient' });
  assert.equal(s.document.documentElement.style.values['--ytfp-size'].value, '86%');
  assert.equal(s.classes.has('__ytfp-still'), false);
});

test('black bar removal needs two matching samples, then crops glow and clips the bars', () => {
  const s = setup({ pathname: '/watch' });
  const data = new Uint8ClampedArray(128 * 128 * 4).fill(200);
  data.fill(0, 0, 16 * 128 * 4);
  data.fill(0, 112 * 128 * 4);
  s.setFrame(data);
  Object.assign(s.video, { readyState: 2, videoWidth: 1280, videoHeight: 720, clientWidth: 1280, clientHeight: 720 });
  s.setAd(false);
  const settings = { playerViewMode: 'ambient', ambient: { removeBars: true } };
  s.inject(settings);
  s.tick();
  s.frame();
  s.inject(settings);
  assert.equal(s.document.documentElement.style.values['--ytfp-video-clip'].value, 'none');
  s.advance();
  s.advance();
  s.frame();
  s.inject(settings);
  assert.equal(s.document.documentElement.style.values['--ytfp-video-clip'].value, 'inset(93px 0px 93px 0px)');
  // A completely black frame (fade to black) keeps the last bars.
  s.setFrame(new Uint8ClampedArray(128 * 128 * 4));
  s.advance();
  s.advance();
  s.frame();
  s.inject(settings);
  assert.equal(s.document.documentElement.style.values['--ytfp-video-clip'].value, 'inset(93px 0px 93px 0px)');
  s.inject({ playerViewMode: 'ambient' });
  s.tick();
  assert.equal(s.document.documentElement.style.values['--ytfp-video-clip'].value, 'none');
});

test('extend mode draws the frame where the video sits and stretches its edges outwards', () => {
  const s = setup({ pathname: '/watch' });
  Object.assign(s.video, { readyState: 2, videoWidth: 1600, videoHeight: 900,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 450 }) });
  s.setAd(false);
  const settings = { playerViewMode: 'ambient', ambient: { extend: true, blur: 0, resolution: 160 } };
  s.inject(settings);
  assert.ok(s.classes.has('__ytfp-extend'));
  s.wrap().getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 550 });
  s.tick();
  s.frame();
  assert.equal(s.ambient().height, 88);
  const calls = s.drawCalls.filter(call => call.length === 8);
  assert.equal(calls.length, 9);
  // Centre piece: whole frame at the video position (x 100/1000*160 = 16, y 50*0.16 = 8).
  assert.deepEqual(calls[0], [0, 0, 1600, 900, 16, 8, 128, 72]);
  // Top strip: the frame's top 2% stretched up to the canvas edge.
  assert.deepEqual(calls[1], [0, 0, 1600, 18, 16, 0, 128, 8]);
  s.inject({ playerViewMode: 'ambient' });
  assert.equal(s.classes.has('__ytfp-extend'), false);
});

test('ordinary video and YouTube layouts do not allocate an ambient canvas', () => {
  for (const youtubeView of [false, true]) {
    const s = setup({ pathname: '/watch' });
    s.inject({ youtubeView });
    assert.equal(s.ambient(), undefined);
  }
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

test('reports the actual video selected inside the player and ignores ad IDs', () => {
  const s = setup();
  let id = 'ngSCQMHN83s';
  s.root.getVideoData = () => ({ video_id: id });
  assert.equal(s.inject().videoId, '');
  s.setAd(false);
  s.tick();
  assert.equal(s.inject().videoId, id);
  id = 'dQw4w9WgXcQ';
  assert.equal(s.inject().videoId, id);
});

test('syncing a recommended video updates URL and resets metadata without reloading', () => {
  const values = {};
  const context = vm.createContext({
    extractVideoId: require('../src/url-parser').extractVideoId,
    currentVideoId: 'ngSCQMHN83s', urlInput: { value: '' },
    localStorage: { setItem: (key, value) => { values[key] = value; } },
    historyRecorded: true, currentVideoDuration: 100,
    currentVideoChannel: { channelName: 'Old' }, lastContentMedia: {}, pendingRestore: {},
    setVideoTitle: () => {}, updateFavoriteButton: () => {}, renderFavorites: () => {}
  });
  vm.runInContext(source.match(/function syncPlayingVideo\(value\) \{[\s\S]*?\n\}/)[0], context);
  vm.runInContext("syncPlayingVideo('dQw4w9WgXcQ')", context);
  assert.equal(context.currentVideoId, 'dQw4w9WgXcQ');
  assert.equal(context.urlInput.value, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(values.lastVideoUrl, context.urlInput.value);
  assert.equal(context.historyRecorded, false);
  assert.equal(context.currentVideoDuration, 0);
  context.historyRecorded = true;
  vm.runInContext("syncPlayingVideo('dQw4w9WgXcQ'); syncPlayingVideo('')", context);
  assert.equal(context.historyRecorded, true);
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
