const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup(native = true) {
  const elements = new Map();
  const messages = [];
  const observers = [];
  const events = {};
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', open: false, hidden: false, src: '', handlers: {},
      classList: { add() {}, toggle() {} }, setAttribute() {}, focus() {}, select() {},
      addEventListener(name, callback) { this.handlers[name] = callback; },
      getBoundingClientRect: () => ({ x: 0, y: 240, width: 414, height: 550 })
    });
    return elements.get(id);
  }
  const context = {
    Browser: { open: async () => {} }, URL, URLSearchParams,
    document: { querySelector: element },
    localStorage: { getItem: () => null, setItem() {} },
    ResizeObserver: class { constructor(fn) { observers.push(fn); } observe() {} },
    MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} },
    window: {
      ...(native ? { webkit: { messageHandlers: { youtubePlayer: { postMessage: message => messages.push(message) } } } } : {}),
      addEventListener(name, fn) { events[name] = fn; }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/url-parser.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('mobile/app.js', 'utf8').replace(/^import .*;\n/gm, ''), context);
  return { element, messages, observers, events, submit(value) {
    element('#urlInput').value = value;
    element('#urlForm').handlers.submit({ preventDefault() {} });
  } };
}

test('iOS playback sends validated video and layout to native player, including loop changes', () => {
  const app = setup();
  app.submit('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(app.messages.at(-1).videoId, 'dQw4w9WgXcQ');
  assert.equal(app.messages.at(-1).loop, false);
  assert.equal(app.messages.at(-1).rect.width, 414);
  assert.equal(app.element('#player').src, '');
  app.element('#loopBtn').handlers.click();
  assert.equal(app.messages.at(-1).loop, true);
});

test('invalid URLs never reach the native player', () => {
  const app = setup();
  app.submit('not a video');
  assert.equal(app.messages.length, 0);
});

test('layout updates preserve the playing video', () => {
  const app = setup();
  app.submit('dQw4w9WgXcQ');
  app.observers[0]();
  assert.equal(app.messages.at(-1).hidden, false);
  assert.equal(app.messages.at(-1).videoId, undefined);
});

test('PiP requires a video and sends an action without reloading playback', () => {
  const app = setup();
  app.element('#pipBtn').handlers.click();
  assert.equal(app.messages.length, 0);
  app.submit('dQw4w9WgXcQ');
  app.element('#pipBtn').handlers.click();
  assert.equal(app.messages.at(-1).action, 'startPiP');
  assert.equal(app.messages.at(-1).videoId, undefined);
  app.events['youtube:pip-status']({ detail: { state: 'active' } });
  assert.equal(app.element('#status').textContent, 'Đang phát PiP');
  app.events['youtube:pip-status']({ detail: { state: 'unavailable' } });
  assert.match(app.element('#status').textContent, /Chưa bật được PiP/);
});

test('web fallback still uses the embedded player with loop parameters', () => {
  const app = setup(false);
  app.submit('dQw4w9WgXcQ');
  assert.match(app.element('#player').src, /^https:\/\/www.youtube-nocookie.com\/embed\/dQw4w9WgXcQ\?/);
  app.element('#loopBtn').handlers.click();
  assert.match(app.element('#player').src, /loop=1&playlist=dQw4w9WgXcQ/);
});


test('iOS YouTube button opens native browser and selection loads main player', () => {
  const app = setup();
  app.element('#youtubeBtn').handlers.click();
  assert.equal(app.messages.at(-1).action, 'openBrowser');
  app.events['youtube:video-selected']({ detail: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } });
  assert.equal(app.messages.at(-1).videoId, 'dQw4w9WgXcQ');
  assert.equal(app.element('#urlInput').value, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('malformed browser events never start playback', () => {
  const app = setup();
  for (const detail of [undefined, {}, { url: 42 }, { url: 'https://example.com/watch?v=dQw4w9WgXcQ' }]) {
    app.events['youtube:video-selected']({ detail });
  }
  assert.equal(app.messages.length, 0);
});
