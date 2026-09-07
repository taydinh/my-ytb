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
    window: { webkit: { messageHandlers: { youtubePiP: { postMessage: m => states.push(m.state) } } } },
    document: { documentElement: {}, querySelectorAll: () => video ? [video] : [] },
    WeakSet, clearTimeout() { timeout = undefined; }, setTimeout(fn) { timeout = fn; },
    MutationObserver: class { observe() {} }
  };
  vm.runInNewContext(source, context);
  return { states, events, start: context.window.__startYouTubePiP, timeout: () => timeout?.() };
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
