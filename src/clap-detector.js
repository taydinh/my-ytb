(function exposeClapDetector(globalObject) {
  'use strict';
  const { SnapDetector } = typeof module !== 'undefined' && module.exports
    ? require('./snap-detector') : globalObject.SnapDetectorModule;

  class ClapDetector extends SnapDetector {
    constructor(options = {}) {
      super(options);
      this.resetPair();
    }

    resetPair() {
      this.firstClapTime = null;
      this.lastImpulseTime = -Infinity;
      this.lastPairTime = -Infinity;
      this.impulseActive = false;
    }

    evaluateMetrics(metrics, now = Date.now()) {
      const { peakHigh, rmsHigh, rmsLow, noiseFloorHigh = 0.005 } = metrics;
      const ratio = rmsHigh / (rmsLow + 0.0001);
      // Claps have broader spectral energy than the high-frequency finger snap.
      const candidate = peakHigh >= Math.max(0.045, 0.28 - this.sensitivity * 0.0022)
        && ratio >= 0.35 && ratio < 1.8
        && peakHigh / (rmsHigh + 0.0001) >= 2.2
        && peakHigh / (noiseFloorHigh + 0.0001) >= 3.5;
      let paired = false;
      if (!candidate) this.impulseActive = false;
      if (this.firstClapTime !== null && now - this.firstClapTime > 650) this.firstClapTime = null;
      if (candidate && !this.impulseActive) {
        this.impulseActive = true;
        if (now - this.lastImpulseTime >= 150 && now - this.lastPairTime >= this.cooldownMs) {
          this.lastImpulseTime = now;
          if (this.firstClapTime !== null && now - this.firstClapTime >= 150) {
            paired = true;
            this.firstClapTime = null;
            this.lastPairTime = now;
          } else {
            this.firstClapTime = now;
          }
        }
      }
      return { isSnap: paired, metrics: { ...metrics, ratio } };
    }

    stop() {
      super.stop();
      this.resetPair();
    }
  }
  globalObject.ClapDetector = ClapDetector;
  if (typeof module !== 'undefined' && module.exports) module.exports = { ClapDetector };
})(typeof globalThis === 'undefined' ? this : globalThis);
