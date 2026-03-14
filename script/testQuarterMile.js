#!/usr/bin/env node
'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// Quarter Mile Physics Test Script
// ───────────────────────────────────────────────────────────────────────────
// Standalone extraction of the quarter-mile drag-race physics from:
//   d:\Mono5\client\src\lib\engineSim.ts
//
// Tests FWD, RWD, and AWD at stock (~160hp), 500hp, 1000hp, 1500hp, 2000hp
// using the exact formulas from the codebase (kinetic friction traction model,
// weight transfer, Pacejka-derived compound data, contact patch, etc.)
// ═══════════════════════════════════════════════════════════════════════════

// ── Constants (from engineSim.ts) ──
const QUARTER_MILE_FT = 1320;
const GRAVITY = 9.81;
const STD_AIR_DENSITY = 1.225; // kg/m³ at sea level 15°C
const N_TO_LBS = 0.2248;

// ── Helpers (from engineSim.ts) ──
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// ══════════════════════════════════════════════════════════════════
// B16A2 TORQUE MAP — stock dyno curve [RPM, ft-lb]
// (exported as B16A2_TORQUE_MAP in engineSim.ts)
// Peak: 111 ft-lb @ 7000-7500 RPM → ~158.5 HP
// ══════════════════════════════════════════════════════════════════
const B16A2_TORQUE_MAP = [
  [750, 40],   [1000, 50],   [1500, 58],   [2000, 67],   [2500, 75],
  [3000, 82],  [3500, 88],   [4000, 93],   [4500, 96],   [5000, 99],
  [5500, 103], [6000, 107],  [6500, 109],  [7000, 111],  [7500, 111],
  [7600, 110.5], [8000, 100], [8200, 95],
];

// ══════════════════════════════════════════════════════════════════
// VEHICLE CONFIG — Honda Civic EM1 / B16A2 defaults
// (from getDefaultEcuConfig() in engineSim.ts)
// ══════════════════════════════════════════════════════════════════
const CONFIG = {
  redlineRpm: 8200,
  fuelCutRpm: 8300,
  targetIdleRpm: 750,

  gearRatios: [3.230, 2.105, 1.458, 1.107, 0.848],
  finalDriveRatio: 4.400,
  gearRevLimits: [8200, 8200, 8200, 8200, 8200],

  vehicleMassLb: 2659,                              // EM1 curb + driver
  tireDiameterIn: (195 * 0.55 * 2 / 25.4) + 15,    // 195/55R15 → ~23.44"
  tireMassLb: 28,
  dragCoefficient: 0.31,
  frontalAreaM2: 1.85,
  rollingResistanceCoeff: 0.009,
  drivetrainLossPct: 10,

  tireWidthMm: 195,
  tireAspectRatio: 55,
  tireCompound: 'street',
  tireGripPct: 100,
  tireTempSensitivity: 1.0,

  wheelbaseM: 2.620,
  cgHeightM: 0.48,
  frontWeightBias: 0.61,
  shiftTimeMs: 250,
  clutchMaxTorqueNm: 200,

  // Weather (standard conditions)
  ambientTempF: 77,
  humidityPct: 50,
  altitudeFt: 0,
};

// ══════════════════════════════════════════════════════════════════
// TIRE COMPOUND DATA (from TIRE_COMPOUNDS in engineSim.ts)
// baseGrip matches Pacejka D coefficient
// ══════════════════════════════════════════════════════════════════
const TIRE_COMPOUNDS = {
  street:     { baseGrip: 0.88, optimalTempLow:  70, optimalTempHigh: 190, coldGripFactor: 0.97, hotGripFactor: 0.75, heatRate: 1.0, coolRate: 1.0 },
  sport:      { baseGrip: 0.95, optimalTempLow: 100, optimalTempHigh: 200, coldGripFactor: 0.93, hotGripFactor: 0.65, heatRate: 1.4, coolRate: 0.9 },
  semi_slick: { baseGrip: 1.15, optimalTempLow: 140, optimalTempHigh: 250, coldGripFactor: 0.82, hotGripFactor: 0.60, heatRate: 1.5, coolRate: 0.8 },
  full_slick: { baseGrip: 1.30, optimalTempLow: 170, optimalTempHigh: 280, coldGripFactor: 0.72, hotGripFactor: 0.55, heatRate: 2.0, coolRate: 0.7 },
  drag_slick: { baseGrip: 1.50, optimalTempLow: 180, optimalTempHigh: 320, coldGripFactor: 0.68, hotGripFactor: 0.50, heatRate: 2.5, coolRate: 0.6 },
};

// ══════════════════════════════════════════════════════════════════
// KINETIC FRICTION RATIOS (from the traction-limiting block)
// When tires exceed static grip, kinetic friction transmits less
// ══════════════════════════════════════════════════════════════════
const KINETIC_RATIOS = {
  drag_slick: 0.92,
  full_slick: 0.88,
  semi_slick: 0.85,
  sport:      0.82,
  street:     0.78,
};

// ══════════════════════════════════════════════════════════════════
// PHYSICS FUNCTIONS (exact copies from engineSim.ts)
// ══════════════════════════════════════════════════════════════════

/**
 * getB16Torque — interpolates the B16A2 torque map
 * torqueScale multiplies output to simulate different HP levels
 * With stock config (compressionRatio=10.2), getCompressionMultiplier()=1.0
 * With stock cams, getCamTorqueMultiplier()=1.0
 * So torqueScale is the only modifier needed.
 */
function getB16Torque(rpm, throttlePos, torqueScale) {
  const tMap = B16A2_TORQUE_MAP;
  const clamped = clamp(rpm, tMap[0][0], tMap[tMap.length - 1][0]);
  let i = 0;
  while (i < tMap.length - 1 && tMap[i + 1][0] <= clamped) i++;
  if (i >= tMap.length - 1) {
    return tMap[tMap.length - 1][1] * throttlePos * torqueScale;
  }
  const [r0, t0] = tMap[i];
  const [r1, t1] = tMap[i + 1];
  const frac = (clamped - r0) / (r1 - r0);
  const wotTorque = t0 + (t1 - t0) * frac;
  // Throttle scaling: baseTorque = wotTorque * (0.1 + 0.9 * throttlePos)
  const baseTorque = wotTorque * (0.1 + 0.9 * throttlePos);
  return baseTorque * torqueScale;
}

/**
 * getAirDensity — temperature, humidity, altitude model
 * Uses tropospheric pressure lapse + Buck equation for vapor pressure
 */
function getAirDensity(tempF, humidityPct, altitudeFt) {
  const tempK = (tempF - 32) * 5 / 9 + 273.15;
  const pressurePa = 101325 * Math.pow(1 - 2.25577e-5 * (altitudeFt * 0.3048), 5.25588);
  const tempC = tempK - 273.15;
  const pSat = 611.21 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));
  const pVapor = (humidityPct / 100) * pSat;
  const pDry = pressurePa - pVapor;
  return (pDry / (287.058 * tempK)) + (pVapor / (461.495 * tempK));
}

/**
 * getTireGripAtTemp — grip coefficient adjusted for tire temperature
 */
function getTireGripAtTemp(compound, temp, gripPct, sensitivity) {
  const userGripMult = gripPct / 100;
  if (temp >= compound.optimalTempLow && temp <= compound.optimalTempHigh) {
    return compound.baseGrip * userGripMult;
  }
  if (temp < compound.optimalTempLow) {
    const coldDelta = (compound.optimalTempLow - temp) / compound.optimalTempLow;
    const coldPenalty = coldDelta * (1 - compound.coldGripFactor) * sensitivity;
    return compound.baseGrip * userGripMult * Math.max(compound.coldGripFactor, 1 - coldPenalty);
  }
  const hotDelta = (temp - compound.optimalTempHigh) / 100;
  const hotPenalty = hotDelta * (1 - compound.hotGripFactor) * sensitivity;
  return compound.baseGrip * userGripMult * Math.max(compound.hotGripFactor, 1 - hotPenalty);
}

/**
 * getContactPatchArea — tire contact patch size based on load
 */
function getContactPatchArea(widthMm, aspectRatio, loadN) {
  const sectionWidthIn = widthMm / 25.4;
  // sideWallHeight used in original but only widthIn & deflection matter for area
  const deflectionFactor = clamp(loadN / 8000, 0.5, 1.5);
  const patchLengthIn = 3.0 + deflectionFactor * 2.5;
  return sectionWidthIn * patchLengthIn * deflectionFactor * 0.7;
}

/**
 * computeDerived — pre-compute constants from vehicle config
 * (from computeDerived() in engineSim.ts)
 */
function computeDerived(drivetrainType) {
  const tireCircumferenceFt = (CONFIG.tireDiameterIn * Math.PI) / 12;
  const tireRadiusM = CONFIG.tireDiameterIn * 0.0254 / 2;
  const tireMassKg = CONFIG.tireMassLb * 0.4536;
  const tireInertia = 0.75 * tireMassKg * tireRadiusM * tireRadiusM;
  const drivenWheels = drivetrainType === 'AWD' ? 4 : 2;
  const totalTireInertia = drivenWheels * tireInertia;
  const vehicleMassKg = CONFIG.vehicleMassLb * 0.4536;
  const effectiveMassKg = vehicleMassKg + totalTireInertia / (tireRadiusM * tireRadiusM);
  return {
    tireCircumferenceFt,
    tireRadiusM,
    vehicleMassKg,
    effectiveMassKg,
    shiftTimeS: CONFIG.shiftTimeMs / 1000,
    drivetrainLoss: CONFIG.drivetrainLossPct / 100,
    drivenWheels,
  };
}

// ══════════════════════════════════════════════════════════════════
// QUARTER MILE SIMULATION
// Faithfully reproduces the launched quarter-mile update loop
// from createEngineSimulation().update() in engineSim.ts
// ══════════════════════════════════════════════════════════════════
function simulateQuarterMile(hpTarget, drivetrainType) {
  const derived = computeDerived(drivetrainType);
  const compound = TIRE_COMPOUNDS[CONFIG.tireCompound];
  const kineticRatio = KINETIC_RATIOS[CONFIG.tireCompound];
  const airDensity = getAirDensity(CONFIG.ambientTempF, CONFIG.humidityPct, CONFIG.altitudeFt);

  // ── Torque scale factor ──
  // Stock peak: 111 ft-lb @ 7500 RPM = ~158.5 HP
  const STOCK_PEAK_HP = (111 * 7500) / 5252; // 158.51
  const torqueScale = hpTarget / STOCK_PEAK_HP;

  const isFWD = drivetrainType === 'FWD';
  const isRWD = drivetrainType === 'RWD';
  const isAWD = drivetrainType === 'AWD';

  // drivenAxleBias: fraction of vehicle weight on driven axle (static)
  const drivenAxleBias = isFWD ? CONFIG.frontWeightBias
    : isRWD ? (1 - CONFIG.frontWeightBias)
    : 1; // AWD = full vehicle weight for traction

  const wheelRadius = derived.tireRadiusM;
  const dt = 0.001;     // 1 ms timestep for accuracy
  const throttle = 1.0; // WOT
  const idleRpm = CONFIG.targetIdleRpm;
  const fuelCutRpm = CONFIG.fuelCutRpm;
  const redline = CONFIG.redlineRpm;

  // ── Simulation state ──
  let speedMps = 0;
  let prevSpeedMps = 0;
  let distanceFt = 0;
  let qmElapsedTime = 0;
  let currentGear = 0;    // 0-indexed (gear 1 = index 0)
  let shiftTimer = 0;
  let wheelSpeedMps = 0;
  let tireTemp = 100;     // Start warm from staging/burnout
  let slipRatio = 0;

  // RPM: staging revs with clutch in, then clutch dump
  // Without launch control: throttleRpm = idle + throttle*(redline*0.85 - idle) ≈ 6970
  let currentRpm = idleRpm + throttle * (redline * 0.85 - idleRpm);

  // ── Traction state (initialised, updated each frame) ──
  let frontAxleLoadN = derived.vehicleMassKg * GRAVITY * CONFIG.frontWeightBias;
  let rearAxleLoadN  = derived.vehicleMassKg * GRAVITY * (1 - CONFIG.frontWeightBias);
  let drivenAxleLoadN = isFWD ? frontAxleLoadN
    : isRWD ? rearAxleLoadN
    : (frontAxleLoadN + rearAxleLoadN);
  let effectiveGrip = getTireGripAtTemp(compound, tireTemp, CONFIG.tireGripPct, CONFIG.tireTempSensitivity);
  let patchArea = getContactPatchArea(CONFIG.tireWidthMm, CONFIG.tireAspectRatio, drivenAxleLoadN);
  let patchMultiplier = clamp(patchArea / 30, 0.7, 1.4);
  let finalGrip = effectiveGrip * patchMultiplier;
  let maxTractionForceN = drivenAxleLoadN * finalGrip;

  // ── Result accumulators ──
  let sixtyFootTime = null;
  let threeThirtyTime = null;
  let eighthMileTime = null;
  let thousandFootTime = null;
  let qmET = null;
  let trapSpeed = null;
  let zeroToSixtyTime = null;
  let peakAccelG = 0;
  let peakWheelHp = 0;
  let peakSlipPct = 0;
  let shiftCount = 0;

  // Safety limit
  const MAX_TIME = 60;

  // ── Main physics loop ──
  while (distanceFt < QUARTER_MILE_FT && qmElapsedTime < MAX_TIME) {
    qmElapsedTime += dt;

    // Decrement shift timer
    if (shiftTimer > 0) {
      shiftTimer -= dt;
      if (shiftTimer < 0) shiftTimer = 0;
    }

    const gearIdx = clamp(currentGear, 0, CONFIG.gearRatios.length - 1);
    const gearRatio = CONFIG.gearRatios[gearIdx];
    const totalRatio = gearRatio * CONFIG.finalDriveRatio;

    // ════════════════════════════════════════════════════════
    // STEP 1: Determine RPM (wheelspin launch vs wheel-locked)
    // ════════════════════════════════════════════════════════
    // Calculate raw launch force to detect wheelspin
    const launchTorqueFtLb = getB16Torque(currentRpm, throttle, torqueScale);
    const launchTorqueNm = launchTorqueFtLb * 1.3558;
    const launchForceN = (launchTorqueNm * totalRatio * (1 - derived.drivetrainLoss)) / wheelRadius;

    const drivenStaticLoad = derived.vehicleMassKg * GRAVITY * drivenAxleBias;
    const staticGripCoeff = compound.baseGrip * (CONFIG.tireGripPct / 100);
    const maxTractionStatic = drivenStaticLoad * staticGripCoeff;
    const forceRatio = launchForceN / maxTractionStatic;

    // Wheelspin occurs when force significantly exceeds traction at low speed
    const isWheelspinning = forceRatio > 0.95 && throttle > 0.7 && speedMps < 20;

    if (isWheelspinning) {
      // ── WHEELSPIN LAUNCH MODE ──
      // Tires spin: engine RPM = blend of throttle demand & wheel-driven RPM
      const excessRatio = Math.max(0, forceRatio - 0.95);
      slipRatio = Math.min(0.5, excessRatio * 0.25 + 0.05);
      if (speedMps < 5) {
        slipRatio = Math.min(0.6, slipRatio + 0.08);
      }

      wheelSpeedMps = speedMps * (1 + slipRatio);
      const wheelRpm = (wheelSpeedMps / wheelRadius) * (60 / (2 * Math.PI));
      const engineRpmFromWheel = wheelRpm * totalRatio;

      // Throttle-demanded RPM (no launch control)
      const throttleRpm = idleRpm + throttle * (redline * 0.85 - idleRpm);

      // Blend: at standstill → throttle RPM; as speed builds → wheel-driven
      const speedBlend = clamp(speedMps / 15, 0, 1);
      const targetRpm = lerp(throttleRpm, engineRpmFromWheel, speedBlend);

      const rpmDelta = targetRpm - currentRpm;
      currentRpm = clamp(currentRpm + rpmDelta * dt * 10, idleRpm, fuelCutRpm);

    } else {
      // ── NORMAL TRACTION MODE ──
      // Engine RPM locked to wheel speed through drivetrain
      slipRatio = 0;
      wheelSpeedMps = speedMps;

      const vehicleDrivenRpm = (speedMps / wheelRadius) * (60 / (2 * Math.PI)) * totalRatio;

      if (speedMps < 3 && vehicleDrivenRpm < idleRpm * 1.5) {
        // Clutch engagement at very low speed
        const targetRpm = Math.max(idleRpm * 0.9, vehicleDrivenRpm);
        currentRpm = clamp(lerp(currentRpm, targetRpm, dt * 15), idleRpm * 0.7, fuelCutRpm);
      } else {
        currentRpm = clamp(Math.max(vehicleDrivenRpm, idleRpm), idleRpm, fuelCutRpm);
      }
    }

    // ════════════════════════════════════════════════════════
    // STEP 2: Shift logic — upshift at per-gear rev limit
    // ════════════════════════════════════════════════════════
    const gearRedline = CONFIG.gearRevLimits[gearIdx] || redline;
    if (currentRpm >= gearRedline && currentGear < CONFIG.gearRatios.length - 1) {
      currentGear++;
      shiftTimer = derived.shiftTimeS;
      shiftCount++;
    }

    // ════════════════════════════════════════════════════════
    // STEP 3: Compute wheel force (with traction limiting)
    // Uses maxTractionForceN from PREVIOUS frame (matches sim)
    // ════════════════════════════════════════════════════════
    let wheelForceN = 0;

    if (shiftTimer <= 0) {
      const torqueFtLb = getB16Torque(currentRpm, throttle, torqueScale);
      const engineTorqueNm = torqueFtLb * 1.3558;

      // Auto-scale clutch capacity to handle engine output
      const effectiveClutchNm = Math.max(CONFIG.clutchMaxTorqueNm, engineTorqueNm * 1.1);
      const transmittedTorqueNm = Math.min(engineTorqueNm, effectiveClutchNm);

      const rawWheelForceN = (transmittedTorqueNm * totalRatio * (1 - derived.drivetrainLoss)) / wheelRadius;

      // ── KINETIC FRICTION TRACTION MODEL ──
      // Traction limiting strongest at launch, fades as speed builds
      const speedMph = speedMps * 2.237;
      const tractionLimitFactor = clamp(1 - speedMph / 120, 0.05, 1);

      if (rawWheelForceN > maxTractionForceN) {
        // Spinning tires transmit kinetic friction (less than static peak)
        const kineticForce = maxTractionForceN * kineticRatio;
        // At low speed: capped at kinetic; at high speed: full force available
        wheelForceN = kineticForce + (rawWheelForceN - kineticForce) * (1 - tractionLimitFactor);
        // Slip ratio for tracking
        const excessR = rawWheelForceN / maxTractionForceN;
        slipRatio = Math.min(0.7, (excessR - 1) * 0.3 * tractionLimitFactor);
      } else {
        wheelForceN = rawWheelForceN;
      }
    }

    // ════════════════════════════════════════════════════════
    // STEP 4: Weight transfer (uses previous frame's accel)
    // ════════════════════════════════════════════════════════
    const prevAccelMps2 = (dt > 0 && speedMps > 0.05)
      ? (speedMps - prevSpeedMps) / dt
      : 0;
    const weightTransferN = (derived.vehicleMassKg * Math.max(prevAccelMps2, 0) * CONFIG.cgHeightM) / CONFIG.wheelbaseM;

    const staticFrontLoadN = derived.vehicleMassKg * GRAVITY * CONFIG.frontWeightBias;
    const staticRearLoadN  = derived.vehicleMassKg * GRAVITY * (1 - CONFIG.frontWeightBias);

    // Under acceleration, load shifts rearward
    frontAxleLoadN = staticFrontLoadN - weightTransferN;
    rearAxleLoadN  = staticRearLoadN  + weightTransferN;

    if (isFWD) {
      // FWD loses front traction under accel (floor at 35% total weight)
      drivenAxleLoadN = Math.max(frontAxleLoadN, derived.vehicleMassKg * GRAVITY * 0.35);
    } else if (isRWD) {
      // RWD gains rear traction under accel
      drivenAxleLoadN = rearAxleLoadN;
    } else {
      // AWD: total vehicle weight
      drivenAxleLoadN = frontAxleLoadN + rearAxleLoadN;
    }

    // ════════════════════════════════════════════════════════
    // STEP 5: Update grip & maxTractionForceN for next frame
    // ════════════════════════════════════════════════════════
    effectiveGrip = getTireGripAtTemp(compound, tireTemp, CONFIG.tireGripPct, CONFIG.tireTempSensitivity);
    patchArea = getContactPatchArea(CONFIG.tireWidthMm, CONFIG.tireAspectRatio, drivenAxleLoadN);
    patchMultiplier = clamp(patchArea / 30, 0.7, 1.4);
    finalGrip = effectiveGrip * patchMultiplier;
    maxTractionForceN = drivenAxleLoadN * finalGrip;

    // ════════════════════════════════════════════════════════
    // STEP 6: Aero drag + rolling resistance
    // ════════════════════════════════════════════════════════
    const dragForceN    = 0.5 * airDensity * CONFIG.dragCoefficient * CONFIG.frontalAreaM2 * speedMps * speedMps;
    const rollingForceN = CONFIG.rollingResistanceCoeff * derived.vehicleMassKg * GRAVITY;

    // ════════════════════════════════════════════════════════
    // STEP 7: Net force → acceleration → velocity → distance
    // ════════════════════════════════════════════════════════
    const netForceN = wheelForceN - dragForceN - rollingForceN;
    const accelMps2 = netForceN / derived.effectiveMassKg;

    prevSpeedMps = speedMps;
    speedMps = Math.max(speedMps + accelMps2 * dt, 0);

    const avgSpeedMps = (prevSpeedMps + speedMps) / 2;
    distanceFt += avgSpeedMps * dt * 3.28084;

    // ════════════════════════════════════════════════════════
    // STEP 8: Tire temperature model
    // ════════════════════════════════════════════════════════
    const slipHeat  = Math.abs(slipRatio) * dt * 200 * compound.heatRate;
    const forceHeat = (wheelForceN * N_TO_LBS / 5000) * dt * 5 * compound.heatRate;
    tireTemp += slipHeat + forceHeat;
    tireTemp = lerp(tireTemp, 80, dt * 0.01 * compound.coolRate);
    tireTemp = clamp(tireTemp, 80, 400);

    // ════════════════════════════════════════════════════════
    // STEP 9: Record timing markers (with overshoot interpolation)
    // ════════════════════════════════════════════════════════
    const speedMph = speedMps * 2.237;

    if (distanceFt >= 60 && sixtyFootTime === null) {
      const overshoot = distanceFt - 60;
      sixtyFootTime = qmElapsedTime - (avgSpeedMps > 0 ? (overshoot * 0.3048) / avgSpeedMps : 0);
    }
    if (distanceFt >= 330 && threeThirtyTime === null) {
      const overshoot = distanceFt - 330;
      threeThirtyTime = qmElapsedTime - (avgSpeedMps > 0 ? (overshoot * 0.3048) / avgSpeedMps : 0);
    }
    if (distanceFt >= 660 && eighthMileTime === null) {
      const overshoot = distanceFt - 660;
      eighthMileTime = qmElapsedTime - (avgSpeedMps > 0 ? (overshoot * 0.3048) / avgSpeedMps : 0);
    }
    if (distanceFt >= 1000 && thousandFootTime === null) {
      const overshoot = distanceFt - 1000;
      thousandFootTime = qmElapsedTime - (avgSpeedMps > 0 ? (overshoot * 0.3048) / avgSpeedMps : 0);
    }
    if (speedMph >= 60 && zeroToSixtyTime === null) {
      zeroToSixtyTime = qmElapsedTime;
    }

    // Peak stats
    const accelG = (dt > 0) ? (speedMps - prevSpeedMps) / (dt * GRAVITY) : 0;
    if (accelG > peakAccelG) peakAccelG = accelG;
    const wheelHp = (wheelForceN * speedMps) / 745.7;
    if (wheelHp > peakWheelHp) peakWheelHp = wheelHp;
    const slipPct = Math.abs(slipRatio) * 100;
    if (slipPct > peakSlipPct) peakSlipPct = slipPct;
  }

  // ── Finish line interpolation ──
  if (distanceFt >= QUARTER_MILE_FT) {
    const overshootFt = distanceFt - QUARTER_MILE_FT;
    const overshootTime = speedMps > 0 ? (overshootFt * 0.3048) / speedMps : 0;
    qmET = qmElapsedTime - overshootTime;
    trapSpeed = speedMps * 2.237;
  }

  return {
    hpTarget,
    drivetrainType,
    torqueScale: Math.round(torqueScale * 1000) / 1000,
    et: qmET,
    trapSpeed,
    sixtyFootTime,
    threeThirtyTime,
    eighthMileTime,
    thousandFootTime,
    zeroToSixtyTime,
    peakAccelG,
    peakWheelHp,
    peakSlipPct,
    shiftCount,
    finalGear: currentGear + 1,
  };
}

// ══════════════════════════════════════════════════════════════════
// RUN ALL TESTS & FORMAT OUTPUT
// ══════════════════════════════════════════════════════════════════

const HP_LEVELS = [160, 500, 1000, 1500, 2000];
const DRIVETRAIN_TYPES = ['FWD', 'RWD', 'AWD'];

function fmt(val, decimals, width) {
  if (val === null || val === undefined) return '-'.padStart(width);
  return val.toFixed(decimals).padStart(width);
}

console.log('');
console.log('================================================================');
console.log('  QUARTER MILE PHYSICS VERIFICATION');
console.log('  Honda Civic EM1 (B16A2) — engine torque scaled for HP targets');
console.log('================================================================');
console.log(`  Vehicle : ${CONFIG.vehicleMassLb} lbs | 5-spd (${CONFIG.gearRatios.join('/')})`);
console.log(`  Final   : ${CONFIG.finalDriveRatio}:1 | Tire: 195/55R15 (${CONFIG.tireDiameterIn.toFixed(2)}" dia)`);
console.log(`  Tires   : ${CONFIG.tireCompound} compound (mu=${TIRE_COMPOUNDS[CONFIG.tireCompound].baseGrip})`);
console.log(`  Cd      : ${CONFIG.dragCoefficient} | A: ${CONFIG.frontalAreaM2} m² | Crr: ${CONFIG.rollingResistanceCoeff}`);
console.log(`  DT loss : ${CONFIG.drivetrainLossPct}% | Shift: ${CONFIG.shiftTimeMs}ms | CG: ${CONFIG.cgHeightM}m`);
console.log(`  Weather : ${CONFIG.ambientTempF}°F, ${CONFIG.humidityPct}% RH, ${CONFIG.altitudeFt}ft ASL`);
console.log(`  Air dens: ${getAirDensity(CONFIG.ambientTempF, CONFIG.humidityPct, CONFIG.altitudeFt).toFixed(4)} kg/m³`);
console.log('================================================================');

for (const dt of DRIVETRAIN_TYPES) {
  const biasStr = dt === 'FWD' ? `(${(CONFIG.frontWeightBias * 100).toFixed(0)}% front static)`
    : dt === 'RWD' ? `(${((1 - CONFIG.frontWeightBias) * 100).toFixed(0)}% rear static)`
    : '(full weight for traction)';
  console.log('');
  console.log(`┌─── ${dt} ${biasStr} ${'─'.repeat(Math.max(0, 62 - dt.length - biasStr.length))}┐`);
  console.log('│  HP   │  ET (s) │ Trap mph │ 60ft (s) │ 0-60 (s) │ Peak G  │ Peak WHP │');
  console.log('├───────┼─────────┼──────────┼──────────┼──────────┼─────────┼──────────┤');

  for (const hp of HP_LEVELS) {
    const r = simulateQuarterMile(hp, dt);
    const et   = fmt(r.et,           3, 7);
    const trap = fmt(r.trapSpeed,    1, 8);
    const ft60 = fmt(r.sixtyFootTime,3, 8);
    const z60  = fmt(r.zeroToSixtyTime,3, 8);
    const pG   = fmt(r.peakAccelG,   2, 7);
    const pWHP = fmt(r.peakWheelHp,  1, 8);
    console.log(`│ ${String(hp).padStart(5)} │ ${et} │ ${trap} │ ${ft60} │ ${z60} │ ${pG} │ ${pWHP} │`);
  }
  console.log('└───────┴─────────┴──────────┴──────────┴──────────┴─────────┴──────────┘');
}

// ── Detailed breakdown ──
console.log('');
console.log('================================================================');
console.log('  DETAILED BREAKDOWN');
console.log('================================================================');

for (const dt of DRIVETRAIN_TYPES) {
  console.log(`\n── ${dt} ──`);
  for (const hp of HP_LEVELS) {
    const r = simulateQuarterMile(hp, dt);
    console.log(`  ${hp} HP (torque scale ${r.torqueScale}x):`);
    console.log(`    ET: ${r.et !== null ? r.et.toFixed(3) : 'DNF'}s @ ${r.trapSpeed !== null ? r.trapSpeed.toFixed(1) : '-'} mph trap`);
    console.log(`    60ft: ${r.sixtyFootTime !== null ? r.sixtyFootTime.toFixed(3) : '-'}s | 330ft: ${r.threeThirtyTime !== null ? r.threeThirtyTime.toFixed(3) : '-'}s | 1/8mi: ${r.eighthMileTime !== null ? r.eighthMileTime.toFixed(3) : '-'}s | 1000ft: ${r.thousandFootTime !== null ? r.thousandFootTime.toFixed(3) : '-'}s`);
    console.log(`    0-60: ${r.zeroToSixtyTime !== null ? r.zeroToSixtyTime.toFixed(3) : '-'}s | Peak G: ${r.peakAccelG.toFixed(2)} | Peak WHP: ${r.peakWheelHp.toFixed(1)} | Peak Slip: ${r.peakSlipPct.toFixed(1)}%`);
    console.log(`    Shifts: ${r.shiftCount} (finished in gear ${r.finalGear})`);
  }
}

console.log('\n================================================================');
console.log('  PHYSICS NOTES');
console.log('================================================================');
console.log('  - Torque: B16A2 stock map scaled linearly to target HP');
console.log('  - Traction: Kinetic friction model (street tires, mu_k ratio=0.78)');
console.log('  - Weight transfer: F = m*a*h/L (CG height / wheelbase)');
console.log('  - FWD penalty: front axle unloads under acceleration');
console.log('  - RWD benefit: rear axle loads up under acceleration');
console.log('  - AWD: full vehicle weight available for traction');
console.log('  - Drag: F = 0.5 * rho * Cd * A * v²');
console.log('  - Rolling: F = Crr * m * g');
console.log('  - Tire temp: dynamic model with slip/force heating & ambient cooling');
console.log('  - Contact patch: load-dependent area → grip multiplier');
console.log('  - dt = 0.001s (1ms) for numerical accuracy');
console.log('================================================================');
