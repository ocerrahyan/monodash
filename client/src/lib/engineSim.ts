export interface EngineState {
  rpm: number;
  throttlePosition: number;
  crankAngle: number;
  strokePhase: string;
  cylinderPressure: number;
  intakeManifoldPressure: number;
  exhaustGasTemp: number;
  coolantTemp: number;
  oilTemp: number;
  oilPressure: number;
  airFuelRatio: number;
  ignitionTiming: number;
  intakeValveLift: number;
  exhaustValveLift: number;
  sparkAdvance: number;
  fuelInjectionPulse: number;
  volumetricEfficiency: number;
  torque: number;
  horsepower: number;
  fuelConsumption: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getStrokePhase(crankAngle: number): string {
  const normalized = ((crankAngle % 720) + 720) % 720;
  if (normalized < 180) return "INTAKE";
  if (normalized < 360) return "COMPRESSION";
  if (normalized < 540) return "POWER";
  return "EXHAUST";
}

function getValveLift(crankAngle: number, isIntake: boolean): number {
  const normalized = ((crankAngle % 720) + 720) % 720;
  const maxLift = 9.5;

  if (isIntake) {
    if (normalized >= 350 || normalized < 190) {
      const pos = normalized >= 350 ? normalized - 350 : normalized + 10;
      const mid = 100;
      const halfWidth = 100;
      const dist = Math.abs(pos - mid) / halfWidth;
      return maxLift * Math.max(0, 1 - dist * dist);
    }
    return 0;
  } else {
    if (normalized >= 490 && normalized < 730) {
      const pos = normalized - 490;
      const mid = 120;
      const halfWidth = 120;
      const dist = Math.abs(pos - mid) / halfWidth;
      return maxLift * Math.max(0, 1 - dist * dist);
    }
    return 0;
  }
}

function getCylinderPressure(crankAngle: number, throttle: number, rpm: number): number {
  const normalized = ((crankAngle % 720) + 720) % 720;
  const loadFactor = 0.3 + throttle * 0.7;

  if (normalized < 180) {
    return 14.7 * (0.7 + throttle * 0.3);
  }
  if (normalized < 360) {
    const progress = (normalized - 180) / 180;
    const compressionRatio = 10.5;
    const pressure = 14.7 * Math.pow(compressionRatio, 1.3 * progress) * loadFactor;
    return pressure;
  }
  if (normalized < 540) {
    const progress = (normalized - 360) / 180;
    if (progress < 0.05) {
      return 600 * loadFactor + (rpm / 6000) * 200;
    }
    const peakPressure = 600 * loadFactor + (rpm / 6000) * 200;
    return peakPressure * Math.exp(-3 * progress);
  }
  const progress = (normalized - 540) / 180;
  return lerp(30, 16, progress);
}

export function createEngineSimulation() {
  let crankAngle = 0;
  let currentRpm = 850;
  let targetRpm = 850;
  let throttle = 0;
  let coolantTemp = 185;
  let oilTemp = 210;
  let running = true;

  function setThrottle(value: number) {
    throttle = clamp(value, 0, 1);
    targetRpm = 850 + throttle * 5150;
  }

  function update(deltaMs: number): EngineState {
    const dt = deltaMs / 1000;

    const rpmAccelRate = throttle > (currentRpm - 850) / 5150 ? 3000 : 4000;
    currentRpm = lerp(currentRpm, targetRpm, clamp(dt * rpmAccelRate / 5000, 0, 0.15));
    currentRpm = clamp(currentRpm, 800, 6200);

    const degreesPerSecond = currentRpm * 360 / 60;
    crankAngle = (crankAngle + degreesPerSecond * dt) % 720;

    const targetCoolant = 180 + (currentRpm / 6000) * 25 + throttle * 10;
    coolantTemp = lerp(coolantTemp, targetCoolant, dt * 0.05);

    const targetOil = 200 + (currentRpm / 6000) * 30 + throttle * 15;
    oilTemp = lerp(oilTemp, targetOil, dt * 0.03);

    const cylinderPressure = getCylinderPressure(crankAngle, throttle, currentRpm);
    const intakeValveLift = getValveLift(crankAngle, true);
    const exhaustValveLift = getValveLift(crankAngle, false);

    const baseTorque = 15 + throttle * 50;
    const rpmFactor = 1 - Math.pow((currentRpm - 3500) / 3500, 2) * 0.3;
    const torque = baseTorque * rpmFactor;
    const hp = (torque * currentRpm) / 5252;

    const baseMAP = 30 + throttle * 71;
    const intakeManifoldPressure = clamp(baseMAP + Math.sin(crankAngle * Math.PI / 180) * 3, 20, 102);

    const baseEGT = 400 + throttle * 800 + (currentRpm / 6000) * 300;
    const exhaustGasTemp = baseEGT + Math.random() * 10 - 5;

    const baseAFR = throttle > 0.8 ? 12.5 : throttle > 0.5 ? 13.5 : 14.7;
    const airFuelRatio = baseAFR + Math.random() * 0.3 - 0.15;

    const oilPressure = 15 + (currentRpm / 6000) * 50 + throttle * 5;
    const ignitionTiming = 10 + (currentRpm / 6000) * 25 - throttle * 5;
    const sparkAdvance = ignitionTiming + 2;

    const fuelInjectionPulse = 2 + throttle * 8 + (currentRpm / 6000) * 3;
    const volumetricEfficiency = 75 + throttle * 20 - Math.abs(currentRpm - 4000) / 4000 * 15;
    const fuelConsumption = (currentRpm * fuelInjectionPulse * 0.001) / 60;

    return {
      rpm: Math.round(currentRpm),
      throttlePosition: Math.round(throttle * 100),
      crankAngle: Math.round(crankAngle),
      strokePhase: getStrokePhase(crankAngle),
      cylinderPressure: Math.round(cylinderPressure * 10) / 10,
      intakeManifoldPressure: Math.round(intakeManifoldPressure * 10) / 10,
      exhaustGasTemp: Math.round(exhaustGasTemp),
      coolantTemp: Math.round(coolantTemp),
      oilTemp: Math.round(oilTemp),
      oilPressure: Math.round(oilPressure * 10) / 10,
      airFuelRatio: Math.round(airFuelRatio * 100) / 100,
      ignitionTiming: Math.round(ignitionTiming * 10) / 10,
      intakeValveLift: Math.round(intakeValveLift * 100) / 100,
      exhaustValveLift: Math.round(exhaustValveLift * 100) / 100,
      sparkAdvance: Math.round(sparkAdvance * 10) / 10,
      fuelInjectionPulse: Math.round(fuelInjectionPulse * 100) / 100,
      volumetricEfficiency: Math.round(volumetricEfficiency * 10) / 10,
      torque: Math.round(torque * 10) / 10,
      horsepower: Math.round(hp * 10) / 10,
      fuelConsumption: Math.round(fuelConsumption * 1000) / 1000,
    };
  }

  return { update, setThrottle, isRunning: () => running };
}
