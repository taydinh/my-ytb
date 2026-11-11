const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ClapDetector } = require('../src/clap-detector');
const clap = { peakHigh: 0.5, rmsHigh: 0.1, rmsLow: 0.1, noiseFloorHigh: 0.005 };
const quiet = { peakHigh: 0.01, rmsHigh: 0.003, rmsLow: 0.003 };
function hit(d, t) { d.evaluateMetrics(quiet, t - 10); return d.evaluateMetrics(clap, t).isSnap; }
test('requires two distinct claps in the pairing window', () => {
  const d = new ClapDetector();
  assert.equal(hit(d, 1000), false);
  assert.equal(d.evaluateMetrics(clap, 1200).isSnap, false, 'continuous sound is not a second clap');
  assert.equal(hit(d, 1300), true);
  assert.equal(hit(d, 2300), false);
  assert.equal(hit(d, 3000), false, 'expired first clap');
  assert.equal(hit(d, 3300), true);
});
test('debounces echoes, enforces cooldown, and resets pending clap on stop', () => {
  const d = new ClapDetector({ cooldownMs: 800 });
  assert.equal(hit(d, 1000), false);
  assert.equal(hit(d, 1080), false);
  assert.equal(hit(d, 1300), true);
  assert.equal(hit(d, 1600), false);
  assert.equal(hit(d, 1850), false);
  assert.equal(hit(d, 2200), false);
  assert.equal(hit(d, 2500), true);
  hit(d, 3500);
  d.stop();
  assert.equal(hit(d, 3800), false);
});
test('rejects snap, speech, low frequency thumps and ambient noise', () => {
  for (const metrics of [quiet,
    { ...clap, rmsLow: 0.01 },
    { ...clap, peakHigh: 0.06, rmsLow: 0.3 },
    { ...clap, rmsHigh: 0.01, rmsLow: 0.4 }]) {
    const d = new ClapDetector();
    assert.equal(d.evaluateMetrics(metrics, 1000).isSnap, false);
    d.evaluateMetrics(quiet, 1100);
    assert.equal(d.evaluateMetrics(metrics, 1300).isSnap, false);
  }
});
