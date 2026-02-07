export class EngineSound {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private prevThrottle = 0;
  private prevVtec = false;
  private prevGear = 0;
  private prevBoostPsi = 0;
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

  private turboSpoolSource: AudioBufferSourceNode | null = null;
  private turboSpoolGain: GainNode | null = null;
  private turboSpoolFilter: BiquadFilterNode | null = null;

  private turboWhistleOsc: OscillatorNode | null = null;
  private turboWhistleGain: GainNode | null = null;
  private turboWhistleFilter: BiquadFilterNode | null = null;

  private tireSource: AudioBufferSourceNode | null = null;
  private tireGain: GainNode | null = null;
  private tireFilter: BiquadFilterNode | null = null;

  private vtecTransitionTime = 0;
  private revLimiterPhase = 0;
  private lastUpdateTime = 0;
  private lastBovTime = 0;

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

      this.initTurboSound();
      this.initTireSound();

      return true;
    } catch {
      return false;
    }
  }

  private initTurboSound(): void {
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;

    this.turboSpoolFilter = this.ctx.createBiquadFilter();
    this.turboSpoolFilter.type = 'bandpass';
    this.turboSpoolFilter.frequency.value = 800;
    this.turboSpoolFilter.Q.value = 3;

    this.turboSpoolGain = this.ctx.createGain();
    this.turboSpoolGain.gain.value = 0;

    this.turboSpoolSource = this.ctx.createBufferSource();
    this.turboSpoolSource.buffer = this.noiseBuffer;
    this.turboSpoolSource.loop = true;
    this.turboSpoolSource.connect(this.turboSpoolFilter);
    this.turboSpoolFilter.connect(this.turboSpoolGain);
    this.turboSpoolGain.connect(this.masterGain);
    this.turboSpoolSource.start();

    this.turboWhistleOsc = this.ctx.createOscillator();
    this.turboWhistleOsc.type = 'sine';
    this.turboWhistleOsc.frequency.value = 4000;

    this.turboWhistleFilter = this.ctx.createBiquadFilter();
    this.turboWhistleFilter.type = 'bandpass';
    this.turboWhistleFilter.frequency.value = 5000;
    this.turboWhistleFilter.Q.value = 8;

    this.turboWhistleGain = this.ctx.createGain();
    this.turboWhistleGain.gain.value = 0;

    this.turboWhistleOsc.connect(this.turboWhistleFilter);
    this.turboWhistleFilter.connect(this.turboWhistleGain);
    this.turboWhistleGain.connect(this.masterGain);
    this.turboWhistleOsc.start();
  }

  private initTireSound(): void {
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;

    this.tireFilter = this.ctx.createBiquadFilter();
    this.tireFilter.type = 'bandpass';
    this.tireFilter.frequency.value = 1200;
    this.tireFilter.Q.value = 1.5;

    this.tireGain = this.ctx.createGain();
    this.tireGain.gain.value = 0;

    this.tireSource = this.ctx.createBufferSource();
    this.tireSource.buffer = this.noiseBuffer;
    this.tireSource.loop = true;
    this.tireSource.connect(this.tireFilter);
    this.tireFilter.connect(this.tireGain);
    this.tireGain.connect(this.masterGain);
    this.tireSource.start();
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
    launchControlActive: boolean,
    boostPsi: number,
    turboEnabled: boolean,
    tireSlipPercent: number,
    currentGear: number,
    quarterMileActive: boolean
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

    this.updateTurboSound(rpm, throttle, boostPsi, turboEnabled, currentGear, now);
    this.updateTireSound(tireSlipPercent, quarterMileActive, rpm);

    this.prevThrottle = throttle;
    this.prevGear = currentGear;
    this.prevBoostPsi = boostPsi;
  }

  private updateTurboSound(
    rpm: number,
    throttle: number,
    boostPsi: number,
    turboEnabled: boolean,
    currentGear: number,
    now: number
  ): void {
    if (!turboEnabled) {
      if (this.turboSpoolGain) this.turboSpoolGain.gain.value = 0;
      if (this.turboWhistleGain) this.turboWhistleGain.gain.value = 0;
      return;
    }

    const boostNorm = Math.min(Math.max(boostPsi, 0) / 20, 1);
    const rpmNorm = Math.min(rpm / 8500, 1);

    if (this.turboSpoolFilter) {
      const spoolFreq = 600 + boostNorm * 2400 + rpmNorm * 800;
      this.turboSpoolFilter.frequency.value = spoolFreq;
      this.turboSpoolFilter.Q.value = 2 + boostNorm * 4;
    }

    if (this.turboSpoolGain) {
      const spoolVol = boostNorm * 0.12 + rpmNorm * 0.03 + throttle * 0.02;
      this.turboSpoolGain.gain.value = Math.min(spoolVol, 0.18);
    }

    if (this.turboWhistleOsc && this.turboWhistleGain && this.turboWhistleFilter) {
      const whistleBaseFreq = 3000 + boostNorm * 5000 + rpmNorm * 2000;
      this.turboWhistleOsc.frequency.value = whistleBaseFreq;
      this.turboWhistleFilter.frequency.value = whistleBaseFreq;
      const whistleVol = boostNorm > 0.3 ? (boostNorm - 0.3) * 0.15 : 0;
      this.turboWhistleGain.gain.value = Math.min(whistleVol, 0.12);
    }

    const throttleDrop = this.prevThrottle - throttle;
    const gearChanged = currentGear !== this.prevGear && this.prevGear > 0;
    const boostDrop = this.prevBoostPsi - boostPsi;

    if ((throttleDrop > 0.2 || gearChanged) && this.prevBoostPsi > 3 && now - this.lastBovTime > 0.4) {
      this.scheduleBov(now, this.prevBoostPsi);
      this.lastBovTime = now;
    } else if (boostDrop > 2 && this.prevBoostPsi > 5 && now - this.lastBovTime > 0.5) {
      this.scheduleBov(now, this.prevBoostPsi);
      this.lastBovTime = now;
    }
  }

  private scheduleBov(time: number, boostAtRelease: number): void {
    if (!this.ctx || !this.noiseBuffer || !this.masterGain) return;

    const intensity = Math.min(boostAtRelease / 15, 1);
    const duration = 0.15 + intensity * 0.25;
    const volume = 0.1 + intensity * 0.2;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const hiPass = this.ctx.createBiquadFilter();
    hiPass.type = 'highpass';
    hiPass.frequency.value = 1500 + intensity * 1000;
    hiPass.Q.value = 1;

    const bandPass = this.ctx.createBiquadFilter();
    bandPass.type = 'bandpass';
    bandPass.frequency.value = 2500 + intensity * 2000;
    bandPass.Q.value = 3 + intensity * 3;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.setValueAtTime(volume * 0.9, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    const freqSweep = this.ctx.createBiquadFilter();
    freqSweep.type = 'bandpass';
    freqSweep.Q.value = 2;
    freqSweep.frequency.setValueAtTime(4000 + intensity * 3000, time);
    freqSweep.frequency.exponentialRampToValueAtTime(800, time + duration);

    src.connect(hiPass);
    hiPass.connect(bandPass);
    bandPass.connect(freqSweep);
    freqSweep.connect(gain);
    gain.connect(this.masterGain);

    src.start(time);
    src.stop(time + duration + 0.01);

    src.onended = () => {
      src.disconnect();
      hiPass.disconnect();
      bandPass.disconnect();
      freqSweep.disconnect();
      gain.disconnect();
    };
  }

  private updateTireSound(tireSlipPercent: number, quarterMileActive: boolean, rpm: number): void {
    if (tireSlipPercent < 3) {
      if (this.tireGain) this.tireGain.gain.value = 0;
      return;
    }

    const slipNorm = Math.min((tireSlipPercent - 3) / 30, 1);

    if (this.tireFilter) {
      const tireFreq = 800 + slipNorm * 2000 + (rpm / 8500) * 500;
      this.tireFilter.frequency.value = tireFreq;
      this.tireFilter.Q.value = 1 + slipNorm * 2;
    }

    if (this.tireGain) {
      const chirpVol = slipNorm * 0.2;
      this.tireGain.gain.value = Math.min(chirpVol, 0.2);
    }
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
    if (this.turboSpoolSource) { try { this.turboSpoolSource.stop(); } catch {} this.turboSpoolSource.disconnect(); this.turboSpoolSource = null; }
    if (this.turboWhistleOsc) { try { this.turboWhistleOsc.stop(); } catch {} this.turboWhistleOsc.disconnect(); this.turboWhistleOsc = null; }
    if (this.tireSource) { try { this.tireSource.stop(); } catch {} this.tireSource.disconnect(); this.tireSource = null; }

    if (this.gain1) { this.gain1.disconnect(); this.gain1 = null; }
    if (this.gain2) { this.gain2.disconnect(); this.gain2 = null; }
    if (this.gain3) { this.gain3.disconnect(); this.gain3 = null; }
    if (this.gain4) { this.gain4.disconnect(); this.gain4 = null; }
    if (this.noiseGain) { this.noiseGain.disconnect(); this.noiseGain = null; }
    if (this.noiseFilter) { this.noiseFilter.disconnect(); this.noiseFilter = null; }
    if (this.popFilter) { this.popFilter.disconnect(); this.popFilter = null; }
    if (this.popGain) { this.popGain.disconnect(); this.popGain = null; }
    if (this.turboSpoolGain) { this.turboSpoolGain.disconnect(); this.turboSpoolGain = null; }
    if (this.turboSpoolFilter) { this.turboSpoolFilter.disconnect(); this.turboSpoolFilter = null; }
    if (this.turboWhistleGain) { this.turboWhistleGain.disconnect(); this.turboWhistleGain = null; }
    if (this.turboWhistleFilter) { this.turboWhistleFilter.disconnect(); this.turboWhistleFilter = null; }
    if (this.tireGain) { this.tireGain.disconnect(); this.tireGain = null; }
    if (this.tireFilter) { this.tireFilter.disconnect(); this.tireFilter = null; }
    if (this.revLimiterGain) { this.revLimiterGain.disconnect(); this.revLimiterGain = null; }
    if (this.masterGain) { this.masterGain.disconnect(); this.masterGain = null; }

    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }

    this.noiseBuffer = null;
  }
}
