const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/youtube-browser-preload.js'), 'utf8');

function setup(href) {
  let clickHandler;
  let sent;
  const anchor = { tagName: 'A', href };
  const window = { addEventListener(type, handler, options) {
    if (type === 'click') clickHandler = { handler, options };
  } };
  const ipcRenderer = { sendToHost(channel, url) { sent = { channel, url }; } };
  vm.runInNewContext(source, {
    window,
    location: { href: 'https://www.youtube.com/' },
    URL,
    require: module => module === 'electron' ? { ipcRenderer } : null
  });
  const state = { prevented: false, stopped: false, immediate: false };
  const event = {
    button: 0,
    composedPath: () => [anchor],
    preventDefault: () => { state.prevented = true; },
    stopPropagation: () => { state.stopped = true; },
    stopImmediatePropagation: () => { state.immediate = true; }
  };
  return { click: () => clickHandler.handler(event), options: clickHandler.options, state, sent: () => sent };
}

test('YouTube panel intercepts a video click before page navigation', () => {
  const panel = setup('https://www.youtube.com/watch?v=2u2mPvBu0iU');
  panel.click();
  assert.equal(panel.options.capture, true);
  assert.deepEqual(panel.state, { prevented: true, stopped: true, immediate: true });
  assert.deepEqual(panel.sent(), {
    channel: 'youtube-video-selected',
    url: 'https://www.youtube.com/watch?v=2u2mPvBu0iU'
  });
});

test('YouTube panel leaves non-video navigation untouched', () => {
  const panel = setup('https://www.youtube.com/feed/subscriptions');
  panel.click();
  assert.deepEqual(panel.state, { prevented: false, stopped: false, immediate: false });
  assert.equal(panel.sent(), undefined);
});

test('four rapid YouTube selections load only the final video', () => {
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer.js'), 'utf8');
  const selectionHandler = renderer.match(/function selectVideoFromBrowsing\(url\) \{[\s\S]*?\n\}/)[0];
  const scheduled = new Set();
  const loaded = [];
  const context = vm.createContext({
    youtubePanelOpen: true,
    playlistGeneration: 0,
    currentVideoId: null,
    youtubeSelectionTimer: undefined,
    extractBrowsableVideoId: id => id,
    loadVideo: id => loaded.push(id),
    setTimeout: callback => { scheduled.add(callback); return callback; },
    clearTimeout: callback => scheduled.delete(callback)
  });
  vm.runInContext(selectionHandler, context);
  for (const id of ['first', 'second', 'first', 'last']) context.selectVideoFromBrowsing(id);
  assert.deepEqual(loaded, []);
  for (const callback of scheduled) callback();
  assert.deepEqual(loaded, ['last']);
});
