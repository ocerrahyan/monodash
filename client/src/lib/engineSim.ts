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

  currentGearDisplay: number;
  currentGearRatio: number;
  driveshaftRpm: number;
  clutchStatus: string;
  wheelTorque: number;
  wheelForce: number;

  frontAxleLoad: number;
  rearAxleLoad: number;
  weightTransfer: number;
  tireSlipPercent: number;
  tractionLimit: number;
  tireTemp: number;

  sixtyFootTime: number | null;
  threeThirtyTime: number | null;
  eighthMileTime: number | null;
  thousandFootTime: number | null;
  trapSpeed: number | null;
  peakAccelG: number;
  peakWheelHp: number;

  dragForce: number;
  rollingResistance: number;
  netForce: number;

  vtecActive: boolean;
  engineLoad: number;
  intakeAirTemp: number;
  intakeVacuum: number;
  fuelPressure: number;
  batteryVoltage: number;
  o2SensorVoltage: number;
  knockCount: number;
  catalystTemp: number;
  speedKmh: number;
  distanceMeters: number;
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
  const maxLift = isIntake ? 10.6 : 9.4;

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
    const compressionRatio = COMPRESSION_RATIO;
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

const TIRE_DIAMETER_IN = 23.5;
const TIRE_CIRCUMFERENCE_FT = (TIRE_DIAMETER_IN * Math.PI) / 12;
const FINAL_DRIVE_RATIO = 4.400;
const GEAR_RATIOS = [3.230, 2.105, 1.458, 1.107, 0.848];
const TIRE_MASS_LB = 16;
const TIRE_MASS_KG = TIRE_MASS_LB * 0.4536;
const TIRE_RADIUS_M = TIRE_DIAMETER_IN * 0.0254 / 2;
const TIRE_INERTIA = TIRE_MASS_KG * TIRE_RADIUS_M * TIRE_RADIUS_M;
const TOTAL_TIRE_INERTIA = 4 * TIRE_INERTIA;
const VEHICLE_MASS_LB = 2612;
const VEHICLE_MASS_KG = VEHICLE_MASS_LB * 0.4536;
const EFFECTIVE_MASS_KG = VEHICLE_MASS_KG + TOTAL_TIRE_INERTIA / (TIRE_RADIUS_M * TIRE_RADIUS_M);
const DRAG_COEFF = 0.34;
const FRONTAL_AREA_M2 = 1.94;
const AIR_DENSITY = 1.225;
const ROLLING_RESISTANCE = 0.012;
const QUARTER_MILE_FT = 1320;
const DRIVETRAIN_LOSS = 0.15;
const REDLINE = 8200;
const IDLE_RPM = 750;
const VTEC_RPM = 5500;
const COMPRESSION_RATIO = 10.2;

const WHEELBASE_M = 2.620;
const CG_HEIGHT_M = 0.48;
const FRONT_WEIGHT_BIAS = 0.61;
const TIRE_GRIP_COEFF = 0.85;
const OPTIMAL_SLIP_RATIO = 0.10;
const SHIFT_TIME_S = 0.25;
const GRAVITY = 9.81;

const N_TO_LBS = 0.2248;

function tireGripFromSlip(slipRatio: number): number {
  const absSlip = Math.abs(slipRatio);
  if (absSlip <= OPTIMAL_SLIP_RATIO) {
    return TIRE_GRIP_COEFF;
  }
  const fadeoff = (absSlip - OPTIMAL_SLIP_RATIO) / 0.40;
  return TIRE_GRIP_COEFF * Math.max(0.60, 1 - fadeoff * 0.35);
}

const B16A2_TORQUE_MAP: [number, number][] = [
  [750, 40], [1000, 50], [1500, 58], [2000, 67], [2500, 75],
  [3000, 82], [3500, 88], [4000, 93], [4500, 96], [5000, 99],
  [5500, 103], [6000, 107], [6500, 109], [7000, 111], [7500, 109],
  [7600, 108], [8000, 100], [8200, 95],
];

function getB16Torque(rpm: number, throttlePos: number): number {
  const clamped = clamp(rpm, B16A2_TORQUE_MAP[0][0], B16A2_TORQUE_MAP[B16A2_TORQUE_MAP.length - 1][0]);
  let i = 0;
  while (i < B16A2_TORQUE_MAP.length - 1 && B16A2_TORQUE_MAP[i + 1][0] <= clamped) i++;
  if (i >= B16A2_TORQUE_MAP.length - 1) return B16A2_TORQUE_MAP[B16A2_TORQUE_MAP.length - 1][1] * throttlePos;
  const [r0, t0] = B16A2_TORQUE_MAP[i];
  const [r1, t1] = B16A2_TORQUE_MAP[i + 1];
  const frac = (clamped - r0) / (r1 - r0);
  const wotTorque = t0 + (t1 - t0) * frac;
  return wotTorque * (0.1 + 0.9 * throttlePos);
}

function getGear(speedMph: number): number {
  if (speedMph < 18) return 0;
  if (speedMph < 38) return 1;
  if (speedMph < 62) return 2;
  if (speedMph < 95) return 3;
  return 4;
}

export function createEngineSimulation() {
  let crankAngle = 0;
  let currentRpm = IDLE_RPM;
  let targetRpm = IDLE_RPM;
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
  let currentGear = 0;
  let shiftTimer = 0;
  let wheelSpeedMps = 0;

  let tireTemp = 80;
  let sixtyFootTime: number | null = null;
  let threeThirtyTime: number | null = null;
  let eighthMileTime: number | null = null;
  let thousandFootTime: number | null = null;
  let trapSpeed: number | null = null;
  let peakAccelG = 0;
  let peakWheelHp = 0;
  let knockCount = 0;
  let catalystTemp = 400;

  function setThrottle(value: number) {
    throttle = clamp(value, 0, 1);
    targetRpm = IDLE_RPM + throttle * (REDLINE - IDLE_RPM);
  }

  function startQuarterMile() {
    speedMps = 0;
    distanceFt = 0;
    qmElapsedTime = 0;
    qmET = null;
    qmActive = true;
    prevSpeedMps = 0;
    currentGear = 0;
    shiftTimer = 0;
    wheelSpeedMps = 0;

    tireTemp = 80;
    sixtyFootTime = null;
    threeThirtyTime = null;
    eighthMileTime = null;
    thousandFootTime = null;
    trapSpeed = null;
    peakAccelG = 0;
    peakWheelHp = 0;
    knockCount = 0;
  }

  function resetQuarterMile() {
    speedMps = 0;
    distanceFt = 0;
    qmElapsedTime = 0;
    qmET = null;
    qmActive = false;
    prevSpeedMps = 0;
    throttle = 0;
    targetRpm = IDLE_RPM;
    currentGear = 0;
    shiftTimer = 0;
    wheelSpeedMps = 0;

    tireTemp = 80;
    sixtyFootTime = null;
    threeThirtyTime = null;
    eighthMileTime = null;
    thousandFootTime = null;
    trapSpeed = null;
    peakAccelG = 0;
    peakWheelHp = 0;
    knockCount = 0;
  }

  function update(deltaMs: number): EngineState {
    const dt = deltaMs / 1000;

    let wheelForceN = 0;
    let dragForceN = 0;
    let rollingForceN = 0;
    let netForceN = 0;
    let weightTransferN = 0;
    let frontAxleLoadN = VEHICLE_MASS_KG * GRAVITY * FRONT_WEIGHT_BIAS;
    let maxTractionForceN = frontAxleLoadN * TIRE_GRIP_COEFF;
    let slipRatio = 0;
    let clutchStatus = "ENGAGED";
    let wheelTorqueFtLb = 0;
    let gearRatio = GEAR_RATIOS[0];
    let totalRatio = gearRatio * FINAL_DRIVE_RATIO;
    let drivenRpm = 0;

    if (qmActive && qmET === null) {
      if (shiftTimer > 0) {
        shiftTimer -= dt;
        if (shiftTimer < 0) shiftTimer = 0;
      }

      gearRatio = GEAR_RATIOS[currentGear];
      totalRatio = gearRatio * FINAL_DRIVE_RATIO;
      const wheelRadius = TIRE_RADIUS_M;

      drivenRpm = (speedMps / wheelRadius) * (60 / (2 * Math.PI)) * totalRatio;

      const launchRpm = 1500 + throttle * 4500;
      const clutchSlipThreshold = 3000;
      let effectiveRpm: number;
      if (drivenRpm < clutchSlipThreshold) {
        const blend = drivenRpm / clutchSlipThreshold;
        effectiveRpm = lerp(launchRpm, drivenRpm, blend * blend);
      } else {
        effectiveRpm = drivenRpm;
      }
      currentRpm = clamp(Math.max(effectiveRpm, IDLE_RPM), IDLE_RPM, REDLINE);

      if (shiftTimer > 0) {
        clutchStatus = "OPEN";
      } else if (drivenRpm < 3000) {
        clutchStatus = "SLIPPING";
      } else {
        clutchStatus = "ENGAGED";
      }

      if (currentRpm >= REDLINE && currentGear < GEAR_RATIOS.length - 1) {
        currentGear++;
        shiftTimer = SHIFT_TIME_S;
      }

      if (shiftTimer <= 0) {
        const torqueFtLb = getB16Torque(currentRpm, throttle);
        const engineTorqueNm = torqueFtLb * 1.3558;
        wheelForceN = (engineTorqueNm * totalRatio * (1 - DRIVETRAIN_LOSS)) / wheelRadius;
        wheelTorqueFtLb = torqueFtLb * totalRatio * (1 - DRIVETRAIN_LOSS);
      }

      const prevAccelMps2 = dt > 0 && speedMps > 0.05 ? (speedMps - prevSpeedMps) / dt : 0;
      weightTransferN = (VEHICLE_MASS_KG * Math.max(prevAccelMps2, 0) * CG_HEIGHT_M) / WHEELBASE_M;
      const staticFrontLoadN = VEHICLE_MASS_KG * GRAVITY * FRONT_WEIGHT_BIAS;
      frontAxleLoadN = Math.max(staticFrontLoadN - weightTransferN, VEHICLE_MASS_KG * GRAVITY * 0.35);

      maxTractionForceN = frontAxleLoadN * TIRE_GRIP_COEFF;

      if (wheelForceN > maxTractionForceN) {
        wheelSpeedMps = currentRpm * 2 * Math.PI * wheelRadius / (totalRatio * 60);
        slipRatio = speedMps > 0.5
          ? (wheelSpeedMps - speedMps) / speedMps
          : 0.20;
        const degradedGrip = tireGripFromSlip(slipRatio);
        wheelForceN = frontAxleLoadN * degradedGrip;
      }

      dragForceN = 0.5 * AIR_DENSITY * DRAG_COEFF * FRONTAL_AREA_M2 * speedMps * speedMps;
      rollingForceN = ROLLING_RESISTANCE * VEHICLE_MASS_KG * GRAVITY;

      netForceN = wheelForceN - dragForceN - rollingForceN;
      const accelMps2 = netForceN / EFFECTIVE_MASS_KG;

      prevSpeedMps = speedMps;
      speedMps = Math.max(speedMps + accelMps2 * dt, 0);
      const avgSpeedMps = (prevSpeedMps + speedMps) / 2;
      distanceFt += avgSpeedMps * dt * 3.28084;
      qmElapsedTime += dt;

      const currentSpeedMph = speedMps * 2.237;

      if (distanceFt >= 60 && sixtyFootTime === null) {
        const overshootFt = distanceFt - 60;
        const overshootTime = avgSpeedMps > 0 ? (overshootFt * 0.3048) / avgSpeedMps : 0;
        sixtyFootTime = qmElapsedTime - overshootTime;
      }
      if (distanceFt >= 330 && threeThirtyTime === null) {
        const overshootFt = distanceFt - 330;
        const overshootTime = avgSpeedMps > 0 ? (overshootFt * 0.3048) / avgSpeedMps : 0;
        threeThirtyTime = qmElapsedTime - overshootTime;
      }
      if (distanceFt >= 660 && eighthMileTime === null) {
        const overshootFt = distanceFt - 660;
        const overshootTime = avgSpeedMps > 0 ? (overshootFt * 0.3048) / avgSpeedMps : 0;
        eighthMileTime = qmElapsedTime - overshootTime;
      }
      if (distanceFt >= 1000 && thousandFootTime === null) {
        const overshootFt = distanceFt - 1000;
        const overshootTime = avgSpeedMps > 0 ? (overshootFt * 0.3048) / avgSpeedMps : 0;
        thousandFootTime = qmElapsedTime - overshootTime;
      }

      const currentAccelG = dt > 0 ? (speedMps - prevSpeedMps) / (dt * 9.81) : 0;
      if (currentAccelG > peakAccelG) peakAccelG = currentAccelG;

      const currentWheelHp = (wheelForceN * speedMps) / 745.7;
      if (currentWheelHp > peakWheelHp) peakWheelHp = currentWheelHp;

      const slipHeat = Math.abs(slipRatio) * dt * 200;
      const forceHeat = (wheelForceN * N_TO_LBS / 5000) * dt * 5;
      tireTemp += slipHeat + forceHeat;
      tireTemp = lerp(tireTemp, 80, dt * 0.01);
      tireTemp = clamp(tireTemp, 80, 300);

      if (distanceFt >= QUARTER_MILE_FT) {
        const overshootFt = distanceFt - QUARTER_MILE_FT;
        const overshootTime = avgSpeedMps > 0 ? (overshootFt * 0.3048) / avgSpeedMps : 0;
        qmET = qmElapsedTime - overshootTime;
        trapSpeed = currentSpeedMph;
        distanceFt = QUARTER_MILE_FT;
      }
    } else if (!qmActive) {
      const rpmAccelRate = throttle > (currentRpm - IDLE_RPM) / (REDLINE - IDLE_RPM) ? 4000 : 5000;
      currentRpm = lerp(currentRpm, targetRpm, clamp(dt * rpmAccelRate / 5000, 0, 0.15));
      currentRpm = clamp(currentRpm, IDLE_RPM - 50, REDLINE);

      tireTemp = lerp(tireTemp, 80, dt * 0.01);
      tireTemp = clamp(tireTemp, 80, 300);

      clutchStatus = "ENGAGED";
      gearRatio = GEAR_RATIOS[0];
      totalRatio = gearRatio * FINAL_DRIVE_RATIO;
      frontAxleLoadN = VEHICLE_MASS_KG * GRAVITY * FRONT_WEIGHT_BIAS;
      maxTractionForceN = frontAxleLoadN * TIRE_GRIP_COEFF;
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

    const torque = getB16Torque(currentRpm, throttle);
    const hp = (torque * currentRpm) / 5252;

    const baseMAP = 30 + throttle * 71;
    const intakeManifoldPressure = clamp(baseMAP + Math.sin(crankAngle * Math.PI / 180) * 3, 20, 102);

    const rpmNorm = currentRpm / REDLINE;
    const baseEGT = 400 + throttle * 900 + rpmNorm * 350;
    const exhaustGasTemp = baseEGT + Math.random() * 10 - 5;

    const baseAFR = throttle > 0.8 ? 12.2 : throttle > 0.5 ? 13.2 : 14.7;
    const airFuelRatio = baseAFR + Math.random() * 0.3 - 0.15;

    const oilPressure = 14 + rpmNorm * 55 + throttle * 5;
    const ignitionTiming = 12 + rpmNorm * 28 - throttle * 6;
    const sparkAdvance = ignitionTiming + 2;

    const fuelInjectionPulse = 1.8 + throttle * 9 + rpmNorm * 3.5;
    const vtecActive = currentRpm >= VTEC_RPM;
    const volumetricEfficiency = vtecActive
      ? 88 + throttle * 12 - Math.abs(currentRpm - 7000) / 7000 * 10
      : 75 + throttle * 15 - Math.abs(currentRpm - 4000) / 4000 * 12;
    const fuelConsumption = (currentRpm * fuelInjectionPulse * 0.001) / 60;

    const speedMph = speedMps * 2.237;
    const tireRpm = qmActive ? (speedMps / (TIRE_CIRCUMFERENCE_FT * 0.3048)) * 60 : 0;

    const accelG = dt > 0 ? (speedMps - prevSpeedMps) / (dt * 9.81) : 0;

    catalystTemp = lerp(catalystTemp, exhaustGasTemp * 0.85, dt * 0.02);

    const engineLoad = clamp(throttle * 100 * (currentRpm / REDLINE) * 0.8 + 20, 0, 100);
    const intakeAirTemp = 75 + (currentRpm / REDLINE) * 15 + throttle * 10 + Math.random() * 2 - 1;
    const mapKPa = intakeManifoldPressure * 0.6895;
    const intakeVacuum = clamp((101.325 - mapKPa) * 0.2953, 0, 25);
    const fuelPressure = 43 + (intakeManifoldPressure - 30) * 0.1;
    const batteryVoltage = 14.2 - (currentRpm / REDLINE) * 0.3 - throttle * 0.1 + Math.random() * 0.05;

    let o2SensorVoltage: number;
    if (airFuelRatio < 14.7) {
      o2SensorVoltage = 0.7 + Math.random() * 0.2;
    } else {
      o2SensorVoltage = 0.1 + Math.random() * 0.2;
    }

    if (currentRpm > 6000 && throttle > 0.8 && Math.random() < 0.001) {
      knockCount++;
    }

    const speedKmh = speedMph * 1.60934;
    const distanceMeters = distanceFt * 0.3048;

    const currentGearDisplay = qmActive ? currentGear + 1 : 0;
    const currentGearRatio = gearRatio;
    const driveshaftRpm = qmActive ? currentRpm / gearRatio : 0;

    const rearAxleLoadN = VEHICLE_MASS_KG * GRAVITY - frontAxleLoadN;

    const tireSlipPercent = qmActive ? Math.abs(slipRatio) * 100 : 0;

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

      currentGearDisplay,
      currentGearRatio: Math.round(currentGearRatio * 1000) / 1000,
      driveshaftRpm: Math.round(driveshaftRpm),
      clutchStatus,
      wheelTorque: Math.round(wheelTorqueFtLb * 10) / 10,
      wheelForce: Math.round(wheelForceN * N_TO_LBS * 10) / 10,

      frontAxleLoad: Math.round(frontAxleLoadN * N_TO_LBS * 10) / 10,
      rearAxleLoad: Math.round(rearAxleLoadN * N_TO_LBS * 10) / 10,
      weightTransfer: qmActive ? Math.round(weightTransferN * N_TO_LBS * 10) / 10 : 0,
      tireSlipPercent: Math.round(tireSlipPercent * 10) / 10,
      tractionLimit: Math.round(maxTractionForceN * N_TO_LBS * 10) / 10,
      tireTemp: Math.round(tireTemp * 10) / 10,

      sixtyFootTime: sixtyFootTime !== null ? Math.round(sixtyFootTime * 1000) / 1000 : null,
      threeThirtyTime: threeThirtyTime !== null ? Math.round(threeThirtyTime * 1000) / 1000 : null,
      eighthMileTime: eighthMileTime !== null ? Math.round(eighthMileTime * 1000) / 1000 : null,
      thousandFootTime: thousandFootTime !== null ? Math.round(thousandFootTime * 1000) / 1000 : null,
      trapSpeed: trapSpeed !== null ? Math.round(trapSpeed * 10) / 10 : null,
      peakAccelG: Math.round(peakAccelG * 100) / 100,
      peakWheelHp: Math.round(peakWheelHp * 10) / 10,

      dragForce: qmActive ? Math.round(dragForceN * N_TO_LBS * 10) / 10 : 0,
      rollingResistance: Math.round(rollingForceN * N_TO_LBS * 10) / 10,
      netForce: Math.round(netForceN * N_TO_LBS * 10) / 10,

      vtecActive,
      engineLoad: Math.round(engineLoad * 10) / 10,
      intakeAirTemp: Math.round(intakeAirTemp * 10) / 10,
      intakeVacuum: Math.round(intakeVacuum * 10) / 10,
      fuelPressure: Math.round(fuelPressure * 10) / 10,
      batteryVoltage: Math.round(batteryVoltage * 100) / 100,
      o2SensorVoltage: Math.round(o2SensorVoltage * 100) / 100,
      knockCount,
      catalystTemp: Math.round(catalystTemp),
      speedKmh: Math.round(speedKmh * 10) / 10,
      distanceMeters: Math.round(distanceMeters * 10) / 10,
    };
  }

  return { update, setThrottle, startQuarterMile, resetQuarterMile, isRunning: () => running };
}
