const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  SnapDetector,
  SimpleBiquad,
  calculateRms,
  calculatePeak,
  evaluateSnapMetrics
} = require('../src/snap-detector');

test('calculateRms and calculatePeak handle empty and normal buffers', () => {
  assert.equal(calculateRms([]), 0);
  assert.equal(calculatePeak([]), 0);
  assert.equal(calculateRms(null), 0);
  assert.equal(calculatePeak(null), 0);

  const buffer = new Float32Array([0.5, -0.5, 0.5, -0.5]);
  assert.equal(calculatePeak(buffer), 0.5);
  assert.equal(Math.round(calculateRms(buffer) * 100) / 100, 0.5);
});

test('SimpleBiquad filters separate 3.8kHz snap band from 400Hz low band', () => {
  const sampleRate = 44100;
  const numSamples = 200;
  const bpFilter = new SimpleBiquad('bandpass', 3800, 1.8, sampleRate);
  const lpFilter = new SimpleBiquad('lowpass', 1000, 0.7, sampleRate);

  // High frequency signal (3800 Hz)
  const highSignal = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    highSignal[i] = Math.sin(2 * Math.PI * 3800 * (i / sampleRate));
  }

  const bpHigh = bpFilter.processBuffer(highSignal);
  const lpHigh = lpFilter.processBuffer(highSignal);

  const rmsBpHigh = calculateRms(bpHigh);
  const rmsLpHigh = calculateRms(lpHigh);
  // Bandpass should preserve high frequency much better than Lowpass
  assert.ok(rmsBpHigh > rmsLpHigh * 3, `Bandpass RMS (${rmsBpHigh}) should exceed Lowpass RMS (${rmsLpHigh})`);

  // Low frequency signal (400 Hz)
  const lowBpFilter = new SimpleBiquad('bandpass', 3800, 1.8, sampleRate);
  const lowLpFilter = new SimpleBiquad('lowpass', 1000, 0.7, sampleRate);
  const lowSignal = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    lowSignal[i] = Math.sin(2 * Math.PI * 400 * (i / sampleRate));
  }

  const bpLow = lowBpFilter.processBuffer(lowSignal);
  const lpLow = lowLpFilter.processBuffer(lowSignal);

  const rmsBpLow = calculateRms(bpLow);
  const rmsLpLow = calculateRms(lpLow);
  // Lowpass should preserve low frequency much better than Bandpass
  assert.ok(rmsLpLow > rmsBpLow * 3, `Lowpass RMS (${rmsLpLow}) should exceed Bandpass RMS (${rmsBpLow})`);
});

test('evaluateSnapMetrics correctly detects synthetic snap and rejects speech & thumps', () => {
  // 1. Synthetic Snap: high peak, high high-band RMS, low low-band RMS
  const snapMetrics = {
    peakHigh: 0.45,
    rmsHigh: 0.12,
    rmsLow: 0.012, // Ratio ~ 10
    noiseFloorHigh: 0.005
  };
  const snapResult = evaluateSnapMetrics(snapMetrics, { sensitivity: 60 });
  assert.equal(snapResult.isSnap, true, 'Finger snap should be recognized');
  assert.ok(snapResult.metrics.ratio > 8);

  // 2. Synthetic Speech: dominant low-band RMS, low ratio
  const speechMetrics = {
    peakHigh: 0.08,
    rmsHigh: 0.02,
    rmsLow: 0.22, // Ratio ~ 0.09
    noiseFloorHigh: 0.005
  };
  const speechResult = evaluateSnapMetrics(speechMetrics, { sensitivity: 60 });
  assert.equal(speechResult.isSnap, false, 'Speech should be rejected');

  // 3. Synthetic Desk Thump: huge low-band spike, minimal high-band energy
  const thumpMetrics = {
    peakHigh: 0.04,
    rmsHigh: 0.008,
    rmsLow: 0.35, // Ratio ~ 0.02
    noiseFloorHigh: 0.005
  };
  const thumpResult = evaluateSnapMetrics(thumpMetrics, { sensitivity: 60 });
  assert.equal(thumpResult.isSnap, false, 'Desk thump should be rejected');

  // 4. Quiet ambient noise: below minimum peak threshold
  const quietMetrics = {
    peakHigh: 0.02,
    rmsHigh: 0.005,
    rmsLow: 0.004,
    noiseFloorHigh: 0.004
  };
  const quietResult = evaluateSnapMetrics(quietMetrics, { sensitivity: 60 });
  assert.equal(quietResult.isSnap, false, 'Quiet ambient noise should be rejected');
});

test('sensitivity parameter adjusts detection thresholds appropriately', () => {
  const borderlineMetrics = {
    peakHigh: 0.10,
    rmsHigh: 0.035,
    rmsLow: 0.01,
    noiseFloorHigh: 0.005
  };

  // With low sensitivity (20), threshold is strict -> should NOT trigger
  const lowSensResult = evaluateSnapMetrics(borderlineMetrics, { sensitivity: 20 });
  assert.equal(lowSensResult.isSnap, false);

  // With high sensitivity (85), threshold is relaxed -> should trigger
  const highSensResult = evaluateSnapMetrics(borderlineMetrics, { sensitivity: 85 });
  assert.equal(highSensResult.isSnap, true);
});

test('SnapDetector handles cooldown and debounce', () => {
  let snapCount = 0;
  const detector = new SnapDetector({
    sensitivity: 60,
    cooldownMs: 500,
    onSnap: () => { snapCount++; }
  });

  // Mock internal state to test processTick logic
  detector.isRunning = true;
  const fakeHigh = new Float32Array(512);
  const fakeLow = new Float32Array(512);

  // Inject snap values into fakeHigh
  for (let i = 0; i < 50; i++) fakeHigh[i] = 0.5;
  for (let i = 0; i < 50; i++) fakeLow[i] = 0.02;

  detector.highAnalyser = {
    fftSize: 512,
    getFloatTimeDomainData: (buf) => buf.set(fakeHigh)
  };
  detector.lowAnalyser = {
    fftSize: 512,
    getFloatTimeDomainData: (buf) => buf.set(fakeLow)
  };

  // First snap
  detector.processTick(new Float32Array(512), new Float32Array(512));
  assert.equal(snapCount, 1, 'First snap should trigger callback');

  // Immediate second snap within cooldown (0ms later)
  detector.processTick(new Float32Array(512), new Float32Array(512));
  assert.equal(snapCount, 1, 'Immediate second snap within cooldown should be debounced');

  // Simulate time passed past cooldown
  detector.lastSnapTime = Date.now() - 600;
  detector.processTick(new Float32Array(512), new Float32Array(512));
  assert.equal(snapCount, 2, 'Snap after cooldown should trigger callback');
});

test('SnapDetector bounds checking on sensitivity and cooldown', () => {
  const detector = new SnapDetector();
  detector.setSensitivity(150);
  assert.equal(detector.sensitivity, 100);

  detector.setSensitivity(-10);
  assert.equal(detector.sensitivity, 1);

  detector.setCooldown(50);
  assert.equal(detector.cooldownMs, 200);

  detector.setCooldown(5000);
  assert.equal(detector.cooldownMs, 3000);
});

test('SnapDetector reports error if getUserMedia is unavailable', async () => {
  const detector = new SnapDetector();
  let errorFired = false;
  detector.onError = () => { errorFired = true; };

  // Environment without navigator.mediaDevices
  await assert.rejects(detector.start());
  assert.equal(detector.state, 'error');
  assert.equal(errorFired, true);
});
