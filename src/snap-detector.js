(function exposeSnapDetector(globalObject) {
  'use strict';

  function calculateRms(buffer) {
    if (!buffer || buffer.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  function calculatePeak(buffer) {
    if (!buffer || buffer.length === 0) return 0;
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const abs = Math.abs(buffer[i]);
      if (abs > peak) peak = abs;
    }
    return peak;
  }

  /**
   * Biquad filter implementation for pure DSP analysis and test simulation.
   */
  class SimpleBiquad {
    constructor(type, freq, q, sampleRate = 44100) {
      this.type = type;
      this.freq = freq;
      this.q = q;
      this.sampleRate = sampleRate;
      this.x1 = 0;
      this.x2 = 0;
      this.y1 = 0;
      this.y2 = 0;
      this.computeCoeffs();
    }

    computeCoeffs() {
      const w0 = (2 * Math.PI * this.freq) / this.sampleRate;
      const cosw0 = Math.cos(w0);
      const sinw0 = Math.sin(w0);
      const alpha = sinw0 / (2 * this.q);

      if (this.type === 'bandpass') {
        this.b0 = alpha;
        this.b1 = 0;
        this.b2 = -alpha;
        this.a0 = 1 + alpha;
        this.a1 = -2 * cosw0;
        this.a2 = 1 - alpha;
      } else if (this.type === 'lowpass') {
        this.b0 = (1 - cosw0) / 2;
        this.b1 = 1 - cosw0;
        this.b2 = (1 - cosw0) / 2;
        this.a0 = 1 + alpha;
        this.a1 = -2 * cosw0;
        this.a2 = 1 - alpha;
      }
    }

    processSample(x) {
      const y =
        (this.b0 / this.a0) * x +
        (this.b1 / this.a0) * this.x1 +
        (this.b2 / this.a0) * this.x2 -
        (this.a1 / this.a0) * this.y1 -
        (this.a2 / this.a0) * this.y2;
      this.x2 = this.x1;
      this.x1 = x;
      this.y2 = this.y1;
      this.y1 = y;
      return y;
    }

    processBuffer(input, output = null) {
      const out = output || new Float32Array(input.length);
      for (let i = 0; i < input.length; i++) {
        out[i] = this.processSample(input[i]);
      }
      return out;
    }
  }

  /**
   * Evaluates audio metrics against snap criteria.
   */
  function evaluateSnapMetrics(metrics, options = {}) {
    const sensitivity = Math.max(1, Math.min(100, Number(options.sensitivity) || 60));
    const s = sensitivity / 100;

    // Dynamic thresholds based on sensitivity
    // Sensitivity 60: minPeak ~ 0.12, minRatio ~ 2.2, minCrest ~ 2.4
    const minPeak = Math.max(0.04, 0.26 - s * 0.2);
    const minRatio = Math.max(1.6, 3.4 - s * 1.6);
    const minCrest = 2.2;
    const minAttack = 2.8;

    const { peakHigh, rmsHigh, rmsLow, noiseFloorHigh = 0.005 } = metrics;
    const ratio = rmsHigh / (rmsLow + 1e-4);
    const crest = peakHigh / (rmsHigh + 1e-4);
    const attack = peakHigh / (noiseFloorHigh + 1e-4);

    const isSnap =
      peakHigh >= minPeak &&
      ratio >= minRatio &&
      crest >= minCrest &&
      attack >= minAttack;

    return {
      isSnap,
      metrics: {
        peakHigh,
        rmsHigh,
        rmsLow,
        ratio,
        crest,
        attack,
        noiseFloorHigh
      },
      thresholds: {
        minPeak,
        minRatio,
        minCrest,
        minAttack
      }
    };
  }

  class SnapDetector {
    constructor(options = {}) {
      this.sensitivity = Number(options.sensitivity) || 60;
      this.cooldownMs = Number(options.cooldownMs) || 800;
      this.onSnap = typeof options.onSnap === 'function' ? options.onSnap : null;
      this.onVolume = typeof options.onVolume === 'function' ? options.onVolume : null;
      this.onError = typeof options.onError === 'function' ? options.onError : null;
      this.onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : null;

      this.audioContext = null;
      this.mediaStream = null;
      this.sourceNode = null;
      this.highFilterNode = null;
      this.lowFilterNode = null;
      this.highAnalyser = null;
      this.lowAnalyser = null;
      this.scriptProcessor = null;
      this.analyserInterval = null;

      this.isRunning = false;
      this.lastSnapTime = 0;
      this.noiseFloorHigh = 0.005;
      this.state = 'idle'; // 'idle' | 'listening' | 'error'
    }

    setState(newState, detail = null) {
      if (this.state === newState && !detail) return;
      this.state = newState;
      if (this.onStateChange) {
        this.onStateChange(this.state, detail);
      }
    }

    setSensitivity(val) {
      this.sensitivity = Math.max(1, Math.min(100, Number(val) || 60));
    }

    setCooldown(ms) {
      this.cooldownMs = Math.max(200, Math.min(3000, Number(ms) || 800));
    }

    async start() {
      if (this.isRunning) return;

      if (!navigator?.mediaDevices?.getUserMedia) {
        const error = new Error('Trình duyệt hoặc hệ thống không hỗ trợ microphone.');
        this.setState('error', error);
        if (this.onError) this.onError(error);
        throw error;
      }

      try {
        // Try audio with raw input preferences to prevent software aggressive AEC attenuation of transients
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          });
        } catch (constraintErr) {
          // Fallback to basic audio constraint if strict constraints fail
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        this.mediaStream = stream;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx();
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

        // High Bandpass filter: centered at 3800Hz, Q=1.8 (captures snap frequencies 2.5k - 6k)
        this.highFilterNode = this.audioContext.createBiquadFilter();
        this.highFilterNode.type = 'bandpass';
        this.highFilterNode.frequency.value = 3800;
        this.highFilterNode.Q.value = 1.8;

        // Low Lowpass filter: cutoff at 1000Hz (captures speech, ambient noise, desk thumps)
        this.lowFilterNode = this.audioContext.createBiquadFilter();
        this.lowFilterNode.type = 'lowpass';
        this.lowFilterNode.frequency.value = 1000;
        this.lowFilterNode.Q.value = 0.7;

        this.highAnalyser = this.audioContext.createAnalyser();
        this.highAnalyser.fftSize = 512;
        this.lowAnalyser = this.audioContext.createAnalyser();
        this.lowAnalyser.fftSize = 512;

        this.sourceNode.connect(this.highFilterNode);
        this.highFilterNode.connect(this.highAnalyser);

        this.sourceNode.connect(this.lowFilterNode);
        this.lowFilterNode.connect(this.lowAnalyser);

        // Continuous processing loop
        const highBuffer = new Float32Array(this.highAnalyser.fftSize);
        const lowBuffer = new Float32Array(this.lowAnalyser.fftSize);

        // Using ScriptProcessorNode if available to stay pumped by the audio hardware clock,
        // plus an interval fallback.
        if (typeof this.audioContext.createScriptProcessor === 'function') {
          try {
            this.scriptProcessor = this.audioContext.createScriptProcessor(512, 1, 1);
            this.scriptProcessor.onaudioprocess = () => {
              this.processTick(highBuffer, lowBuffer);
            };
            this.highAnalyser.connect(this.scriptProcessor);
            // Connect to dummy destination to keep the graph active without audible output
            const muteGain = this.audioContext.createGain();
            muteGain.gain.value = 0;
            this.scriptProcessor.connect(muteGain);
            muteGain.connect(this.audioContext.destination);
          } catch (e) {
            this.startIntervalFallback(highBuffer, lowBuffer);
          }
        } else {
          this.startIntervalFallback(highBuffer, lowBuffer);
        }

        this.isRunning = true;
        this.setState('listening');
      } catch (err) {
        this.stop();
        let message = 'Không thể truy cập microphone.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Microphone chưa được cấp quyền trong Windows Settings.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'Không tìm thấy microphone kết nối trên máy tính.';
        }
        const customErr = new Error(message);
        customErr.original = err;
        this.setState('error', customErr);
        if (this.onError) this.onError(customErr);
        throw customErr;
      }
    }

    startIntervalFallback(highBuffer, lowBuffer) {
      if (this.analyserInterval) clearInterval(this.analyserInterval);
      this.analyserInterval = setInterval(() => {
        this.processTick(highBuffer, lowBuffer);
      }, 20);
    }

    processTick(highBuffer, lowBuffer) {
      if (!this.isRunning || !this.highAnalyser || !this.lowAnalyser) return;

      this.highAnalyser.getFloatTimeDomainData(highBuffer);
      this.lowAnalyser.getFloatTimeDomainData(lowBuffer);

      const rmsHigh = calculateRms(highBuffer);
      const peakHigh = calculatePeak(highBuffer);
      const rmsLow = calculateRms(lowBuffer);

      // Smooth noise floor tracking
      if (peakHigh < 0.05) {
        this.noiseFloorHigh = this.noiseFloorHigh * 0.96 + rmsHigh * 0.04;
      }

      const metrics = {
        peakHigh,
        rmsHigh,
        rmsLow,
        noiseFloorHigh: this.noiseFloorHigh
      };

      const result = evaluateSnapMetrics(metrics, { sensitivity: this.sensitivity });

      if (this.onVolume) {
        const rawVol = Math.min(100, Math.round(peakHigh * 250));
        this.onVolume({
          level: rawVol,
          rmsHigh,
          rmsLow,
          ratio: result.metrics.ratio,
          isSnapCandidate: result.isSnap
        });
      }

      const now = Date.now();
      if (result.isSnap) {
        if (now - this.lastSnapTime >= this.cooldownMs) {
          this.lastSnapTime = now;
          if (this.onSnap) {
            this.onSnap({
              timestamp: now,
              metrics: result.metrics
            });
          }
        }
      }
    }

    stop() {
      this.isRunning = false;

      if (this.analyserInterval) {
        clearInterval(this.analyserInterval);
        this.analyserInterval = null;
      }

      if (this.scriptProcessor) {
        try {
          this.scriptProcessor.disconnect();
        } catch {}
        this.scriptProcessor = null;
      }

      if (this.sourceNode) {
        try {
          this.sourceNode.disconnect();
        } catch {}
        this.sourceNode = null;
      }

      if (this.highFilterNode) {
        try {
          this.highFilterNode.disconnect();
        } catch {}
        this.highFilterNode = null;
      }

      if (this.lowFilterNode) {
        try {
          this.lowFilterNode.disconnect();
        } catch {}
        this.lowFilterNode = null;
      }

      if (this.mediaStream) {
        try {
          this.mediaStream.getTracks().forEach((track) => track.stop());
        } catch {}
        this.mediaStream = null;
      }

      if (this.audioContext) {
        try {
          if (this.audioContext.state !== 'closed') {
            this.audioContext.close();
          }
        } catch {}
        this.audioContext = null;
      }

      this.setState('idle');
    }
  }

  const api = {
    SnapDetector,
    SimpleBiquad,
    calculateRms,
    calculatePeak,
    evaluateSnapMetrics
  };

  globalObject.SnapDetector = SnapDetector;
  globalObject.SnapDetectorModule = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis === 'undefined' ? this : globalThis);
