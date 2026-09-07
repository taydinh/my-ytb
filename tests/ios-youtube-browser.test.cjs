const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup(href = 'https://m.youtube.com/', bridge = true) {
  const sent = [], changes = [], listeners = {};
  let pauses = 0;
  const context = {
    URL, location: new URL(href),
    document: {
      querySelectorAll: () => [{ pause() { pauses++; } }],
      addEventListener(name, callback) { listeners[name] = callback; }
    },
    history: Object.fromEntries(['pushState', 'replaceState'].map(name => [name, (...args) => changes.push(args)])),
    window: {
      ...(bridge ? { webkit: { messageHandlers: { youtubeSelection: { postMessage: url => sent.push(url) } } } } : {}),
      addEventListener(name, callback) { listeners[name] = callback; }
    }
  };
  vm.runInNewContext(fs.readFileSync('mobile/ios-youtube-browser.js', 'utf8'), context);
  return { sent, changes, context, get pauses() { return pauses; }, click(url) {
    let prevented = false, stopped = false;
    listeners.click?.({ target: { closest: () => ({ href: url }) },
      preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    return { prevented, stopped };
  } };
}

for (const url of ['/watch?v=dQw4w9WgXcQ&list=abc', '/shorts/dQw4w9WgXcQ', '/live/dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ']) {
  test(`selects ${url} and prevents playback in browser`, () => {
    const browser = setup();
    assert.deepEqual(browser.click(url), { prevented: true, stopped: true });
    assert.deepEqual(browser.sent, ['https://www.youtube.com/watch?v=dQw4w9WgXcQ']);
    assert.equal(browser.pauses, 1);
    browser.click(url);
    assert.equal(browser.sent.length, 1);
  });
}

test('search, channels, invalid IDs and unrelated hosts navigate normally', () => {
  const browser = setup();
  for (const url of ['/results?search_query=music', '/@channel', '/watch?v=bad', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'http://m.youtube.com/watch?v=dQw4w9WgXcQ']) {
    assert.equal(browser.click(url).prevented, false);
  }
  assert.equal(browser.sent.length, 0);
});

for (const name of ['pushState', 'replaceState']) {
  test(`intercepts SPA ${name} but preserves non-video updates`, () => {
    const browser = setup();
    browser.context.history[name]({}, '', '/results?search_query=music');
    assert.equal(browser.changes.length, 1);
    browser.context.history[name]({}, '', '/watch?v=dQw4w9WgXcQ');
    assert.equal(browser.changes.length, 1);
    assert.equal(browser.sent.length, 1);
  });
}

test('direct video entry is selected; unrelated pages and missing bridges remain untouched', () => {
  assert.equal(setup('https://m.youtube.com/watch?v=dQw4w9WgXcQ').sent.length, 1);
  assert.equal(setup('https://example.com/watch?v=dQw4w9WgXcQ').sent.length, 0);
  assert.equal(setup('https://m.youtube.com/', false).click('/watch?v=dQw4w9WgXcQ').prevented, false);
});
