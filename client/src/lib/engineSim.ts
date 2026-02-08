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
  boostByGearEnabled: boolean;
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
  tireWidthMm: number;
  tireAspectRatio: number;
  tireWheelDiameterIn: number;
  tireCompound: 'street' | 'sport' | 'semi_slick' | 'full_slick' | 'drag_slick';
  tireGripPct: number;
  tireTempSensitivity: number;
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

  vtecIntakeLiftMm: number;
  vtecExhaustLiftMm: number;
  vtecIntakeDuration: number;
  vtecExhaustDuration: number;
  lowCamIntakeLiftMm: number;
  lowCamExhaustLiftMm: number;
  lowCamIntakeDuration: number;
  lowCamExhaustDuration: number;

  superchargerEnabled: boolean;
  superchargerType: 'centrifugal' | 'roots' | 'twinscrew';
  superchargerMaxBoostPsi: number;
  superchargerEfficiency: number;

  nitrousEnabled: boolean;
  nitrousHpAdder: number;
  nitrousActivationRpm: number;
  nitrousFullThrottleOnly: boolean;
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

    turboEnabled: true,
    wastegateBaseDuty: 50,
    boostTargetPsi: 30,
    boostCutPsi: 35,
    antiLagEnabled: false,
    antiLagRetard: 20,
    boostByGearEnabled: false,
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

    // 1999-2000 Civic Si (EM1) curb weight: 2489 lbs
    vehicleMassLb: 2489,
    // 1999-2000 Civic Si: 195/55R15 tires on 15x6 alloy wheels
    // Stock wheel: ~13 lbs, Stock tire (195/55R15): ~17 lbs = ~30 lbs per corner
    tireDiameterIn: (195 * 0.55 * 2 / 25.4) + 15,  // 23.44 inches
    tireMassLb: 28,
    dragCoefficient: 0.31,
    frontalAreaM2: 1.85,
    rollingResistanceCoeff: 0.009,
    drivetrainLossPct: 10,

    tireGripCoeff: 0.95,
    tireWidthMm: 195,
    tireAspectRatio: 55,
    tireWheelDiameterIn: 15,
    tireCompound: 'street',
    tireGripPct: 100,
    tireTempSensitivity: 1.0,
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

    vtecIntakeLiftMm: 10.6,
    vtecExhaustLiftMm: 9.4,
    vtecIntakeDuration: 240,
    vtecExhaustDuration: 228,
    lowCamIntakeLiftMm: 7.6,
    lowCamExhaustLiftMm: 7.0,
    lowCamIntakeDuration: 210,
    lowCamExhaustDuration: 200,

    superchargerEnabled: false,
    superchargerType: 'centrifugal',
    superchargerMaxBoostPsi: 6,
    superchargerEfficiency: 70,

    nitrousEnabled: false,
    nitrousHpAdder: 50,
    nitrousActivationRpm: 3000,
    nitrousFullThrottleOnly: true,
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
  quarterMileLaunched: boolean;  // True after clutch dump
  clutchIn: boolean;             // True = clutch pedal pressed (disengaged)

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
  contactPatchArea: number;
  tireTempOptimal: boolean;

  sixtyFootTime: number | null;
  threeThirtyTime: number | null;
  eighthMileTime: number | null;
  thousandFootTime: number | null;
  trapSpeed: number | null;
  peakAccelG: number;
  peakWheelHp: number;
  peakRpm: number;
  peakBoostPsi: number;
  peakSpeedMph: number;
  peakSlipPercent: number;

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
  nitrousActive: boolean;
  superchargerEnabled: boolean;
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
  // Legacy function - kept for compatibility but now uses Pacejka internally
  const absSlip = Math.abs(slipRatio);
  // Simple fallback that approximates Pacejka behavior
  if (absSlip <= 0.01) {
    return gripCoeff * (absSlip / 0.01) * 0.8; // Linear buildup at very low slip
  }
  if (absSlip <= optimalSlip) {
    return gripCoeff * (0.8 + 0.2 * (absSlip / optimalSlip)); // Approaching peak
  }
  // Past optimal - Pacejka-style falloff
  const overSlip = (absSlip - optimalSlip) / 0.5;
  const falloff = 1 - overSlip * 0.25;
  return gripCoeff * Math.max(0.7, falloff);
}

// ============================================
// PACEJKA MAGIC FORMULA TIRE MODEL
// ============================================
// Industry-standard tire model used in professional racing simulations
// F = D * sin(C * arctan(B*x - E*(B*x - arctan(B*x))))

interface PacejkaCoefficients {
  B: number;  // Stiffness factor - how quickly grip builds with slip
  C: number;  // Shape factor - controls curve shape (1.0-2.0 typical)
  D: number;  // Peak value factor - multiplied by load for max force
  E: number;  // Curvature factor - how curve falls off after peak (-1 to 1)
  // Load sensitivity - grip decreases slightly with more load (real tire behavior)
  loadSensitivity: number;
}

// Pacejka coefficients for each tire compound
// D coefficient represents peak friction coefficient (mu):
//   Budget street: 0.75-0.85 (cheap all-seasons on economy cars)
//   Premium street: 0.85-0.95
//   Performance: 0.95-1.05
//   Semi-slick: 1.05-1.20
//   Slicks: 1.20-1.50+
// A stock Civic EK with OEM tires will have some wheelspin at launch
const PACEJKA_COEFFICIENTS: Record<string, PacejkaCoefficients> = {
  // Street tires: OEM all-season - typical factory-equipped tires
  // D=0.88 is realistic for OEM all-season tires on dry pavement
  street: { B: 11.5, C: 1.45, D: 0.88, E: 0.15, loadSensitivity: 0.08 },
  // Sport tires: Summer performance tires (Pilot Sport, etc.)
  sport: { B: 11.0, C: 1.5, D: 0.95, E: 0.1, loadSensitivity: 0.07 },
  // Semi-slicks: R-compound track tires (RE-71R, RT660, etc.)
  semi_slick: { B: 10.0, C: 1.6, D: 1.15, E: -0.1, loadSensitivity: 0.05 },
  // Full slicks: Proper racing slicks
  full_slick: { B: 8.5, C: 1.7, D: 1.30, E: -0.2, loadSensitivity: 0.04 },
  // Drag slicks: Extremely soft, designed for straight-line traction
  drag_slick: { B: 6.0, C: 1.9, D: 1.50, E: -0.4, loadSensitivity: 0.03 },
};

/**
 * Pacejka Magic Formula - calculates tire force based on slip
 * @param slip - Slip ratio (0.0 to 1.0+, where 0.10 = 10% slip)
 * @param normalLoad - Normal force on tire in Newtons
 * @param compound - Tire compound name
 * @param tempFactor - Temperature efficiency factor (0.0 to 1.0)
 * @returns Force in Newtons
 */
function pacejkaTireForce(
  slip: number,
  normalLoad: number,
  compound: string,
  tempFactor: number = 1.0
): number {
  const coef = PACEJKA_COEFFICIENTS[compound] || PACEJKA_COEFFICIENTS.street;
  
  // Convert slip ratio to percentage for formula (0.10 -> 10)
  const x = Math.abs(slip) * 100;
  
  // Load sensitivity: heavier loads = slightly lower friction coefficient
  // This is real tire behavior - "load sensitivity"
  const loadFactor = 1 - coef.loadSensitivity * Math.log10(Math.max(normalLoad / 4000, 1));
  
  // Peak force (D) adjusted for load and temperature
  const D = normalLoad * coef.D * loadFactor * tempFactor;
  
  // The Magic Formula
  const B = coef.B;
  const C = coef.C;
  const E = coef.E;
  
  // F = D * sin(C * arctan(B*x - E*(B*x - arctan(B*x))))
  const Bx = B * x;
  const force = D * Math.sin(C * Math.atan(Bx - E * (Bx - Math.atan(Bx))));
  
  return Math.max(0, force);
}

/**
 * Get the slip ratio that produces peak grip for a given compound
 * Useful for traction control targeting
 */
function getPeakSlipRatio(compound: string): number {
  const coef = PACEJKA_COEFFICIENTS[compound] || PACEJKA_COEFFICIENTS.street;
  // Approximate peak slip: softer B = higher optimal slip
  // Street (~8-10%), Sport (~9-11%), Semi-slick (~10-12%), Slick (~12-15%), Drag (~15-20%)
  return 0.10 + (12 - coef.B) * 0.015;
}

/**
 * Calculate current grip efficiency based on slip vs optimal
 * Returns 0.0 to 1.0 where 1.0 = at peak grip
 */
function getGripEfficiency(slip: number, compound: string, normalLoad: number, tempFactor: number): number {
  const peakSlip = getPeakSlipRatio(compound);
  const peakForce = pacejkaTireForce(peakSlip, normalLoad, compound, tempFactor);
  const currentForce = pacejkaTireForce(slip, normalLoad, compound, tempFactor);
  return peakForce > 0 ? currentForce / peakForce : 0;
}

// Calculate if tires should break loose based on Pacejka tire model
// Returns slip ratio and available traction force
function shouldTiresBreakLoose(
  wheelForceN: number,
  tractionLimitN: number,
  gripCoeff: number,
  horsePower: number,
  compound: string = 'street',
  normalLoad: number = 4000,
  tempFactor: number = 1.0
): { breakingLoose: boolean; slipSeverity: number; slipRatio: number; availableForce: number } {
  // Get peak slip and force for this compound
  const peakSlip = getPeakSlipRatio(compound);
  const peakForce = pacejkaTireForce(peakSlip, normalLoad, compound, tempFactor);
  
  // If wheel force exceeds what tire can provide at peak, we're spinning
  if (wheelForceN <= peakForce) {
    // Tire can handle the force - find the slip ratio that matches
    // Binary search for slip ratio that produces this force
    let lowSlip = 0;
    let highSlip = peakSlip;
    let currentSlip = peakSlip / 2;
    
    for (let i = 0; i < 10; i++) {
      const forceAtSlip = pacejkaTireForce(currentSlip, normalLoad, compound, tempFactor);
      if (forceAtSlip < wheelForceN) {
        lowSlip = currentSlip;
      } else {
        highSlip = currentSlip;
      }
      currentSlip = (lowSlip + highSlip) / 2;
    }
    
    return {
      breakingLoose: false,
      slipSeverity: 0,
      slipRatio: currentSlip,
      availableForce: pacejkaTireForce(currentSlip, normalLoad, compound, tempFactor)
    };
  }
  
  // Tire is overwhelmed - find how much slip we have
  // Force exceeds peak, so we're past optimal slip on the declining part of the curve
  const excessForce = wheelForceN - peakForce;
  const forceRatio = wheelForceN / peakForce;
  
  // Power factor affects how quickly slip develops
  const powerFactor = Math.min(horsePower / 200, 2.5);
  
  // Calculate slip ratio based on excess force
  // More excess = higher slip, modified by power and grip
  const baseSlipIncrease = (forceRatio - 1) * 0.3;
  const slipRatio = peakSlip + baseSlipIncrease * powerFactor;
  
  // Slip severity for effects (tire squeal, smoke, etc)
  const slipSeverity = (slipRatio - peakSlip) / peakSlip;
  
  // Get actual available force at this slip ratio (will be less than peak)
  const availableForce = pacejkaTireForce(slipRatio, normalLoad, compound, tempFactor);
  
  return {
    breakingLoose: true,
    slipSeverity: clamp(slipSeverity, 0, 3),
    slipRatio: clamp(slipRatio, 0, 1.0),
    availableForce
  };
}

interface TireCompoundData {
  baseGrip: number;
  optimalTempLow: number;
  optimalTempHigh: number;
  coldGripFactor: number;
  hotGripFactor: number;
  heatRate: number;
  coolRate: number;
  // Pacejka model uses separate coefficients in PACEJKA_COEFFICIENTS
}

const TIRE_COMPOUNDS: Record<string, TireCompoundData> = {
  // Street: OEM all-season tires - matches D=0.88
  street: { baseGrip: 0.88, optimalTempLow: 70, optimalTempHigh: 190, coldGripFactor: 0.97, hotGripFactor: 0.75, heatRate: 1.0, coolRate: 1.0 },
  // Sport: Summer performance tires - matches D=0.95
  sport: { baseGrip: 0.95, optimalTempLow: 100, optimalTempHigh: 200, coldGripFactor: 0.90, hotGripFactor: 0.65, heatRate: 1.4, coolRate: 0.9 },
  // Semi-slick: R-compound track tires - matches D=1.15
  semi_slick: { baseGrip: 1.15, optimalTempLow: 160, optimalTempHigh: 250, coldGripFactor: 0.75, hotGripFactor: 0.60, heatRate: 1.5, coolRate: 0.8 },
  // Full slick: Racing slicks - matches D=1.30
  full_slick: { baseGrip: 1.30, optimalTempLow: 200, optimalTempHigh: 280, coldGripFactor: 0.50, hotGripFactor: 0.55, heatRate: 2.0, coolRate: 0.7 },
  // Drag slick: Extreme traction - matches D=1.50
  drag_slick: { baseGrip: 1.50, optimalTempLow: 220, optimalTempHigh: 320, coldGripFactor: 0.35, hotGripFactor: 0.50, heatRate: 2.5, coolRate: 0.6 },
};

function getTireGripAtTemp(compound: TireCompoundData, temp: number, gripPct: number, sensitivity: number): number {
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

function getContactPatchArea(widthMm: number, aspectRatio: number, loadN: number): number {
  const sectionWidthIn = widthMm / 25.4;
  const sideWallHeight = widthMm * (aspectRatio / 100);
  const deflectionFactor = clamp(loadN / 8000, 0.5, 1.5);
  const patchLengthIn = 3.0 + deflectionFactor * 2.5;
  return sectionWidthIn * patchLengthIn * deflectionFactor * 0.7;
}

const B16A2_TORQUE_MAP: [number, number][] = [
  [750, 40], [1000, 50], [1500, 58], [2000, 67], [2500, 75],
  [3000, 82], [3500, 88], [4000, 93], [4500, 96], [5000, 99],
  [5500, 103], [6000, 107], [6500, 109], [7000, 111], [7500, 109],
  [7600, 108], [8000, 100], [8200, 95],
];

// Stock B16A2 compression ratio for baseline
const STOCK_COMPRESSION_RATIO = 10.2;

function getB16Torque(rpm: number, throttlePos: number, compressionRatio: number = STOCK_COMPRESSION_RATIO): number {
  const clamped = clamp(rpm, B16A2_TORQUE_MAP[0][0], B16A2_TORQUE_MAP[B16A2_TORQUE_MAP.length - 1][0]);
  let i = 0;
  while (i < B16A2_TORQUE_MAP.length - 1 && B16A2_TORQUE_MAP[i + 1][0] <= clamped) i++;
  if (i >= B16A2_TORQUE_MAP.length - 1) {
    const baseTorque = B16A2_TORQUE_MAP[B16A2_TORQUE_MAP.length - 1][1] * throttlePos;
    return baseTorque * getCompressionMultiplier(compressionRatio);
  }
  const [r0, t0] = B16A2_TORQUE_MAP[i];
  const [r1, t1] = B16A2_TORQUE_MAP[i + 1];
  const frac = (clamped - r0) / (r1 - r0);
  const wotTorque = t0 + (t1 - t0) * frac;
  const baseTorque = wotTorque * (0.1 + 0.9 * throttlePos);
  
  // Apply compression ratio effect
  return baseTorque * getCompressionMultiplier(compressionRatio);
}

/**
 * Calculate torque/power multiplier based on compression ratio
 * Higher compression = more efficient combustion = more power
 * 
 * Real-world: Race engines typically max around 14-15:1
 * But this sim allows extreme values for experimentation
 * 
 * Results:
 *   8:1 = ~0.90x (low compression economy build)
 *  10:1 = ~1.00x (stock baseline) 
 *  12:1 = ~1.08x (mild build)
 *  14:1 = ~1.14x (high comp NA)
 *  16:1 = ~1.22x (race engine)
 *  20:1 = ~1.35x (extreme)
 *  25:1 = ~1.47x (crazy high)
 */
function getCompressionMultiplier(compressionRatio: number): number {
  const cr = Math.max(compressionRatio, 6.0);
  
  // Calculate thermal efficiency improvement using Otto cycle
  // Efficiency = 1 - (1 / CR^(gamma-1)), gamma ≈ 1.3 for gasoline
  const gamma = 1.3;
  const stockEfficiency = 1 - Math.pow(1 / STOCK_COMPRESSION_RATIO, gamma - 1);
  const newEfficiency = 1 - Math.pow(1 / cr, gamma - 1);
  
  // Base multiplier from efficiency change (this always increases with CR)
  let multiplier = newEfficiency / stockEfficiency;
  
  // Above 14:1, add diminishing returns but still allow gains
  // Power keeps rising, just more slowly
  if (cr > 14) {
    const excess = cr - 14;
    // Calculate what multiplier would be at 14:1
    const baseAt14 = (1 - Math.pow(1 / 14, gamma - 1)) / stockEfficiency;
    // Additional gains above 14:1 use logarithmic scaling
    const additionalGain = Math.log(1 + excess * 0.15) * 0.25;
    multiplier = baseAt14 + additionalGain;
  }
  
  // Penalty for very low compression (poor combustion, incomplete burn)
  if (cr < 8.0) {
    const deficit = 8.0 - cr;
    multiplier *= 1 - (deficit * 0.05);
  }
  
  return Math.max(multiplier, 0.60);
}

function getCamTorqueMultiplier(rpm: number, vtecActive: boolean, config: EcuConfig): number {
  const STOCK_LOW_INTAKE_LIFT = 7.6;
  const STOCK_LOW_EXHAUST_LIFT = 7.0;
  const STOCK_LOW_INTAKE_DURATION = 210;
  const STOCK_LOW_EXHAUST_DURATION = 200;
  const STOCK_VTEC_INTAKE_LIFT = 10.6;
  const STOCK_VTEC_EXHAUST_LIFT = 9.4;
  const STOCK_VTEC_INTAKE_DURATION = 240;
  const STOCK_VTEC_EXHAUST_DURATION = 228;

  if (!vtecActive) {
    const intakeLiftRatio = clamp(config.lowCamIntakeLiftMm / STOCK_LOW_INTAKE_LIFT, 0.7, 1.4);
    const exhaustLiftRatio = clamp(config.lowCamExhaustLiftMm / STOCK_LOW_EXHAUST_LIFT, 0.7, 1.4);
    const avgLiftRatio = (intakeLiftRatio + exhaustLiftRatio) / 2;
    const intakeDurationRatio = clamp(config.lowCamIntakeDuration / STOCK_LOW_INTAKE_DURATION, 0.8, 1.3);
    const exhaustDurationRatio = clamp(config.lowCamExhaustDuration / STOCK_LOW_EXHAUST_DURATION, 0.8, 1.3);
    const avgDurationRatio = (intakeDurationRatio + exhaustDurationRatio) / 2;
    let multiplier = avgLiftRatio * 0.6 + avgDurationRatio * 0.4;
    if (config.lowCamIntakeDuration > 220 && rpm < 3000) {
      const penalty = (config.lowCamIntakeDuration - 220) / 200 * (1 - rpm / 3000);
      multiplier *= (1 - penalty);
    }
    return multiplier;
  } else {
    const intakeLiftRatio = clamp(config.vtecIntakeLiftMm / STOCK_VTEC_INTAKE_LIFT, 0.7, 1.4);
    const exhaustLiftRatio = clamp(config.vtecExhaustLiftMm / STOCK_VTEC_EXHAUST_LIFT, 0.7, 1.4);
    const avgLiftRatio = (intakeLiftRatio + exhaustLiftRatio) / 2;
    const intakeDurationRatio = clamp(config.vtecIntakeDuration / STOCK_VTEC_INTAKE_DURATION, 0.8, 1.3);
    const exhaustDurationRatio = clamp(config.vtecExhaustDuration / STOCK_VTEC_EXHAUST_DURATION, 0.8, 1.3);
    const avgDurationRatio = (intakeDurationRatio + exhaustDurationRatio) / 2;
    let multiplier = avgLiftRatio * 0.6 + avgDurationRatio * 0.4;
    if (config.vtecIntakeDuration > 250 && rpm > 5000) {
      const bonus = (config.vtecIntakeDuration - 250) / 200 * ((rpm - 5000) / 3000);
      multiplier *= (1 + bonus);
    }
    return multiplier;
  }
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
  contactPatchArea: number;
}

function computeDerived(config: EcuConfig): DerivedConstants {
  const tireCircumferenceFt = (config.tireDiameterIn * Math.PI) / 12;
  const tireRadiusM = config.tireDiameterIn * 0.0254 / 2;
  const tireMassKg = config.tireMassLb * 0.4536;
  // Wheel+tire rotational inertia: I = k * m * r² where k ≈ 0.75 for wheel+tire combo
  // (tire mass concentrated near outer radius, wheel mass more central)
  // Only count driven wheels for FWD (2 wheels)
  const tireInertia = 0.75 * tireMassKg * tireRadiusM * tireRadiusM;
  const totalTireInertia = 2 * tireInertia;  // FWD - only 2 driven wheels
  const vehicleMassKg = config.vehicleMassLb * 0.4536;
  const effectiveMassKg = vehicleMassKg + totalTireInertia / (tireRadiusM * tireRadiusM);
  const shiftTimeS = config.shiftTimeMs / 1000;
  const drivetrainLoss = config.drivetrainLossPct / 100;

  const contactPatchArea = getContactPatchArea(config.tireWidthMm, config.tireAspectRatio, vehicleMassKg * 9.81 * config.frontWeightBias);

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
    contactPatchArea,
  };
}

export function createEngineSimulation(ecuConfig?: EcuConfig) {
  let config: EcuConfig = ecuConfig ? { ...ecuConfig } : getDefaultEcuConfig();
  let derived = computeDerived(config);
  let aiCorrections = { gripMultiplier: 1.0, weightTransferMultiplier: 1.0, slipMultiplier: 1.0, dragMultiplier: 1.0, tractionMultiplier: 1.0 };

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
  let qmLaunched = false;  // True after clutch is dumped
  let clutchIn = true;     // True = clutch pedal pressed (disengaged from wheels)
  let prevSpeedMps = 0;
  let currentGear = 0;
  let shiftTimer = 0;
  let wheelSpeedMps = 0;

  let tireTemp = 100;  // Start tires warmer (ambient + some heat from driving to staging)
  let sixtyFootTime: number | null = null;
  let threeThirtyTime: number | null = null;
  let eighthMileTime: number | null = null;
  let thousandFootTime: number | null = null;
  let trapSpeed: number | null = null;
  let peakAccelG = 0;
  let peakWheelHp = 0;
  let peakRpm = 0;
  let peakBoostPsi = 0;
  let peakSpeedMph = 0;
  let peakSlipPercent = 0;
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
    qmLaunched = false;  // Not launched yet - staging
    clutchIn = true;     // Clutch pedal pressed while staging
    prevSpeedMps = 0;
    currentGear = 0;
    shiftTimer = 0;
    wheelSpeedMps = 0;

    tireTemp = 100;  // Tires warmed up from staging/burnout
    sixtyFootTime = null;
    threeThirtyTime = null;
    eighthMileTime = null;
    thousandFootTime = null;
    trapSpeed = null;
    peakAccelG = 0;
    peakWheelHp = 0;
    peakRpm = 0;
    peakBoostPsi = 0;
    peakSpeedMph = 0;
    peakSlipPercent = 0;
    knockCount = 0;
  }

  // Dump the clutch to launch!
  function launchCar() {
    if (qmActive && !qmLaunched) {
      qmLaunched = true;
      clutchIn = false;  // Release clutch pedal - engage transmission
    }
  }

  function resetQuarterMile() {
    speedMps = 0;
    distanceFt = 0;
    qmElapsedTime = 0;
    qmET = null;
    qmActive = false;
    qmLaunched = false;
    clutchIn = true;
    prevSpeedMps = 0;
    throttle = 0;
    prevThrottle = 0;
    targetRpm = config.targetIdleRpm;
    currentGear = 0;
    shiftTimer = 0;
    wheelSpeedMps = 0;

    tireTemp = 100;  // Reset to warmed staging temp
    sixtyFootTime = null;
    threeThirtyTime = null;
    eighthMileTime = null;
    thousandFootTime = null;
    trapSpeed = null;
    peakAccelG = 0;
    peakWheelHp = 0;
    peakRpm = 0;
    peakBoostPsi = 0;
    peakSpeedMph = 0;
    peakSlipPercent = 0;
    knockCount = 0;
  }

  function setEcuConfig(newConfig: EcuConfig) {
    config = { ...newConfig };
    config.tireDiameterIn = (config.tireWidthMm * (config.tireAspectRatio / 100) * 2 / 25.4) + config.tireWheelDiameterIn;
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

    const compound = TIRE_COMPOUNDS[config.tireCompound] || TIRE_COMPOUNDS.street;

    let wheelForceN = 0;
    let dragForceN = 0;
    let rollingForceN = 0;
    let netForceN = 0;
    let weightTransferN = 0;
    let frontAxleLoadN = derived.vehicleMassKg * GRAVITY * config.frontWeightBias;
    let effectiveGrip = getTireGripAtTemp(compound, tireTemp, config.tireGripPct, config.tireTempSensitivity);
    let patchArea = getContactPatchArea(config.tireWidthMm, config.tireAspectRatio, frontAxleLoadN);
    let patchMultiplier = clamp(patchArea / 30, 0.7, 1.4);
    let finalGrip = effectiveGrip * patchMultiplier;
    let maxTractionForceN = frontAxleLoadN * finalGrip;
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

    let scParasiticLoss = 0;
    let nitrousActiveNow = false;

    if (config.turboEnabled) {
      const rpmFactor = clamp((currentRpm - 2000) / 4000, 0, 1);
      const throttleFactor = throttle;
      // Only use per-gear boost targets if boostByGearEnabled is checked
      const gearTarget = config.boostByGearEnabled 
        ? (config.boostByGear[clamp(currentGear, 0, config.boostByGear.length - 1)] || config.boostTargetPsi)
        : config.boostTargetPsi;
      const targetBoost = gearTarget * rpmFactor * throttleFactor;
      boostPsi = lerp(boostPsi, targetBoost, dt * 3);

      if (boostPsi >= config.boostCutPsi) {
        fuelCutActive = true;
        fuelCutFraction = 1.0;
        boostPsi = lerp(boostPsi, 0, dt * 10);
      }
      boostPsi = clamp(boostPsi, 0, config.boostCutPsi + 2);
    } else if (config.superchargerEnabled) {
      const eff = config.superchargerEfficiency / 100;
      let scBoost: number;
      if (config.superchargerType === 'centrifugal') {
        scBoost = config.superchargerMaxBoostPsi * Math.pow(currentRpm / redline, 2) * throttle * eff;
      } else {
        scBoost = config.superchargerMaxBoostPsi * throttle * (0.7 + 0.3 * currentRpm / redline) * eff;
      }
      boostPsi = clamp(scBoost, 0, config.superchargerMaxBoostPsi);
      scParasiticLoss = boostPsi * 0.5;
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

      // STAGING PHASE: Clutch is in, engine revs freely
      if (clutchIn) {
        // Engine revs based on throttle, not connected to wheels
        const targetRevRpm = idleRpm + throttle * (config.launchControlEnabled ? config.launchControlRpm - idleRpm : redline - idleRpm);
        
        // Launch control limits RPM when staging
        if (config.launchControlEnabled && currentRpm > config.launchControlRpm) {
          launchControlActive = true;
          timingRetardTotal += config.launchRetardDeg;
          fuelCutFraction = Math.max(fuelCutFraction, config.launchFuelCutPct / 100);
        }
        
        // Smoothly approach target RPM (engine not loaded)
        const rpmDelta = targetRevRpm - currentRpm;
        currentRpm = clamp(currentRpm + rpmDelta * dt * 8, idleRpm, fuelCutRpm);
        
        clutchStatus = "DISENGAGED";
        wheelForceN = 0;  // No power to wheels while clutch is in
        wheelTorqueFtLb = 0;
        
      } else {
        // LAUNCHED: Clutch is out, power goes to wheels
        
        // Only count time after clutch is released
        qmElapsedTime += dt;
        
        // Calculate what engine is trying to push to wheels (INCLUDING forced induction)
        let launchTorqueFtLb = getB16Torque(currentRpm, throttle, config.compressionRatio);
        const camMult = getCamTorqueMultiplier(currentRpm, vtecActive, config);
        launchTorqueFtLb *= camMult;
        
        // Include turbo/supercharger boost in launch torque calculation!
        if (config.turboEnabled && boostPsi > 0) {
          const boostMult = 1 + (boostPsi / 14.7) * 0.9;
          launchTorqueFtLb *= boostMult;
        } else if (config.superchargerEnabled && boostPsi > 0) {
          const scMult = 1 + (boostPsi / 14.7) * 0.9;
          launchTorqueFtLb *= scMult;
        }
        
        const launchForceN = (launchTorqueFtLb * 1.3558 * totalRatio * (1 - derived.drivetrainLoss)) / wheelRadius;
        
        // Check traction limit - use static load (weight transfer comes later)
        const staticFrontLoad = derived.vehicleMassKg * GRAVITY * config.frontWeightBias;
        const gripCoeff = compound.baseGrip * (config.tireGripPct / 100);
        const maxTraction = staticFrontLoad * gripCoeff;
        
        // Force ratio determines wheelspin potential
        const forceRatio = launchForceN / maxTraction;
        
        // Wheelspin occurs when force significantly exceeds traction
        // Higher power = more wheelspin but tires still accelerate the car
        const isWheelspinning = forceRatio > 0.95 && throttle > 0.7 && speedMps < 20;
        
        if (isWheelspinning) {
          // WHEELSPIN MODE - tires spin but car still accelerates
          const excessRatio = Math.max(0, forceRatio - 0.95);
          slipRatio = Math.min(0.5, excessRatio * 0.25 + 0.05);
          
          // At very low speed, slightly more slip
          if (speedMps < 5) {
            slipRatio = Math.min(0.6, slipRatio + 0.08);
          }
          
          // Wheel spins faster than ground speed
          wheelSpeedMps = speedMps * (1 + slipRatio);
          
          // Engine RPM calculation: 
          // - At standstill with wheelspin, engine stays at launch RPM (throttle-dependent)
          // - As speed builds, gradually sync to wheel speed
          const wheelRpm = (wheelSpeedMps / wheelRadius) * (60 / (2 * Math.PI));
          const engineRpmFromWheel = wheelRpm * totalRatio;
          
          // During heavy wheelspin at low speed, engine stays at throttle-demanded RPM
          const throttleRpm = idleRpm + throttle * (config.launchControlEnabled ? config.launchControlRpm - idleRpm : redline * 0.85 - idleRpm);
          
          // Blend: at standstill favor throttle RPM, as speed builds transition to wheel-driven
          const speedBlend = clamp(speedMps / 15, 0, 1);
          const targetRpm = lerp(throttleRpm, engineRpmFromWheel, speedBlend);
          
          // Smooth RPM changes
          const rpmDelta = targetRpm - currentRpm;
          currentRpm = clamp(currentRpm + rpmDelta * dt * 10, idleRpm, fuelCutRpm);
          
          clutchStatus = "SPINNING";
          
        } else {
          // NORMAL TRACTION - wheels grip, engine RPM tied to wheel speed
          slipRatio = 0;
          wheelSpeedMps = speedMps;
          
          const vehicleDrivenRpm = (speedMps / wheelRadius) * (60 / (2 * Math.PI)) * totalRatio;
          
          // At very low speed during clutch engagement
          if (speedMps < 3 && vehicleDrivenRpm < idleRpm * 1.5) {
            // Engine lugs slightly but doesn't stall
            const targetRpm = Math.max(idleRpm * 0.9, vehicleDrivenRpm);
            currentRpm = clamp(lerp(currentRpm, targetRpm, dt * 3), idleRpm * 0.7, fuelCutRpm);
            clutchStatus = "ENGAGING";
          } else {
            currentRpm = clamp(Math.max(vehicleDrivenRpm, idleRpm), idleRpm, fuelCutRpm);
            clutchStatus = "ENGAGED";
          }
        }

        if (shiftTimer > 0) {
          clutchStatus = "SHIFTING";
        }

        const gearRedline = config.gearRevLimits[clamp(currentGear, 0, config.gearRevLimits.length - 1)] || redline;
        if (currentRpm >= gearRedline && currentGear < config.gearRatios.length - 1) {
          currentGear++;
          shiftTimer = derived.shiftTimeS;
        }

        if (shiftTimer <= 0) {
          let torqueFtLb = getB16Torque(currentRpm, throttle, config.compressionRatio);
          const camMultiplier = getCamTorqueMultiplier(currentRpm, vtecActive, config);
          torqueFtLb *= camMultiplier;

          if (config.turboEnabled && boostPsi > 0) {
            const boostMultiplier = 1 + (boostPsi / 14.7) * 0.9;
            torqueFtLb *= boostMultiplier;
          } else if (config.superchargerEnabled && boostPsi > 0) {
            const scMultiplier = 1 + (boostPsi / 14.7) * 0.9;
            torqueFtLb *= scMultiplier;
            torqueFtLb -= scParasiticLoss;
          }

          if (config.nitrousEnabled) {
            const nosActive = currentRpm >= config.nitrousActivationRpm && (throttle >= 0.95 || !config.nitrousFullThrottleOnly);
            if (nosActive && currentRpm > 0) {
              nitrousActiveNow = true;
              const nitrousAdder = config.nitrousHpAdder * 5252 / currentRpm;
              torqueFtLb += nitrousAdder;
            }
          }

          const timingFactor = Math.max(0.3, 1 - timingRetardTotal / 60);
          torqueFtLb *= timingFactor;

          const fuelFactor = 1 - fuelCutFraction;
          torqueFtLb *= fuelFactor;

          const engineTorqueNm = torqueFtLb * 1.3558;
          let rawWheelForceN = (engineTorqueNm * totalRatio * (1 - derived.drivetrainLoss)) / wheelRadius;
          wheelTorqueFtLb = torqueFtLb * totalRatio * (1 - derived.drivetrainLoss);
          
          // REALISTIC traction limiting - mainly affects low speed launches
          // At higher speeds, tires can handle more power (warmed up, less torque multiplication)
          const tractionForce = staticFrontLoad * gripCoeff;
          
          // Speed factor: traction limiting fades out as speed increases
          // At 0 mph: full traction limiting (launch)
          // At 30 mph: 50% traction limiting effect
          // At 60+ mph: minimal traction limiting (tires can handle it)
          const speedMph = speedMps * 2.237;
          const tractionLimitFactor = Math.max(0.1, 1 - speedMph / 80);
          
          if (rawWheelForceN > tractionForce) {
            const excessRatio = rawWheelForceN / tractionForce;
            
            // Efficiency loss from wheelspin (only at low speed)
            const efficiencyFactor = 1 / (1 + Math.log(excessRatio) * 0.5 * tractionLimitFactor);
            
            // Blend between raw force and traction-limited force based on speed
            const limitedForce = tractionForce * Math.min(1.2, efficiencyFactor + 0.2);
            wheelForceN = limitedForce + (rawWheelForceN - limitedForce) * (1 - tractionLimitFactor);
            
            // Slip ratio - only significant at low speed
            slipRatio = Math.min(0.7, (excessRatio - 1) * 0.25 * tractionLimitFactor);
          } else {
            wheelForceN = rawWheelForceN;
          }
        }
      }

      const prevAccelMps2 = dt > 0 && speedMps > 0.05 ? (speedMps - prevSpeedMps) / dt : 0;
      weightTransferN = (derived.vehicleMassKg * Math.max(prevAccelMps2, 0) * config.cgHeightM) / config.wheelbaseM;
      weightTransferN *= aiCorrections.weightTransferMultiplier;
      const staticFrontLoadN = derived.vehicleMassKg * GRAVITY * config.frontWeightBias;
      // FWD: weight transfers to rear during acceleration, but front still has good load
      // Real Civic Si launches well despite FWD due to low CG and good weight distribution
      frontAxleLoadN = Math.max(staticFrontLoadN - weightTransferN * 0.25, derived.vehicleMassKg * GRAVITY * 0.55);

      effectiveGrip = getTireGripAtTemp(compound, tireTemp, config.tireGripPct, config.tireTempSensitivity);
      patchArea = getContactPatchArea(config.tireWidthMm, config.tireAspectRatio, frontAxleLoadN);
      patchMultiplier = clamp(patchArea / 30, 0.7, 1.4);
      finalGrip = effectiveGrip * patchMultiplier;
      maxTractionForceN = frontAxleLoadN * finalGrip * aiCorrections.gripMultiplier;

      // Calculate current horsepower for power-based traction loss
      const currentHorsePower = wheelTorqueFtLb > 0 ? (wheelTorqueFtLb * currentRpm) / (5252 * totalRatio) : 0;
      
      // Temperature efficiency factor for Pacejka model
      const tempEfficiency = getTireGripAtTemp(compound, tireTemp, config.tireGripPct, config.tireTempSensitivity) / compound.baseGrip;
      
      // Check if tires should break loose using Pacejka Magic Formula
      // Skip if we already determined wheelspin during launch
      const alreadySpinning = clutchStatus === "SPINNING" && slipRatio > 0.05;
      
      if (!alreadySpinning) {
        const tractionCheck = shouldTiresBreakLoose(
          wheelForceN, 
          maxTractionForceN, 
          finalGrip, 
          currentHorsePower,
          config.tireCompound,
          frontAxleLoadN,
          tempEfficiency
        );
        
        if (tractionCheck.breakingLoose) {
          // Use Pacejka-calculated slip ratio for visuals
          slipRatio = tractionCheck.slipRatio;

          if (config.tractionControlEnabled && Math.abs(slipRatio) * 100 > config.tractionSlipThreshold) {
            tractionControlActive = true;
            const modeMultiplier = config.tractionControlMode === 'mild' ? 0.5 : config.tractionControlMode === 'aggressive' ? 1.5 : 1.0;
            timingRetardTotal += config.tractionRetardDeg * modeMultiplier;
            fuelCutFraction = Math.max(fuelCutFraction, (config.tractionFuelCutPct / 100) * modeMultiplier);
            fuelCutFraction = clamp(fuelCutFraction, 0, 1);

            const tcTimingFactor = Math.max(0.3, 1 - config.tractionRetardDeg * modeMultiplier / 60);
            const tcFuelFactor = 1 - clamp((config.tractionFuelCutPct / 100) * modeMultiplier, 0, 1);
            wheelForceN *= tcTimingFactor * tcFuelFactor;

            // Recalculate slip after traction control intervention
            const updatedTractionCheck = shouldTiresBreakLoose(
              wheelForceN, 
              maxTractionForceN, 
              finalGrip, 
              currentHorsePower * tcTimingFactor * tcFuelFactor,
              config.tireCompound,
              frontAxleLoadN,
              tempEfficiency
            );
            slipRatio = updatedTractionCheck.slipRatio;
          }

          // DON'T hard-cap wheel force - just calculate wheel speed for visual
          // This lets more power = faster acceleration even with slip
          wheelSpeedMps = speedMps * (1 + slipRatio);
        }
      }

      dragForceN = 0.5 * AIR_DENSITY * config.dragCoefficient * config.frontalAreaM2 * speedMps * speedMps * aiCorrections.dragMultiplier;
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
      // Note: qmElapsedTime is already incremented in the launched section above

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

      if (currentRpm > peakRpm) peakRpm = currentRpm;
      if (boostPsi > peakBoostPsi) peakBoostPsi = boostPsi;
      const currentSpeedMphPeak = speedMps * 2.237;
      if (currentSpeedMphPeak > peakSpeedMph) peakSpeedMph = currentSpeedMphPeak;
      const currentSlipPct = Math.abs(slipRatio) * 100;
      if (currentSlipPct > peakSlipPercent) peakSlipPercent = currentSlipPct;

      const slipHeat = Math.abs(slipRatio) * dt * 200 * compound.heatRate;
      const forceHeat = (wheelForceN * N_TO_LBS / 5000) * dt * 5 * compound.heatRate;
      tireTemp += slipHeat + forceHeat;
      const ambientTemp = 80;
      tireTemp = lerp(tireTemp, ambientTemp, dt * 0.01 * compound.coolRate);
      tireTemp = clamp(tireTemp, ambientTemp, 400);

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

      gearRatio = config.gearRatios[0];
      totalRatio = gearRatio * config.finalDriveRatio;
      currentGear = 0;
      const wheelRadius = derived.tireRadiusM;

      frontAxleLoadN = derived.vehicleMassKg * GRAVITY * config.frontWeightBias;
      effectiveGrip = getTireGripAtTemp(compound, tireTemp, config.tireGripPct, config.tireTempSensitivity);
      patchArea = getContactPatchArea(config.tireWidthMm, config.tireAspectRatio, frontAxleLoadN);
      patchMultiplier = clamp(patchArea / 30, 0.7, 1.4);
      finalGrip = effectiveGrip * patchMultiplier;
      maxTractionForceN = frontAxleLoadN * finalGrip * aiCorrections.gripMultiplier;

      let freeRevTorque = getB16Torque(currentRpm, throttle, config.compressionRatio);
      const freeRevCamMult = getCamTorqueMultiplier(currentRpm, vtecActive, config);
      freeRevTorque *= freeRevCamMult;

      if (config.turboEnabled && boostPsi > 0) {
        freeRevTorque *= 1 + (boostPsi / 14.7) * 0.9;
      } else if (config.superchargerEnabled && boostPsi > 0) {
        freeRevTorque *= 1 + (boostPsi / 14.7) * 0.9;
        freeRevTorque -= scParasiticLoss;
      }
      if (config.nitrousEnabled) {
        const nosActive = currentRpm >= config.nitrousActivationRpm && (throttle >= 0.95 || !config.nitrousFullThrottleOnly);
        if (nosActive && currentRpm > 0) {
          nitrousActiveNow = true;
          freeRevTorque += config.nitrousHpAdder * 5252 / currentRpm;
        }
      }

      const freeRevTimingFactor = Math.max(0.3, 1 - timingRetardTotal / 60);
      freeRevTorque *= freeRevTimingFactor;
      const freeRevFuelFactor = 1 - fuelCutFraction;
      freeRevTorque *= freeRevFuelFactor;

      const engineTorqueNm = freeRevTorque * 1.3558;
      wheelForceN = (engineTorqueNm * totalRatio * (1 - derived.drivetrainLoss)) / wheelRadius;
      wheelTorqueFtLb = freeRevTorque * totalRatio * (1 - derived.drivetrainLoss);

      // Calculate horsepower for power-based traction loss in free-rev mode
      const freeRevHorsePower = wheelTorqueFtLb > 0 ? (wheelTorqueFtLb * currentRpm) / (5252 * totalRatio) : 0;
      
      // Temperature efficiency factor for Pacejka model
      const freeRevTempEfficiency = getTireGripAtTemp(compound, tireTemp, config.tireGripPct, config.tireTempSensitivity) / compound.baseGrip;
      
      // Check if tires should break loose using Pacejka Magic Formula
      const freeRevTractionCheck = shouldTiresBreakLoose(
        wheelForceN, 
        maxTractionForceN, 
        finalGrip, 
        freeRevHorsePower,
        config.tireCompound,
        frontAxleLoadN,
        freeRevTempEfficiency
      );
      
      if (freeRevTractionCheck.breakingLoose && throttle > 0.3) {
        slipRatio = freeRevTractionCheck.slipRatio;

        if (config.tractionControlEnabled && slipRatio * 100 > config.tractionSlipThreshold) {
          tractionControlActive = true;
          const modeMultiplier = config.tractionControlMode === 'mild' ? 0.5 : config.tractionControlMode === 'aggressive' ? 1.5 : 1.0;
          timingRetardTotal += config.tractionRetardDeg * modeMultiplier;
          fuelCutFraction = Math.max(fuelCutFraction, (config.tractionFuelCutPct / 100) * modeMultiplier);
          fuelCutFraction = clamp(fuelCutFraction, 0, 1);

          const tcTimingFactor = Math.max(0.3, 1 - config.tractionRetardDeg * modeMultiplier / 60);
          const tcFuelFactor = 1 - clamp((config.tractionFuelCutPct / 100) * modeMultiplier, 0, 1);
          wheelForceN *= tcTimingFactor * tcFuelFactor;

          const updatedFreeRevCheck = shouldTiresBreakLoose(
            wheelForceN, 
            maxTractionForceN, 
            finalGrip, 
            freeRevHorsePower * tcTimingFactor * tcFuelFactor,
            config.tireCompound,
            frontAxleLoadN,
            freeRevTempEfficiency
          );
          slipRatio = updatedFreeRevCheck.slipRatio;
        }

        const slipHeat = slipRatio * dt * 150 * compound.heatRate;
        tireTemp += slipHeat;
      } else {
        slipRatio = freeRevTractionCheck.slipRatio; // Even when not breaking loose, use Pacejka slip
      }

      tireTemp = lerp(tireTemp, 80, dt * 0.01 * compound.coolRate);
      tireTemp = clamp(tireTemp, 80, 400);
      clutchStatus = "ENGAGED";
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
    const stockIntakeLift = vtecActive ? 10.6 : 7.6;
    const stockExhaustLift = vtecActive ? 9.4 : 7.0;
    const configIntakeLift = vtecActive ? config.vtecIntakeLiftMm : config.lowCamIntakeLiftMm;
    const configExhaustLift = vtecActive ? config.vtecExhaustLiftMm : config.lowCamExhaustLiftMm;
    const intakeValveLift = getValveLift(crankAngle, true) * (configIntakeLift / stockIntakeLift);
    const exhaustValveLift = getValveLift(crankAngle, false) * (configExhaustLift / stockExhaustLift);

    let torque = getB16Torque(currentRpm, throttle, config.compressionRatio);
    const displayCamMultiplier = getCamTorqueMultiplier(currentRpm, vtecActive, config);
    torque *= displayCamMultiplier;

    if (config.turboEnabled && boostPsi > 0) {
      const boostMultiplier = 1 + (boostPsi / 14.7) * 0.9;
      torque *= boostMultiplier;
    } else if (config.superchargerEnabled && boostPsi > 0) {
      const scMultiplier = 1 + (boostPsi / 14.7) * 0.9;
      torque *= scMultiplier;
      torque -= scParasiticLoss;
    }

    if (config.nitrousEnabled) {
      const nosActive = currentRpm >= config.nitrousActivationRpm && (throttle >= 0.95 || !config.nitrousFullThrottleOnly);
      if (nosActive && currentRpm > 0) {
        nitrousActiveNow = true;
        const nitrousAdder = config.nitrousHpAdder * 5252 / currentRpm;
        torque += nitrousAdder;
      }
    }

    const hp = (torque * currentRpm) / 5252;

    let baseMAP = 30 + throttle * 71;
    if ((config.turboEnabled || config.superchargerEnabled) && boostPsi > 0) {
      baseMAP += boostPsi * 6.895;
    }
    const hasForcedInduction = config.turboEnabled || config.superchargerEnabled;
    const intakeManifoldPressure = clamp(baseMAP + Math.sin(crankAngle * Math.PI / 180) * 3, 20, hasForcedInduction ? 250 : 102);

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
    
    // Calculate tire RPM accounting for slip
    // When slipping, tire spins faster than ground speed would indicate
    let tireRpm: number;
    const groundSpeedRpm = speedMps > 0 ? (speedMps / (derived.tireCircumferenceFt * 0.3048)) * 60 : 0;
    
    // Wheel RPM as driven by engine through drivetrain
    const engineDrivenWheelRpm = totalRatio > 0 ? currentRpm / totalRatio : 0;
    
    if (qmActive && qmLaunched) {
      if (slipRatio > 0.05) {
        // WHEELSPIN! Tire is spinning faster than vehicle speed
        // Tire RPM = ground speed RPM * (1 + slip)
        // At standstill with 50% slip, tire spins at engine-driven speed
        const wheelSurfaceSpeed = wheelSpeedMps > 0 ? wheelSpeedMps : speedMps * (1 + slipRatio);
        tireRpm = (wheelSurfaceSpeed / (derived.tireCircumferenceFt * 0.3048)) * 60;
        
        // At very low speed, use engine-driven RPM directly
        if (speedMps < 2 && slipRatio > 0.1) {
          tireRpm = Math.max(tireRpm, engineDrivenWheelRpm * 0.8);
        }
      } else {
        // No slip - tire matches ground speed
        tireRpm = groundSpeedRpm;
      }
    } else if (qmActive && !qmLaunched) {
      // Staging - tire stationary, brakes holding
      tireRpm = 0;
    } else {
      // Not in QM mode - show based on driving
      tireRpm = speedMps > 0.5 ? groundSpeedRpm : 0;
    }

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

    const currentGearDisplay = currentGear + 1;
    const currentGearRatio = gearRatio;
    const driveshaftRpm = gearRatio > 0 ? currentRpm / gearRatio : 0;

    const rearAxleLoadN = derived.vehicleMassKg * GRAVITY - frontAxleLoadN;

    const tireSlipPercent = Math.abs(slipRatio) * 100;

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
      quarterMileLaunched: qmLaunched,
      clutchIn: clutchIn,

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
      contactPatchArea: Math.round(patchArea * 10) / 10,
      tireTempOptimal: tireTemp >= compound.optimalTempLow && tireTemp <= compound.optimalTempHigh,

      sixtyFootTime: sixtyFootTime !== null ? Math.round(sixtyFootTime * 1000) / 1000 : null,
      threeThirtyTime: threeThirtyTime !== null ? Math.round(threeThirtyTime * 1000) / 1000 : null,
      eighthMileTime: eighthMileTime !== null ? Math.round(eighthMileTime * 1000) / 1000 : null,
      thousandFootTime: thousandFootTime !== null ? Math.round(thousandFootTime * 1000) / 1000 : null,
      trapSpeed: trapSpeed !== null ? Math.round(trapSpeed * 10) / 10 : null,
      peakAccelG: Math.round(peakAccelG * 100) / 100,
      peakWheelHp: Math.round(peakWheelHp * 10) / 10,
      peakRpm: Math.round(peakRpm),
      peakBoostPsi: Math.round(peakBoostPsi * 10) / 10,
      peakSpeedMph: Math.round(peakSpeedMph * 10) / 10,
      peakSlipPercent: Math.round(peakSlipPercent * 10) / 10,

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
      nitrousActive: nitrousActiveNow,
      superchargerEnabled: config.superchargerEnabled,
    };
  }

  function setAiCorrections(c: { gripMultiplier: number; weightTransferMultiplier: number; slipMultiplier: number; dragMultiplier: number; tractionMultiplier: number }) { aiCorrections = c; }
  function getAiCorrections() { return aiCorrections; }
  return { update, setThrottle, startQuarterMile, launchCar, resetQuarterMile, isRunning: () => running, setEcuConfig, getEcuConfig, setAiCorrections, getAiCorrections };
}
