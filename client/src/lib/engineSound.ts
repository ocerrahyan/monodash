export class EngineSound {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private prevThrottle = 0;
  private prevVtec = false;
  private lastPopTime = 0;
  private lastBangTime = 0;
  private popCount = 0;

  private masterGain: GainNode | null = null;
  private revLimiterGain: GainNode | null = null;

  private osc1: OscillatorNode | null = null;
  private gain1: GainNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gain2: GainNode | null = null;
  private osc3: OscillatorNode | null = null;
  private gain3: GainNode | null = null;
  private osc4: OscillatorNode | null = null;
  private gain4: GainNode | null = null;

  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private popGain: GainNode | null = null;
  private popFilter: BiquadFilterNode | null = null;

  private vtecTransitionTime = 0;
  private revLimiterPhase = 0;
  private lastUpdateTime = 0;

  constructor() {}

  init(): boolean {
    try {
      if (this.ctx) return true;

      this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.ctx.destination);

      this.revLimiterGain = this.ctx.createGain();
      this.revLimiterGain.gain.value = 1;
      this.revLimiterGain.connect(this.masterGain);

      const real = new Float32Array([0, 0, 0.8, 0.4, 0.3, 0.15, 0.1, 0.08, 0.05]);
      const imag = new Float32Array([0, 1, 0.6, 0.3, 0.2, 0.1, 0.08, 0.05, 0.03]);
      const wave = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });

      this.osc1 = this.ctx.createOscillator();
      this.osc1.setPeriodicWave(wave);
      this.gain1 = this.ctx.createGain();
      this.gain1.gain.value = 0;
      this.osc1.connect(this.gain1);
      this.gain1.connect(this.revLimiterGain);
      this.osc1.start();

      this.osc2 = this.ctx.createOscillator();
      this.osc2.setPeriodicWave(wave);
      this.gain2 = this.ctx.createGain();
      this.gain2.gain.value = 0;
      this.osc2.connect(this.gain2);
      this.gain2.connect(this.revLimiterGain);
      this.osc2.start();

      const raspReal = new Float32Array([0, 0, 0.5, 0.6, 0.4, 0.3, 0.2, 0.15]);
      const raspImag = new Float32Array([0, 0.8, 0.7, 0.5, 0.3, 0.2, 0.15, 0.1]);
      const raspWave = this.ctx.createPeriodicWave(raspReal, raspImag, { disableNormalization: false });

      this.osc3 = this.ctx.createOscillator();
      this.osc3.setPeriodicWave(raspWave);
      this.gain3 = this.ctx.createGain();
      this.gain3.gain.value = 0;
      this.osc3.connect(this.gain3);
      this.gain3.connect(this.revLimiterGain);
      this.osc3.start();

      this.osc4 = this.ctx.createOscillator();
      this.osc4.type = 'sine';
      this.gain4 = this.ctx.createGain();
      this.gain4.gain.value = 0;
      this.osc4.connect(this.gain4);
      this.gain4.connect(this.revLimiterGain);
      this.osc4.start();

      this.noiseBuffer = this.createNoiseBuffer();
      this.noiseFilter = this.ctx.createBiquadFilter();
      this.noiseFilter.type = 'highpass';
      this.noiseFilter.frequency.value = 2000;
      this.noiseFilter.Q.value = 0.5;
      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.value = 0;
      this.noiseFilter.connect(this.noiseGain);
      this.noiseGain.connect(this.revLimiterGain);
      this.startNoiseSource();

      this.popFilter = this.ctx.createBiquadFilter();
      this.popFilter.type = 'bandpass';
      this.popFilter.frequency.value = 300;
      this.popFilter.Q.value = 2;
      this.popGain = this.ctx.createGain();
      this.popGain.gain.value = 0;
      this.popFilter.connect(this.popGain);
      this.popGain.connect(this.masterGain);

      return true;
    } catch {
      return false;
    }
  }

  private createNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private startNoiseSource(): void {
    if (!this.ctx || !this.noiseBuffer || !this.noiseFilter) return;
    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = this.noiseBuffer;
    this.noiseSource.loop = true;
    this.noiseSource.connect(this.noiseFilter);
    this.noiseSource.start();
  }

  update(
    rpm: number,
    throttle: number,
    vtecActive: boolean,
    fuelCutActive: boolean,
    revLimitActive: boolean,
    antiLagEnabled: boolean,
    launchControlActive: boolean
  ): void {
    if (!this.ctx || !this.enabled) return;

    const now = this.ctx.currentTime;
    const fundamentalFreq = Math.max((rpm / 60) * 2, 20);

    if (this.osc1) this.osc1.frequency.value = fundamentalFreq;
    if (this.osc2) this.osc2.frequency.value = fundamentalFreq * 2;
    if (this.osc3) this.osc3.frequency.value = fundamentalFreq * 3;
    if (this.osc4) this.osc4.frequency.value = fundamentalFreq * 0.5;

    const rpmNorm = Math.min(rpm / 8500, 1);
    const baseVol = 0.03 + throttle * 0.15 + rpmNorm * 0.07;
    const masterVol = Math.min(baseVol, 0.25);

    if (this.masterGain) {
      this.masterGain.gain.value = masterVol;
    }

    let layer1Vol = 0.7 + rpmNorm * 0.3;
    let layer2Vol = 0.35 + rpmNorm * 0.15;
    let layer3Vol = 0.1 + rpmNorm * 0.15;
    const subFade = rpm < 4000 ? 1 - (rpm / 4000) * 0.8 : 0.2 * (1 - Math.min((rpm - 4000) / 4000, 1));
    let layer4Vol = 0.15 * subFade;

    if (!this.prevVtec && vtecActive) {
      this.vtecTransitionTime = now;
    }
    this.prevVtec = vtecActive;

    if (vtecActive) {
      layer3Vol *= 1.8;
      layer1Vol *= 1.1;
      layer2Vol *= 1.3;

      const timeSinceVtec = now - this.vtecTransitionTime;
      if (timeSinceVtec < 0.5) {
        const burst = 1 + (0.5 - timeSinceVtec) * 2;
        layer3Vol *= burst;
        layer2Vol *= (1 + (0.5 - timeSinceVtec));
      }
    }

    if (this.gain1) this.gain1.gain.value = layer1Vol;
    if (this.gain2) this.gain2.gain.value = layer2Vol;
    if (this.gain3) this.gain3.gain.value = layer3Vol;
    if (this.gain4) this.gain4.gain.value = layer4Vol;

    if (this.noiseGain) {
      this.noiseGain.gain.value = 0.02 + rpmNorm * 0.06;
    }

    const dt = this.lastUpdateTime > 0 ? now - this.lastUpdateTime : 1 / 60;
    this.lastUpdateTime = now;

    if ((fuelCutActive || revLimitActive) && this.revLimiterGain) {
      this.revLimiterPhase += dt * 25 * Math.PI * 2;
      const gate = Math.sin(this.revLimiterPhase) > 0 ? 1 : 0.05;
      this.revLimiterGain.gain.value = gate;
    } else {
      if (this.revLimiterGain) this.revLimiterGain.gain.value = 1;
      this.revLimiterPhase = 0;
    }

    const throttleDrop = this.prevThrottle - throttle;
    if (throttleDrop > 0.3 && rpm > 2000) {
      if (now - this.lastPopTime > 0.1 && this.popCount < 4) {
        const delay = Math.random() * 0.15;
        this.schedulePop(now + delay, 0.08, false);
        this.lastPopTime = now;
        this.popCount++;
      }
    } else if (throttleDrop <= 0) {
      this.popCount = 0;
    }

    if (antiLagEnabled && throttle < 0.2 && rpm > 3000) {
      if (now - this.lastBangTime > 0.2 + Math.random() * 0.3) {
        this.schedulePop(now, 0.15, true);
        this.lastBangTime = now;
      }
    }

    this.prevThrottle = throttle;
  }

  private schedulePop(time: number, duration: number, isLoud: boolean): void {
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = isLoud ? 180 : 300;
    filter.Q.value = isLoud ? 1.5 : 2.5;

    const gain = this.ctx.createGain();
    const volume = isLoud ? 0.4 : 0.15;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    src.start(time);
    src.stop(time + duration + 0.01);

    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.masterGain) {
      this.masterGain.gain.value = 0;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  destroy(): void {
    this.enabled = false;

    if (this.osc1) { try { this.osc1.stop(); } catch {} this.osc1.disconnect(); this.osc1 = null; }
    if (this.osc2) { try { this.osc2.stop(); } catch {} this.osc2.disconnect(); this.osc2 = null; }
    if (this.osc3) { try { this.osc3.stop(); } catch {} this.osc3.disconnect(); this.osc3 = null; }
    if (this.osc4) { try { this.osc4.stop(); } catch {} this.osc4.disconnect(); this.osc4 = null; }
    if (this.noiseSource) { try { this.noiseSource.stop(); } catch {} this.noiseSource.disconnect(); this.noiseSource = null; }

    if (this.gain1) { this.gain1.disconnect(); this.gain1 = null; }
    if (this.gain2) { this.gain2.disconnect(); this.gain2 = null; }
    if (this.gain3) { this.gain3.disconnect(); this.gain3 = null; }
    if (this.gain4) { this.gain4.disconnect(); this.gain4 = null; }
    if (this.noiseGain) { this.noiseGain.disconnect(); this.noiseGain = null; }
    if (this.noiseFilter) { this.noiseFilter.disconnect(); this.noiseFilter = null; }
    if (this.popFilter) { this.popFilter.disconnect(); this.popFilter = null; }
    if (this.popGain) { this.popGain.disconnect(); this.popGain = null; }
    if (this.revLimiterGain) { this.revLimiterGain.disconnect(); this.revLimiterGain = null; }
    if (this.masterGain) { this.masterGain.disconnect(); this.masterGain = null; }

    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }

    this.noiseBuffer = null;
  }
}
