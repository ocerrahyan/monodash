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
  private fading = false;

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

      // B16A2 DOHC VTEC primary harmonic - inline 4 firing order creates strong 2nd harmonic
      const real = new Float32Array([0, 0, 1.0, 0.7, 0.5, 0.35, 0.25, 0.15, 0.1, 0.08, 0.05, 0.03]);
      const imag = new Float32Array([0, 0.8, 0.9, 0.5, 0.4, 0.25, 0.18, 0.12, 0.08, 0.05, 0.03, 0.02]);
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

      // High-RPM VTEC rasp - aggressive valve train and intake resonance
      const raspReal = new Float32Array([0, 0, 0.4, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1]);
      const raspImag = new Float32Array([0, 0.6, 0.9, 0.7, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1, 0.08]);
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
      this.noiseFilter.type = 'bandpass';  // Changed to bandpass for more natural intake sound
      this.noiseFilter.frequency.value = 1800;
      this.noiseFilter.Q.value = 0.8;
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
    if (!this.ctx || !this.enabled || this.fading) return;

    // Guard against NaN/Infinity RPM which can freeze the AudioContext
    if (!Number.isFinite(rpm) || rpm < 0) rpm = 800;
    if (!Number.isFinite(throttle)) throttle = 0;
    if (!Number.isFinite(boostPsi)) boostPsi = 0;
    if (!Number.isFinite(tireSlipPercent)) tireSlipPercent = 0;

    const now = this.ctx.currentTime;
    // B16A2 is a 4-cylinder, fires twice per revolution
    // Fundamental frequency for exhaust pulses
    // Clamp to safe range: 25Hz - 600Hz (prevents audio artifacts)
    const fundamentalFreq = Math.min(Math.max((rpm / 60) * 2, 25), 600);

    // Primary exhaust tone
    if (this.osc1) this.osc1.frequency.value = fundamentalFreq;
    // Second harmonic (dominant in inline-4)
    if (this.osc2) this.osc2.frequency.value = Math.min(fundamentalFreq * 2, 1200);
    // Third harmonic (VTEC rasp)
    if (this.osc3) this.osc3.frequency.value = Math.min(fundamentalFreq * 3, 1800);
    // Sub-bass rumble
    if (this.osc4) this.osc4.frequency.value = Math.max(fundamentalFreq * 0.5, 20);

    const rpmNorm = Math.min(rpm / 8500, 1);
    // More aggressive volume curve - louder at high RPM
    const baseVol = 0.04 + throttle * 0.18 + rpmNorm * 0.12;
    const masterVol = Math.min(baseVol, 0.35);

    if (this.masterGain) {
      this.masterGain.gain.value = masterVol;
    }

    // Layer mixing for B16A2 character
    // Layer 1: Primary exhaust tone
    let layer1Vol = 0.6 + rpmNorm * 0.4;
    // Layer 2: Second harmonic (dominant in inline-4, gives the "buzz")
    let layer2Vol = 0.5 + rpmNorm * 0.3;
    // Layer 3: High frequency rasp (VTEC engagement)
    let layer3Vol = 0.15 + rpmNorm * 0.25;
    // Layer 4: Sub-bass (more at low RPM, fades as RPM increases)
    const subFade = rpm < 3500 ? 1 - (rpm / 3500) * 0.7 : 0.3 * (1 - Math.min((rpm - 3500) / 5000, 1));
    let layer4Vol = 0.25 * subFade;

    if (!this.prevVtec && vtecActive) {
      this.vtecTransitionTime = now;
    }
    this.prevVtec = vtecActive;

    if (vtecActive) {
      // VTEC yo! - dramatic change in sound character above 5500 RPM
      layer3Vol *= 2.2;  // Much more rasp
      layer1Vol *= 1.15; // Slightly louder primary
      layer2Vol *= 1.5;  // More aggressive second harmonic

      const timeSinceVtec = now - this.vtecTransitionTime;
      if (timeSinceVtec < 0.4) {
        // Dramatic burst when VTEC engages
        const burst = 1 + (0.4 - timeSinceVtec) * 3;
        layer3Vol *= burst;
        layer2Vol *= (1 + (0.4 - timeSinceVtec) * 1.5);
      }
    }

    if (this.gain1) this.gain1.gain.value = layer1Vol;
    if (this.gain2) this.gain2.gain.value = layer2Vol;
    if (this.gain3) this.gain3.gain.value = layer3Vol;
    if (this.gain4) this.gain4.gain.value = layer4Vol;

    // Intake/mechanical noise - more prominent for realism
    if (this.noiseGain) {
      this.noiseGain.gain.value = 0.025 + rpmNorm * 0.08 + throttle * 0.03;
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

  private fadeToken = 0;
  private fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  fadeOut(durationMs: number = 500): void {
    if (!this.ctx || !this.masterGain) return;
    this.fading = true;
    const token = ++this.fadeToken;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
    if (this.fadeTimeoutId !== null) clearTimeout(this.fadeTimeoutId);
    this.fadeTimeoutId = setTimeout(() => {
      if (this.fadeToken === token) {
        this.enabled = false;
        this.fading = false;
      }
      this.fadeTimeoutId = null;
    }, durationMs);
  }

  cancelFade(): void {
    this.fadeToken++;
    this.fading = false;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    }
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
    this.fading = false;
    if (this.fadeTimeoutId !== null) {
      clearTimeout(this.fadeTimeoutId);
      this.fadeTimeoutId = null;
    }

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
