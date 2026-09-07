const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('mobile/ios-auto-skip.js', 'utf8');
function setup({ hostname = 'www.youtube-nocookie.com', hidden = false, disabled = false, visible = true } = {}) {
  let clicks = 0;
  let tick;
  const button = { disabled, getAttribute: () => null, closest: () => null,
    getClientRects: () => visible ? [{}] : [], click: () => clicks++ };
  const context = { location: { hostname }, window: { addEventListener() {} },
    document: { hidden, querySelectorAll: () => [button], addEventListener() {} },
    getComputedStyle: () => ({ visibility: 'visible', display: 'block', opacity: '1' }),
    setInterval: fn => { tick = fn; }, clearInterval() {}, WeakMap, Date };
  vm.runInNewContext(source, context);
  return { clicks: () => clicks, tick: () => tick?.(), context };
}
test('clicks available Skip and throttles repeated clicks', () => {
  const state = setup();
  assert.equal(state.clicks(), 1);
  state.tick();
  assert.equal(state.clicks(), 1);
});
test('ignores hidden, disabled, background, and unrelated pages', () => {
  for (const options of [{ visible: false }, { disabled: true }, { hidden: true }, { hostname: 'example.com' }]) {
    assert.equal(setup(options).clicks(), 0);
  }
});
test('does not install twice in a frame', () => {
  const state = setup();
  vm.runInNewContext(source, state.context);
  assert.equal(state.clicks(), 1);
});
