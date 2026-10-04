const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('mobile/ios-pip.js', 'utf8');
function setup(video) {
  const states = [], events = {};
  let timeout;
  if (video) video.addEventListener = (name, fn) => { events[name] = fn; };
  const context = {
    location: { hostname: 'www.youtube-nocookie.com' },
    window: { webkit: { messageHandlers: { youtubePiP: { postMessage: m => states.push(m.state) } } }, addEventListener() {} },
    document: { documentElement: {}, hidden: false, addEventListener(name, fn) { events[name] = fn; }, querySelectorAll: () => video ? [video] : [] },
    Date,
    WeakSet, clearTimeout() { timeout = undefined; }, setTimeout(fn) { timeout = fn; },
    MutationObserver: class { observe() {} }
  };
  vm.runInNewContext(source, context);
  return {
    states, events,
    start: context.window.__startYouTubePiP,
    startIfPlaying: context.window.__startYouTubePiPIfPlaying,
    recover: context.window.__recoverYouTubePiP,
    setHidden(value) { context.document.hidden = value; },
    timeout: () => timeout?.()
  };
}
test('PiP requests native presentation and waits for an actual state change', () => {
  let requested;
  const video = { readyState: 4, paused: false, webkitPresentationMode: 'inline',
    webkitSupportsPresentationMode: () => true, webkitSetPresentationMode(mode) { requested = mode; } };
  const app = setup(video);
  app.start();
  assert.equal(requested, 'picture-in-picture');
  assert.deepEqual(app.states, ['ready']);
  video.webkitPresentationMode = 'picture-in-picture';
  app.events.webkitpresentationmodechanged();
  assert.equal(app.states.at(-1), 'active');
  video.webkitPresentationMode = 'inline';
  app.events.webkitpresentationmodechanged();
  assert.equal(app.states.at(-1), 'inline');
});
test('missing, unsupported and silently rejected video requests report failure', () => {
  for (const video of [null, { readyState: 0 }, { readyState: 4 },
    { readyState: 4, webkitSetPresentationMode() {} },
    { readyState: 4, webkitSetPresentationMode() { throw Error('denied'); } }]) {
    const app = setup(video);
    app.start();
    app.timeout();
    assert.equal(app.states.at(-1), 'unavailable');
  }
});
test('an already active PiP video is not toggled off', () => {
  const app = setup({ readyState: 4, webkitPresentationMode: 'picture-in-picture',
    webkitSetPresentationMode() { assert.fail('should not toggle'); } });
  app.start();
  assert.equal(app.states.at(-1), 'active');
});

test('backgrounding automatically starts PiP only while video is playing', () => {
  let requested = 0;
  const video = {
    readyState: 4, paused: false, webkitPresentationMode: 'inline',
    webkitSupportsPresentationMode: () => true,
    webkitSetPresentationMode(mode) {
      assert.equal(mode, 'picture-in-picture');
      requested += 1;
    }
  };
  const app = setup(video);
  app.setHidden(true);
  app.events.visibilitychange();
  assert.equal(requested, 1);

  app.setHidden(false);
  app.events.visibilitychange();
  video.paused = true;
  app.events.pause();
  app.startIfPlaying();
  assert.equal(requested, 1);
});

test('backgrounding still starts PiP after WebKit preemptively pauses the video', () => {
  let requested = 0;
  const video = {
    readyState: 4, paused: false, webkitPresentationMode: 'inline',
    webkitSupportsPresentationMode: () => true,
    webkitSetPresentationMode() { requested += 1; },
    play() { this.paused = false; return Promise.resolve(); }
  };
  const app = setup(video);
  app.events.timeupdate();
  app.setHidden(true);
  video.paused = true;
  app.events.pause();
  app.events.visibilitychange();
  assert.equal(requested, 1);
  assert.equal(video.paused, false);
});

test('foreground recovery requests a fresh frame and resumes an active playing PiP video', async () => {
  let played = 0;
  const video = {
    readyState: 4, paused: false, currentTime: 12,
    seekable: { length: 1, end: () => 100 },
    webkitPresentationMode: 'picture-in-picture',
    play() { played += 1; return Promise.resolve(); }
  };
  const app = setup(video);
  app.recover();
  assert.equal(video.currentTime, 12.001);
  assert.equal(played, 1);
});

test('foreground recovery does not autoplay PiP that the user paused', () => {
  let played = 0;
  const video = {
    readyState: 4, paused: true, currentTime: 12,
    seekable: { length: 1, end: () => 100 },
    webkitPresentationMode: 'picture-in-picture',
    play() { played += 1; }
  };
  const app = setup(video);
  app.recover();
  assert.equal(video.currentTime, 12);
  assert.equal(played, 0);
});
