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
  tireRpm: number;
  speedMph: number;
  distanceFt: number;
  elapsedTime: number;
  accelerationG: number;
  quarterMileET: number | null;
  quarterMileActive: boolean;
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

const TIRE_DIAMETER_IN = 26;
const TIRE_CIRCUMFERENCE_FT = (TIRE_DIAMETER_IN * Math.PI) / 12;
const FINAL_DRIVE_RATIO = 3.73;
const GEAR_RATIOS = [3.42, 2.14, 1.45, 1.0, 0.78];
const VEHICLE_MASS_LB = 3200;
const VEHICLE_MASS_KG = VEHICLE_MASS_LB * 0.4536;
const DRAG_COEFF = 0.35;
const FRONTAL_AREA_M2 = 2.2;
const AIR_DENSITY = 1.225;
const ROLLING_RESISTANCE = 0.015;
const QUARTER_MILE_FT = 1320;
const DRIVETRAIN_LOSS = 0.15;

function getGear(speedMph: number): number {
  if (speedMph < 15) return 0;
  if (speedMph < 35) return 1;
  if (speedMph < 60) return 2;
  if (speedMph < 90) return 3;
  return 4;
}

export function createEngineSimulation() {
  let crankAngle = 0;
  let currentRpm = 850;
  let targetRpm = 850;
  let throttle = 0;
  let coolantTemp = 185;
  let oilTemp = 210;
  let running = true;

  let speedMps = 0;
  let distanceFt = 0;
  let qmElapsedTime = 0;
  let qmET: number | null = null;
  let qmActive = false;
  let prevSpeedMps = 0;

  function setThrottle(value: number) {
    throttle = clamp(value, 0, 1);
    targetRpm = 850 + throttle * 5150;
  }

  function startQuarterMile() {
    speedMps = 0;
    distanceFt = 0;
    qmElapsedTime = 0;
    qmET = null;
    qmActive = true;
    prevSpeedMps = 0;
    throttle = 1.0;
    targetRpm = 6000;
  }

  function resetQuarterMile() {
    speedMps = 0;
    distanceFt = 0;
    qmElapsedTime = 0;
    qmET = null;
    qmActive = false;
    prevSpeedMps = 0;
    throttle = 0;
    targetRpm = 850;
  }

  function update(deltaMs: number): EngineState {
    const dt = deltaMs / 1000;

    if (qmActive && qmET === null) {
      const speedMph = speedMps * 2.237;
      const gear = getGear(speedMph);
      const gearRatio = GEAR_RATIOS[gear];
      const totalRatio = gearRatio * FINAL_DRIVE_RATIO;

      const wheelRps = speedMps / (TIRE_CIRCUMFERENCE_FT * 0.3048);
      const drivenRpm = wheelRps * 60 * totalRatio;

      const launchRpm = 4500;
      const clutchSlipThreshold = 2000;
      let effectiveRpm: number;
      if (drivenRpm < clutchSlipThreshold) {
        const blend = drivenRpm / clutchSlipThreshold;
        effectiveRpm = lerp(launchRpm, drivenRpm, blend * blend);
      } else {
        effectiveRpm = drivenRpm;
      }
      currentRpm = clamp(Math.max(effectiveRpm, 1500), 1500, 6200);

      const baseTorque = 15 + throttle * 50;
      const rpmFactor = 1 - Math.pow((currentRpm - 3500) / 3500, 2) * 0.3;
      const engineTorqueNm = baseTorque * rpmFactor * 1.3558;

      const wheelRadius = TIRE_DIAMETER_IN * 0.0254 / 2;
      const wheelForceN = (engineTorqueNm * totalRatio * (1 - DRIVETRAIN_LOSS)) / wheelRadius;

      const dragForceN = 0.5 * AIR_DENSITY * DRAG_COEFF * FRONTAL_AREA_M2 * speedMps * speedMps;
      const rollingForceN = ROLLING_RESISTANCE * VEHICLE_MASS_KG * 9.81;

      const netForceN = wheelForceN - dragForceN - rollingForceN;
      const accelMps2 = netForceN / VEHICLE_MASS_KG;

      prevSpeedMps = speedMps;
      speedMps = Math.max(speedMps + accelMps2 * dt, 0);
      const avgSpeedMps = (prevSpeedMps + speedMps) / 2;
      distanceFt += avgSpeedMps * dt * 3.28084;
      qmElapsedTime += dt;

      if (distanceFt >= QUARTER_MILE_FT) {
        const overshootFt = distanceFt - QUARTER_MILE_FT;
        const overshootTime = avgSpeedMps > 0 ? (overshootFt * 0.3048) / avgSpeedMps : 0;
        qmET = qmElapsedTime - overshootTime;
        distanceFt = QUARTER_MILE_FT;
      }
    } else if (!qmActive) {
      const rpmAccelRate = throttle > (currentRpm - 850) / 5150 ? 3000 : 4000;
      currentRpm = lerp(currentRpm, targetRpm, clamp(dt * rpmAccelRate / 5000, 0, 0.15));
      currentRpm = clamp(currentRpm, 800, 6200);
    }

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

    const speedMph = speedMps * 2.237;
    const gear = getGear(speedMph);
    const gearRatio = GEAR_RATIOS[gear];
    const totalRatio = gearRatio * FINAL_DRIVE_RATIO;
    const tireRpm = qmActive ? (speedMps / (TIRE_CIRCUMFERENCE_FT * 0.3048)) * 60 : currentRpm / totalRatio;

    const accelG = dt > 0 ? (speedMps - prevSpeedMps) / (dt * 9.81) : 0;

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
      tireRpm: Math.round(tireRpm),
      speedMph: Math.round(speedMph * 10) / 10,
      distanceFt: Math.round(distanceFt * 10) / 10,
      elapsedTime: Math.round(qmElapsedTime * 1000) / 1000,
      accelerationG: Math.round(clamp(accelG, 0, 5) * 100) / 100,
      quarterMileET: qmET !== null ? Math.round(qmET * 1000) / 1000 : null,
      quarterMileActive: qmActive,
    };
  }

  return { update, setThrottle, startQuarterMile, resetQuarterMile, isRunning: () => running };
}
