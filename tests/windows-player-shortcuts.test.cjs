const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { getAction, isEditableTarget, createPlayerScript } = require('../src/player-shortcuts');

test('maps YouTube J/K/L shortcuts and ignores modified or repeated toggle keys', () => {
  assert.equal(getAction({ type: 'keyDown', key: 'j' }), 'backward');
  assert.equal(getAction({ type: 'keyDown', key: 'K' }), 'toggle');
  assert.equal(getAction({ type: 'keyDown', key: 'l' }), 'forward');
  assert.equal(getAction({ type: 'keyUp', key: 'j' }), null);
  assert.equal(getAction({ type: 'keyDown', key: 'j', control: true }), null);
  assert.equal(getAction({ type: 'keyDown', key: 'k', isAutoRepeat: true }), null);
});

test('does not claim shortcuts while typing in an editable control', () => {
  assert.equal(isEditableTarget({ closest: selector => selector.includes('input') ? {} : null }), true);
  assert.equal(isEditableTarget({ closest: () => null }), false);
});

function execute(action, videoOverrides = {}, rootOverrides = {}) {
  const video = {
    paused: false, currentTime: 20, duration: 25,
    play() { this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
    ...videoOverrides
  };
  const root = { querySelector: () => video, ...rootOverrides };
  const document = { querySelector: selector => selector.includes('movie_player') ? root : video };
  return { video, result: vm.runInNewContext(createPlayerScript(action), { document }) };
}

test('seeks ten seconds with clamping when the YouTube API is unavailable', () => {
  assert.equal(execute('backward', { currentTime: 5 }).video.currentTime, 0);
  assert.equal(execute('forward').video.currentTime, 25);
});

test('toggles playback and prefers the YouTube seek API', () => {
  const paused = execute('toggle', { paused: true });
  assert.equal(paused.video.paused, false);
  const playing = execute('toggle');
  assert.equal(playing.video.paused, true);
  let delta = 0;
  execute('forward', {}, { seekBy: value => { delta = value; } });
  assert.equal(delta, 10);
});
