export interface EcuConfig {
  redlineRpm: number;
  fuelCutRpm: number;
  revLimitType: 'fuel_cut' | 'ignition_cut' | 'both';
  softCutRpm: number;
  softCutRetard: number;
  speedLimiterMph: number;

  vtecEngageRpm: number;
  vtecDisengageRpm: number;
  vtecOilPressureMin: number;

  injectorSizeCc: number;
  fuelPressurePsi: number;
  targetAfrIdle: number;
  targetAfrCruise: number;
  targetAfrWot: number;
  targetAfrVtec: number;
  crankingFuelPw: number;
  warmupEnrichPct: number;
  accelEnrichPct: number;
  decelFuelCutRpm: number;
  closedLoopEnabled: boolean;
  closedLoopAfrTarget: number;

  baseTimingDeg: number;
  maxAdvanceDeg: number;
  idleTimingDeg: number;
  knockRetardDeg: number;
  knockSensitivity: number;
  knockRecoveryRate: number;

  turboEnabled: boolean;
  wastegateBaseDuty: number;
  boostTargetPsi: number;
  boostCutPsi: number;
  antiLagEnabled: boolean;
  antiLagRetard: number;
  boostByGear: number[];

  targetIdleRpm: number;
  idleIacvPosition: number;
  idleIgnitionTiming: number;

  launchControlEnabled: boolean;
  launchControlRpm: number;
  twoStepEnabled: boolean;
  twoStepRpm: number;
  launchRetardDeg: number;
  launchFuelCutPct: number;
  flatFootShiftEnabled: boolean;
  flatFootShiftCutTime: number;

  tractionControlEnabled: boolean;
  tractionSlipThreshold: number;
  tractionRetardDeg: number;
  tractionFuelCutPct: number;
  tractionControlMode: 'mild' | 'moderate' | 'aggressive';

  gearRatios: number[];
  finalDriveRatio: number;
  gearRevLimits: number[];

  vehicleMassLb: number;
  tireDiameterIn: number;
  tireMassLb: number;
  dragCoefficient: number;
  frontalAreaM2: number;
  rollingResistanceCoeff: number;
  drivetrainLossPct: number;

  tireGripCoeff: number;
  wheelbaseM: number;
  cgHeightM: number;
  frontWeightBias: number;
  optimalSlipRatio: number;
  shiftTimeMs: number;

  fanOnTemp: number;
  fanOffTemp: number;
  overtempWarning: number;
  overtempEnrichPct: number;

  mapSensorMaxKpa: number;
  mapSensorMinKpa: number;
  o2SensorType: 'narrowband' | 'wideband';
  coolantSensorOffset: number;

  compressionRatio: number;
}

export function getDefaultEcuConfig(): EcuConfig {
  return {
    redlineRpm: 8200,
    fuelCutRpm: 8300,
    revLimitType: 'fuel_cut',
    softCutRpm: 8000,
    softCutRetard: 10,
    speedLimiterMph: 130,

    vtecEngageRpm: 5500,
    vtecDisengageRpm: 5200,
    vtecOilPressureMin: 25,

    injectorSizeCc: 240,
    fuelPressurePsi: 43,
    targetAfrIdle: 14.7,
    targetAfrCruise: 14.7,
    targetAfrWot: 12.2,
    targetAfrVtec: 11.8,
    crankingFuelPw: 15.0,
    warmupEnrichPct: 15,
    accelEnrichPct: 20,
    decelFuelCutRpm: 1500,
    closedLoopEnabled: true,
    closedLoopAfrTarget: 14.7,

    baseTimingDeg: 12,
    maxAdvanceDeg: 40,
    idleTimingDeg: 14,
    knockRetardDeg: 5,
    knockSensitivity: 5,
    knockRecoveryRate: 1,

    turboEnabled: false,
    wastegateBaseDuty: 50,
    boostTargetPsi: 8,
    boostCutPsi: 15,
    antiLagEnabled: false,
    antiLagRetard: 20,
    boostByGear: [8, 8, 8, 8, 8],

    targetIdleRpm: 750,
    idleIacvPosition: 30,
    idleIgnitionTiming: 14,

    launchControlEnabled: false,
    launchControlRpm: 4500,
    twoStepEnabled: false,
    twoStepRpm: 5000,
    launchRetardDeg: 15,
    launchFuelCutPct: 30,
    flatFootShiftEnabled: false,
    flatFootShiftCutTime: 100,

    tractionControlEnabled: false,
    tractionSlipThreshold: 10,
    tractionRetardDeg: 15,
    tractionFuelCutPct: 20,
    tractionControlMode: 'moderate',

    gearRatios: [3.230, 2.105, 1.458, 1.107, 0.848],
    finalDriveRatio: 4.400,
    gearRevLimits: [8200, 8200, 8200, 8200, 8200],

    vehicleMassLb: 2612,
    tireDiameterIn: 23.5,
    tireMassLb: 16,
    dragCoefficient: 0.34,
    frontalAreaM2: 1.94,
    rollingResistanceCoeff: 0.012,
    drivetrainLossPct: 15,

    tireGripCoeff: 0.85,
    wheelbaseM: 2.620,
    cgHeightM: 0.48,
    frontWeightBias: 0.61,
    optimalSlipRatio: 0.10,
    shiftTimeMs: 250,

    fanOnTemp: 200,
    fanOffTemp: 190,
    overtempWarning: 230,
    overtempEnrichPct: 10,

    mapSensorMaxKpa: 105,
    mapSensorMinKpa: 10,
    o2SensorType: 'narrowband',
    coolantSensorOffset: 0,

    compressionRatio: 10.2,
  };
}

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

  boostPsi: number;
  fanStatus: boolean;
  closedLoopStatus: string;
  launchControlActive: boolean;
  tractionControlActive: boolean;
  knockRetardActive: number;
  fuelCutActive: boolean;
  revLimitActive: boolean;
  turboEnabled: boolean;
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

function getCylinderPressure(crankAngle: number, throttle: number, rpm: number, compressionRatio: number): number {
  const normalized = ((crankAngle % 720) + 720) % 720;
  const loadFactor = 0.3 + throttle * 0.7;

  if (normalized < 180) {
    return 14.7 * (0.7 + throttle * 0.3);
  }
  if (normalized < 360) {
    const progress = (normalized - 180) / 180;
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

function tireGripFromSlip(slipRatio: number, gripCoeff: number, optimalSlip: number): number {
  const absSlip = Math.abs(slipRatio);
  if (absSlip <= optimalSlip) {
    return gripCoeff;
  }
  const fadeoff = (absSlip - optimalSlip) / 0.40;
  return gripCoeff * Math.max(0.60, 1 - fadeoff * 0.35);
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

const QUARTER_MILE_FT = 1320;
const AIR_DENSITY = 1.225;
const GRAVITY = 9.81;
const N_TO_LBS = 0.2248;

interface DerivedConstants {
  tireCircumferenceFt: number;
  tireRadiusM: number;
  tireMassKg: number;
  tireInertia: number;
  totalTireInertia: number;
  vehicleMassKg: number;
  effectiveMassKg: number;
  shiftTimeS: number;
  drivetrainLoss: number;
}

function computeDerived(config: EcuConfig): DerivedConstants {
  const tireCircumferenceFt = (config.tireDiameterIn * Math.PI) / 12;
  const tireRadiusM = config.tireDiameterIn * 0.0254 / 2;
  const tireMassKg = config.tireMassLb * 0.4536;
  const tireInertia = tireMassKg * tireRadiusM * tireRadiusM;
  const totalTireInertia = 4 * tireInertia;
  const vehicleMassKg = config.vehicleMassLb * 0.4536;
  const effectiveMassKg = vehicleMassKg + totalTireInertia / (tireRadiusM * tireRadiusM);
  const shiftTimeS = config.shiftTimeMs / 1000;
  const drivetrainLoss = config.drivetrainLossPct / 100;

  return {
    tireCircumferenceFt,
    tireRadiusM,
    tireMassKg,
    tireInertia,
    totalTireInertia,
    vehicleMassKg,
    effectiveMassKg,
    shiftTimeS,
    drivetrainLoss,
  };
}

export function createEngineSimulation(ecuConfig?: EcuConfig) {
  let config: EcuConfig = ecuConfig ? { ...ecuConfig } : getDefaultEcuConfig();
  let derived = computeDerived(config);

  let crankAngle = 0;
  let currentRpm = config.targetIdleRpm;
  let targetRpm = config.targetIdleRpm;
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

  let vtecActive = false;
  let fanOn = false;
  let currentKnockRetard = 0;
  let boostPsi = 0;
  let prevThrottle = 0;

  function setThrottle(value: number) {
    prevThrottle = throttle;
    throttle = clamp(value, 0, 1);
    targetRpm = config.targetIdleRpm + throttle * (config.redlineRpm - config.targetIdleRpm);
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
    prevThrottle = 0;
    targetRpm = config.targetIdleRpm;
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

  function setEcuConfig(newConfig: EcuConfig) {
    config = { ...newConfig };
    derived = computeDerived(config);
  }

  function getEcuConfig(): EcuConfig {
    return { ...config };
  }

  function update(deltaMs: number): EngineState {
    const dt = deltaMs / 1000;

    const idleRpm = config.targetIdleRpm;
    const redline = config.redlineRpm;
    const fuelCutRpm = config.fuelCutRpm;
    const softCutRpm = config.softCutRpm;

    let wheelForceN = 0;
    let dragForceN = 0;
    let rollingForceN = 0;
    let netForceN = 0;
    let weightTransferN = 0;
    let frontAxleLoadN = derived.vehicleMassKg * GRAVITY * config.frontWeightBias;
    let maxTractionForceN = frontAxleLoadN * config.tireGripCoeff;
    let slipRatio = 0;
    let clutchStatus = "ENGAGED";
    let wheelTorqueFtLb = 0;
    let gearRatio = config.gearRatios[0];
    let totalRatio = gearRatio * config.finalDriveRatio;
    let drivenRpm = 0;

    let launchControlActive = false;
    let tractionControlActive = false;
    let fuelCutActive = false;
    let revLimitActive = false;
    let timingRetardTotal = 0;
    let fuelCutFraction = 0;

    if (currentKnockRetard > 0) {
      currentKnockRetard = Math.max(0, currentKnockRetard - config.knockRecoveryRate * dt);
    }

    if (vtecActive) {
      if (currentRpm < config.vtecDisengageRpm) {
        vtecActive = false;
      }
    } else {
      if (currentRpm >= config.vtecEngageRpm) {
        vtecActive = true;
      }
    }

    if (coolantTemp + config.coolantSensorOffset >= config.fanOnTemp) {
      fanOn = true;
    } else if (coolantTemp + config.coolantSensorOffset <= config.fanOffTemp) {
      fanOn = false;
    }

    if (config.turboEnabled) {
      const rpmFactor = clamp((currentRpm - 2000) / 4000, 0, 1);
      const throttleFactor = throttle;
      const gearTarget = config.boostByGear[clamp(currentGear, 0, config.boostByGear.length - 1)] || config.boostTargetPsi;
      const targetBoost = Math.min(gearTarget, config.boostTargetPsi) * rpmFactor * throttleFactor;
      boostPsi = lerp(boostPsi, targetBoost, dt * 3);
      boostPsi = clamp(boostPsi, 0, config.boostCutPsi);

      if (boostPsi >= config.boostCutPsi) {
        fuelCutActive = true;
        fuelCutFraction = 1.0;
      }
    } else {
      boostPsi = 0;
    }

    const effectiveRevLimit = config.gearRevLimits[clamp(currentGear, 0, config.gearRevLimits.length - 1)] || redline;

    if (currentRpm >= fuelCutRpm || currentRpm >= effectiveRevLimit) {
      revLimitActive = true;
      if (config.revLimitType === 'fuel_cut' || config.revLimitType === 'both') {
        fuelCutActive = true;
        fuelCutFraction = Math.max(fuelCutFraction, 1.0);
      }
      if (config.revLimitType === 'ignition_cut' || config.revLimitType === 'both') {
        timingRetardTotal += config.softCutRetard * 2;
      }
    } else if (currentRpm >= softCutRpm) {
      revLimitActive = true;
      const softCutProg = (currentRpm - softCutRpm) / (fuelCutRpm - softCutRpm);
      timingRetardTotal += config.softCutRetard * softCutProg;
    }

    if (qmActive && qmET === null) {
      if (shiftTimer > 0) {
        shiftTimer -= dt;
        if (shiftTimer < 0) shiftTimer = 0;
      }

      gearRatio = config.gearRatios[clamp(currentGear, 0, config.gearRatios.length - 1)];
      totalRatio = gearRatio * config.finalDriveRatio;
      const wheelRadius = derived.tireRadiusM;

      drivenRpm = (speedMps / wheelRadius) * (60 / (2 * Math.PI)) * totalRatio;

      if (config.launchControlEnabled && currentGear === 0 && speedMps < 1.0) {
        const lcRpm = config.launchControlRpm;
        if (currentRpm > lcRpm) {
          launchControlActive = true;
          timingRetardTotal += config.launchRetardDeg;
          fuelCutFraction = Math.max(fuelCutFraction, config.launchFuelCutPct / 100);
        }
      }

      const launchRpm = 1500 + throttle * 4500;
      const clutchSlipThreshold = 3000;
      let effectiveRpm: number;
      if (drivenRpm < clutchSlipThreshold) {
        const blend = drivenRpm / clutchSlipThreshold;
        effectiveRpm = lerp(launchRpm, drivenRpm, blend * blend);
      } else {
        effectiveRpm = drivenRpm;
      }

      if (launchControlActive) {
        effectiveRpm = Math.min(effectiveRpm, config.launchControlRpm);
      }

      currentRpm = clamp(Math.max(effectiveRpm, idleRpm), idleRpm, fuelCutRpm);

      if (shiftTimer > 0) {
        clutchStatus = "OPEN";
      } else if (drivenRpm < 3000) {
        clutchStatus = "SLIPPING";
      } else {
        clutchStatus = "ENGAGED";
      }

      const gearRedline = config.gearRevLimits[clamp(currentGear, 0, config.gearRevLimits.length - 1)] || redline;
      if (currentRpm >= gearRedline && currentGear < config.gearRatios.length - 1) {
        currentGear++;
        shiftTimer = derived.shiftTimeS;
      }

      if (shiftTimer <= 0) {
        let torqueFtLb = getB16Torque(currentRpm, throttle);

        if (config.turboEnabled && boostPsi > 0) {
          const boostMultiplier = 1 + (boostPsi / 14.7) * 0.9;
          torqueFtLb *= boostMultiplier;
        }

        const timingFactor = Math.max(0.3, 1 - timingRetardTotal / 60);
        torqueFtLb *= timingFactor;

        const fuelFactor = 1 - fuelCutFraction;
        torqueFtLb *= fuelFactor;

        const engineTorqueNm = torqueFtLb * 1.3558;
        wheelForceN = (engineTorqueNm * totalRatio * (1 - derived.drivetrainLoss)) / wheelRadius;
        wheelTorqueFtLb = torqueFtLb * totalRatio * (1 - derived.drivetrainLoss);
      }

      const prevAccelMps2 = dt > 0 && speedMps > 0.05 ? (speedMps - prevSpeedMps) / dt : 0;
      weightTransferN = (derived.vehicleMassKg * Math.max(prevAccelMps2, 0) * config.cgHeightM) / config.wheelbaseM;
      const staticFrontLoadN = derived.vehicleMassKg * GRAVITY * config.frontWeightBias;
      frontAxleLoadN = Math.max(staticFrontLoadN - weightTransferN, derived.vehicleMassKg * GRAVITY * 0.35);

      maxTractionForceN = frontAxleLoadN * config.tireGripCoeff;

      if (wheelForceN > maxTractionForceN) {
        wheelSpeedMps = currentRpm * 2 * Math.PI * wheelRadius / (totalRatio * 60);
        slipRatio = speedMps > 0.5
          ? (wheelSpeedMps - speedMps) / speedMps
          : 0.20;

        if (config.tractionControlEnabled && Math.abs(slipRatio) * 100 > config.tractionSlipThreshold) {
          tractionControlActive = true;
          const modeMultiplier = config.tractionControlMode === 'mild' ? 0.5 : config.tractionControlMode === 'aggressive' ? 1.5 : 1.0;
          timingRetardTotal += config.tractionRetardDeg * modeMultiplier;
          fuelCutFraction = Math.max(fuelCutFraction, (config.tractionFuelCutPct / 100) * modeMultiplier);
          fuelCutFraction = clamp(fuelCutFraction, 0, 1);

          const tcTimingFactor = Math.max(0.3, 1 - config.tractionRetardDeg * modeMultiplier / 60);
          const tcFuelFactor = 1 - clamp((config.tractionFuelCutPct / 100) * modeMultiplier, 0, 1);
          wheelForceN *= tcTimingFactor * tcFuelFactor;
        }

        const degradedGrip = tireGripFromSlip(slipRatio, config.tireGripCoeff, config.optimalSlipRatio);
        wheelForceN = Math.min(wheelForceN, frontAxleLoadN * degradedGrip);
      }

      dragForceN = 0.5 * AIR_DENSITY * config.dragCoefficient * config.frontalAreaM2 * speedMps * speedMps;
      rollingForceN = config.rollingResistanceCoeff * derived.vehicleMassKg * GRAVITY;

      netForceN = wheelForceN - dragForceN - rollingForceN;
      const accelMps2 = netForceN / derived.effectiveMassKg;

      prevSpeedMps = speedMps;
      speedMps = Math.max(speedMps + accelMps2 * dt, 0);

      const speedLimitMps = config.speedLimiterMph / 2.237;
      if (speedMps > speedLimitMps) {
        speedMps = speedLimitMps;
      }

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
      const rpmAccelRate = throttle > (currentRpm - idleRpm) / (redline - idleRpm) ? 4000 : 5000;
      currentRpm = lerp(currentRpm, targetRpm, clamp(dt * rpmAccelRate / 5000, 0, 0.15));
      currentRpm = clamp(currentRpm, idleRpm - 50, redline);

      if (currentRpm >= fuelCutRpm) {
        revLimitActive = true;
        if (config.revLimitType === 'fuel_cut' || config.revLimitType === 'both') {
          fuelCutActive = true;
        }
        currentRpm = fuelCutRpm;
      }

      tireTemp = lerp(tireTemp, 80, dt * 0.01);
      tireTemp = clamp(tireTemp, 80, 300);

      clutchStatus = "ENGAGED";
      gearRatio = config.gearRatios[0];
      totalRatio = gearRatio * config.finalDriveRatio;
      frontAxleLoadN = derived.vehicleMassKg * GRAVITY * config.frontWeightBias;
      maxTractionForceN = frontAxleLoadN * config.tireGripCoeff;
    }

    const degreesPerSecond = currentRpm * 360 / 60;
    crankAngle = (crankAngle + degreesPerSecond * dt) % 720;

    const targetCoolant = 180 + (currentRpm / 6000) * 25 + throttle * 10;
    coolantTemp = lerp(coolantTemp, targetCoolant, dt * 0.05);
    if (fanOn) {
      coolantTemp = lerp(coolantTemp, coolantTemp - 5, dt * 0.1);
    }

    const targetOil = 200 + (currentRpm / 6000) * 30 + throttle * 15;
    oilTemp = lerp(oilTemp, targetOil, dt * 0.03);

    const cylinderPressure = getCylinderPressure(crankAngle, throttle, currentRpm, config.compressionRatio);
    const intakeValveLift = getValveLift(crankAngle, true);
    const exhaustValveLift = getValveLift(crankAngle, false);

    let torque = getB16Torque(currentRpm, throttle);
    if (config.turboEnabled && boostPsi > 0) {
      const boostMultiplier = 1 + (boostPsi / 14.7) * 0.9;
      torque *= boostMultiplier;
    }
    const hp = (torque * currentRpm) / 5252;

    let baseMAP = 30 + throttle * 71;
    if (config.turboEnabled && boostPsi > 0) {
      baseMAP += boostPsi * 6.895;
    }
    const intakeManifoldPressure = clamp(baseMAP + Math.sin(crankAngle * Math.PI / 180) * 3, 20, config.turboEnabled ? 250 : 102);

    const rpmNorm = currentRpm / redline;
    const baseEGT = 400 + throttle * 900 + rpmNorm * 350;
    let egtExtra = 0;
    if (config.turboEnabled && config.antiLagEnabled && throttle < 0.2 && currentRpm > 3000) {
      egtExtra = 200;
    }
    const exhaustGasTemp = baseEGT + egtExtra + Math.random() * 10 - 5;

    let baseAFR: number;
    if (throttle < 0.05) {
      baseAFR = config.targetAfrIdle;
    } else if (throttle > 0.8) {
      baseAFR = vtecActive ? config.targetAfrVtec : config.targetAfrWot;
    } else if (throttle > 0.5) {
      baseAFR = lerp(config.targetAfrCruise, config.targetAfrWot, (throttle - 0.5) / 0.3);
    } else {
      baseAFR = config.targetAfrCruise;
    }

    if (coolantTemp + config.coolantSensorOffset >= config.overtempWarning) {
      baseAFR -= config.overtempEnrichPct / 100 * baseAFR * 0.1;
    }

    const airFuelRatio = baseAFR + Math.random() * 0.3 - 0.15;

    const oilPressure = 14 + rpmNorm * 55 + throttle * 5;

    let ignitionTiming = config.baseTimingDeg + rpmNorm * (config.maxAdvanceDeg - config.baseTimingDeg) - throttle * 6;
    if (currentRpm < idleRpm + 100) {
      ignitionTiming = config.idleTimingDeg;
    }
    ignitionTiming -= timingRetardTotal;
    ignitionTiming -= currentKnockRetard;
    const sparkAdvance = ignitionTiming + 2;

    const fuelInjectionPulse = 1.8 + throttle * 9 + rpmNorm * 3.5;
    const volumetricEfficiency = vtecActive
      ? 88 + throttle * 12 - Math.abs(currentRpm - 7000) / 7000 * 10
      : 75 + throttle * 15 - Math.abs(currentRpm - 4000) / 4000 * 12;
    const fuelConsumption = (currentRpm * fuelInjectionPulse * 0.001) / 60;

    const speedMph = speedMps * 2.237;
    const tireRpm = qmActive ? (speedMps / (derived.tireCircumferenceFt * 0.3048)) * 60 : 0;

    const accelG = dt > 0 ? (speedMps - prevSpeedMps) / (dt * 9.81) : 0;

    catalystTemp = lerp(catalystTemp, exhaustGasTemp * 0.85, dt * 0.02);

    const engineLoad = clamp(throttle * 100 * (currentRpm / redline) * 0.8 + 20, 0, 100);
    const intakeAirTemp = 75 + (currentRpm / redline) * 15 + throttle * 10 + Math.random() * 2 - 1;
    const mapKPa = intakeManifoldPressure * 0.6895;
    const intakeVacuum = clamp((101.325 - mapKPa) * 0.2953, 0, 25);
    const fuelPressureVal = config.fuelPressurePsi + (intakeManifoldPressure - 30) * 0.1;
    const batteryVoltage = 14.2 - (currentRpm / redline) * 0.3 - throttle * 0.1 + Math.random() * 0.05;

    let o2SensorVoltage: number;
    if (airFuelRatio < 14.7) {
      o2SensorVoltage = 0.7 + Math.random() * 0.2;
    } else {
      o2SensorVoltage = 0.1 + Math.random() * 0.2;
    }

    if (currentRpm > 6000 && throttle > 0.8 && Math.random() < (config.knockSensitivity / 10) * 0.002) {
      knockCount++;
      currentKnockRetard += config.knockRetardDeg;
    }

    const closedLoopStatus = (config.closedLoopEnabled && throttle < 0.7 && currentRpm < redline * 0.8) ? 'CLOSED' : 'OPEN';

    const speedKmh = speedMph * 1.60934;
    const distanceMeters = distanceFt * 0.3048;

    const currentGearDisplay = qmActive ? currentGear + 1 : 0;
    const currentGearRatio = gearRatio;
    const driveshaftRpm = qmActive ? currentRpm / gearRatio : 0;

    const rearAxleLoadN = derived.vehicleMassKg * GRAVITY - frontAxleLoadN;

    const tireSlipPercent = qmActive ? Math.abs(slipRatio) * 100 : 0;

    if (fuelCutFraction > 0) {
      fuelCutActive = true;
    }

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
      fuelPressure: Math.round(fuelPressureVal * 10) / 10,
      batteryVoltage: Math.round(batteryVoltage * 100) / 100,
      o2SensorVoltage: Math.round(o2SensorVoltage * 100) / 100,
      knockCount,
      catalystTemp: Math.round(catalystTemp),
      speedKmh: Math.round(speedKmh * 10) / 10,
      distanceMeters: Math.round(distanceMeters * 10) / 10,

      boostPsi: Math.round(boostPsi * 10) / 10,
      fanStatus: fanOn,
      closedLoopStatus,
      launchControlActive,
      tractionControlActive,
      knockRetardActive: Math.round(currentKnockRetard * 10) / 10,
      fuelCutActive,
      revLimitActive,
      turboEnabled: config.turboEnabled,
    };
  }

  return { update, setThrottle, startQuarterMile, resetQuarterMile, isRunning: () => running, setEcuConfig, getEcuConfig };
}
