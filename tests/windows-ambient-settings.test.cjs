const test = require('node:test');
const assert = require('node:assert/strict');
const Ambient = require('../src/ambient-settings');

function storage(initial) {
  const data = { ambientSettings: initial };
  return { data, getItem: key => data[key], setItem: (key, value) => { data[key] = value; } };
}

test('ambient settings default, clamp, step and drop unknown keys', () => {
  assert.deepEqual(Ambient.load(storage(undefined)), Ambient.DEFAULTS);
  assert.equal(Ambient.DEFAULTS.extend, true);
  assert.equal(Ambient.DEFAULTS.blur, 30);
  assert.equal(Ambient.DEFAULTS.resolution, 160);
  // A user's saved choice wins over the defaults.
  assert.equal(Ambient.load(storage(JSON.stringify({ extend: false, blur: 50 }))).extend, false);
  assert.deepEqual(Ambient.load(storage('not json')), Ambient.DEFAULTS);
  const clean = Ambient.sanitize({ blur: 999, spread: -5, fadeIn: 0.66, saturation: 152, top: 'yes', removeBars: true, evil: '</script>', fps: '' });
  assert.equal(clean.blur, 120);
  assert.equal(clean.spread, 0);
  assert.equal(clean.fadeIn, 0.7);
  assert.equal(clean.saturation, 150);
  assert.equal(clean.top, true);
  assert.equal(clean.removeBars, true);
  assert.equal(clean.fps, 30);
  assert.equal('evil' in clean, false);
});

test('ambient settings round-trip through storage and format values', () => {
  const local = storage();
  Ambient.save(local, { ...Ambient.DEFAULTS, intensity: 40, motion: false });
  const loaded = Ambient.load(local);
  assert.equal(loaded.intensity, 40);
  assert.equal(loaded.motion, false);
  const field = key => Ambient.FIELDS.find(item => item.key === key);
  assert.equal(Ambient.format(field('fps'), 0), 'Không giới hạn');
  assert.equal(Ambient.format(field('intensity'), 40), '40%');
  assert.equal(Ambient.format(field('fadeIn'), 0.6), '0.6 s');
});
