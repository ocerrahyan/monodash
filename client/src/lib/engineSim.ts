import { log } from '@shared/logger';

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

  // ── Custom Shift Points ──
  customShiftPointsEnabled: boolean;       // Enable per-gear shift points (overrides gearRevLimits for shifting)
  customShiftPointsMode: 'rpm' | 'speed' | 'wheel_speed';  // Shift by RPM threshold, vehicle speed, or wheel speed
  customShiftPointsRpm: number[];          // Per-gear RPM to shift at (one per gear except last)
  customShiftPointsMph: number[];          // Per-gear vehicle speed to shift at (one per gear except last)
  customShiftPointsWheelSpeedMph: number[]; // Per-gear wheel speed to shift at (one per gear except last)

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
  clutchMaxTorqueNm: number;  // Max torque the clutch can transmit before slipping (pressure plate clamping force)
  clutchEngagement: number;    // 0-100%: how aggressively the clutch engages. 100% = instant dump (no slip), 0% = very gradual feathering

  fanOnTemp: number;
  fanOffTemp: number;
  overtempWarning: number;
  overtempEnrichPct: number;

  mapSensorMaxKpa: number;
  mapSensorMinKpa: number;
  o2SensorType: 'narrowband' | 'wideband';
  coolantSensorOffset: number;

  compressionRatio: number;

  vtecTargetHp: number;       // Target VTEC-only HP — auto-generates cam specs to hit this target
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

  // ── Fuel system ──
  fuelType: 'gasoline' | 'e85' | 'methanol' | 'flex';
  ethanolContentPct: number;        // 0-100; for flex fuel blending
  gasolineOctane: 87 | 91 | 93 | 100;
  intercoolerEnabled: boolean;
  intercoolerEfficiencyPct: number;  // 50-100; charge air cooling effectiveness

  // ── Weather / environment ──
  ambientTempF: number;             // Ambient temperature in °F
  humidityPct: number;              // Relative humidity 0-100
  altitudeFt: number;               // Elevation in feet

  // ── Drivetrain layout ──
  drivetrainType: 'FWD' | 'RWD' | 'AWD';
  frontDiffType: 'open' | 'lsd' | 'locked';
  rearDiffType: 'open' | 'lsd' | 'locked';
  centerDiffType: 'open' | 'viscous' | 'torsen' | 'locked';
  awdFrontBias: number;             // 0-1; front torque split for AWD (0.6 = 60% front)

  // ══════════════════════════════════════════════════════════════════
  // ENGINE SWAP SYSTEM — Engine identity, transmissions, rear differentials
  // ══════════════════════════════════════════════════════════════════
  engineId: string;                 // Engine preset ID (e.g. 'b16a2', '2jz-gte', 'ls3')
  engineLayout: 'I4' | 'I6' | 'V6' | 'V8' | 'V10' | 'V12' | 'F4' | 'F6' | 'W16' | 'I3' | 'R2';
  bankAngleDeg: number;             // V-engine bank angle (90° for V8, 60° for V6, 180° for flat)
  transmissionModel: string;        // Transmission model (e.g. 'S4C', 'R154', 'T56', 'CD009')
  rearDiffModel: string;            // Rear differential model (e.g. 'stock', 'ford_9in', 'dana60')
  rearAxleWidthMm: number;          // Rear axle housing width in mm

  // ══════════════════════════════════════════════════════════════════
  // EXPANDED ECU PARAMETERS (Hondata / Haltech / MegaSquirt style)
  // ══════════════════════════════════════════════════════════════════

  // ── Injector Tuning ──
  injectorDeadTimeMs: number;       // Injector dead time (battery voltage dependent)
  injectorAngleDeg: number;         // Injection start angle (crank degrees)
  injectorStagingEnabled: boolean;  // Secondary injector staging
  injectorStagingRpm: number;       // RPM threshold for secondary injectors
  injectorStagingSizeCc: number;    // Secondary injector size

  // ── Fuel Pump ──
  fuelPumpPrimePct: number;         // Fuel pump prime duty cycle
  fuelPumpBoostPct: number;         // Fuel pump boost mode duty
  fuelReturnEnabled: boolean;       // Returnless or return-style fuel system

  // ── Ignition Extended ──
  dwellTimeMs: number;              // Ignition coil dwell time
  dwellVoltageComp: boolean;        // Battery voltage dwell compensation
  trailingSpark: boolean;           // Trailing spark (for rotary or twin-spark)
  sparkPlugGapMm: number;           // Spark plug gap
  ignitionCutType: 'hard' | 'soft'; // Hard vs soft rev limit cut type

  // ── EGO / Lambda Control ──
  egoTrimMax: number;               // Maximum EGO correction %
  egoTrimMin: number;               // Minimum EGO correction %
  egoUpdateRateHz: number;          // EGO correction update rate
  lambdaTarget: number;             // Lambda target (1.0 = stoich)

  // ── Data Logging ──
  dataLogRateHz: number;            // Logging sample rate
  dataLogEnabled: boolean;          // Enable data logging

  // ── Aux Outputs ──
  auxOutput1Function: 'vtec' | 'fan' | 'boost' | 'nitrous' | 'shift_light' | 'off';
  auxOutput2Function: 'vtec' | 'fan' | 'boost' | 'nitrous' | 'shift_light' | 'off';
  shiftLightRpm: number;            // Shift light activation RPM
  shiftLightFlashRpm: number;       // Shift light flash threshold

  // ── Oil System ──
  oilPressureMinPsi: number;        // Minimum oil pressure warning
  oilTempWarningF: number;          // Oil temp warning threshold
  oilPressureSensorEnabled: boolean;
  oilTempSensorEnabled: boolean;

  // ── Exhaust Gas Temperature ──
  egtWarningF: number;              // EGT warning threshold
  egtSensorEnabled: boolean;
  egtFuelEnrichDeg: number;         // EGT-based fuel enrichment threshold

  // ── Wideband O2 ──
  widebandAfrMin: number;           // Wideband gauge min
  widebandAfrMax: number;           // Wideband gauge max
  widebandCalOffset: number;        // Calibration offset

  // ══════════════════════════════════════════════════════════════════
  // EXPANDED VEHICLE PARAMETERS
  // ══════════════════════════════════════════════════════════════════

  // ── Suspension Geometry (Honda EK McPherson front, trailing arm rear) ──
  frontCamberDeg: number;           // Front camber angle (negative = top in)
  rearCamberDeg: number;            // Rear camber angle
  frontToeDeg: number;              // Front toe (negative = toe out)
  rearToeDeg: number;               // Rear toe
  frontCasterDeg: number;           // Front caster angle
  frontKPIDeg: number;              // Kingpin inclination angle

  // ── Springs ──
  frontSpringRateKgmm: number;     // Front spring rate kg/mm
  rearSpringRateKgmm: number;      // Rear spring rate kg/mm
  frontRideHeightMm: number;       // Front ride height mm
  rearRideHeightMm: number;        // Rear ride height mm

  // ── Dampers (Shocks/Struts) ──
  frontDamperBump: number;         // Front bump damping (1-10 clicks)
  frontDamperRebound: number;      // Front rebound damping (1-10 clicks)
  rearDamperBump: number;          // Rear bump damping
  rearDamperRebound: number;       // Rear rebound damping

  // ── Anti-Roll Bars (Sway Bars) ──
  frontSwayBarDiaMm: number;       // Front sway bar diameter
  rearSwayBarDiaMm: number;        // Rear sway bar diameter
  frontSwayBarEnabled: boolean;
  rearSwayBarEnabled: boolean;

  // ── Brakes (Honda EK stock: 262mm front, 239mm rear) ──
  brakeBiasFront: number;          // Front brake bias 0-1 (0.6 = 60% front)
  frontRotorDiaMm: number;         // Front rotor diameter
  rearRotorDiaMm: number;          // Rear rotor diameter
  brakePadType: 'stock' | 'sport' | 'race' | 'carbon';
  absEnabled: boolean;

  // ── Aero ──
  rearWingEnabled: boolean;
  rearWingAngleDeg: number;        // Rear wing angle of attack
  frontSplitterEnabled: boolean;
  downforceCoefficientFront: number;
  downforceCoefficientRear: number;
  bodyLiftCoefficient: number;     // Body-generated lift coefficient (positive = upward lift, reduces grip)

  // ── Weight Distribution ──
  ballastKg: number;               // Additional ballast weight
  ballastPositionPct: number;      // Ballast position front-to-rear (0=front, 1=rear)
  driverWeightKg: number;          // Driver weight

  // ── Steering ──
  steeringRatio: number;           // Steering ratio (turns lock-to-lock)
  steeringLockDeg: number;         // Maximum steering angle
  powerSteeringEnabled: boolean;

  // ══════════════════════════════════════════════════════════════════
  // FUEL MAP TABLE (16×16 RPM × Load)
  // ══════════════════════════════════════════════════════════════════
  fuelMapRpmBins: number[];        // 16 RPM breakpoints (e.g. 500..8500)
  fuelMapLoadBins: number[];       // 16 load % breakpoints (0..100)
  fuelMapTable: number[][];        // 16×16 injector PW multiplier (0.5..2.0)
  fuelMapInterpolation: 'bilinear' | 'bicubic';
  fuelMapUnits: 'ms' | 'multiplier' | 'lambda';

  // ══════════════════════════════════════════════════════════════════
  // IGNITION MAP TABLE (16×16 RPM × Load)
  // ══════════════════════════════════════════════════════════════════
  ignMapRpmBins: number[];         // 16 RPM breakpoints
  ignMapLoadBins: number[];        // 16 load % breakpoints
  ignMapTable: number[][];         // 16×16 timing advance in degrees BTDC
  ignMapInterpolation: 'bilinear' | 'bicubic';

  // ══════════════════════════════════════════════════════════════════
  // VE TABLE (Volumetric Efficiency 16×16)
  // ══════════════════════════════════════════════════════════════════
  veMapRpmBins: number[];
  veMapLoadBins: number[];
  veMapTable: number[][];          // VE % (0..120+)

  // ══════════════════════════════════════════════════════════════════
  // AFR TARGET TABLE (16×16)
  // ══════════════════════════════════════════════════════════════════
  afrTargetRpmBins: number[];
  afrTargetLoadBins: number[];
  afrTargetTable: number[][];      // Target AFR values

  // ══════════════════════════════════════════════════════════════════
  // BOOST TARGET TABLE (8 RPM bins × 6 gear entries)
  // ══════════════════════════════════════════════════════════════════
  boostMapRpmBins: number[];       // 8 RPM breakpoints
  boostMapGearBins: number[];      // Gear numbers (1..6)
  boostMapTable: number[][];       // Target boost PSI per gear × RPM

  // ══════════════════════════════════════════════════════════════════
  // CAN BUS / COMMUNICATIONS
  // ══════════════════════════════════════════════════════════════════
  canBusBaudRate: 250 | 500 | 1000;
  canBusEnabled: boolean;
  canBusTermination: boolean;
  canBusRpmId: number;             // CAN ID for RPM broadcast
  canBusTpsId: number;             // CAN ID for TPS broadcast
  canBusVssId: number;             // CAN ID for vehicle speed
  canBusAfrId: number;             // CAN ID for AFR
  canBusBoostId: number;           // CAN ID for boost
  canBusTempId: number;            // CAN ID for temperatures
  canBusCustomId1: number;
  canBusCustomId2: number;
  canBusStreamRateHz: number;      // CAN broadcast rate

  // ══════════════════════════════════════════════════════════════════
  // EMISSIONS / OBD-II
  // ══════════════════════════════════════════════════════════════════
  catalyticConverterEnabled: boolean;
  catLightOffTempF: number;
  secondaryAirInjEnabled: boolean;
  egrEnabled: boolean;
  egrDutyPct: number;
  evapPurgeEnabled: boolean;
  evapPurgeDutyCyclePct: number;
  milClearEnabled: boolean;        // Check engine light clear
  o2HeaterEnabled: boolean;
  readinessFlagsOverride: boolean;

  // ══════════════════════════════════════════════════════════════════
  // INTAKE SYSTEM
  // ══════════════════════════════════════════════════════════════════
  intakeType: 'stock' | 'short_ram' | 'cold_air' | 'velocity_stack' | 'itb';
  intakeFilterType: 'paper' | 'oiled_cotton' | 'foam' | 'mesh';
  intakePipeDiaMm: number;
  throttleBodyDiaMm: number;
  throttleBodyType: 'single' | 'dual' | 'itb';
  intakeManifoldType: 'stock' | 'ported' | 'aftermarket' | 'custom';
  intakeManifoldRunnerLenMm: number;
  intakeManifoldPlenumVolCc: number;
  intakeResonatorEnabled: boolean;
  idleAirBypassEnabled: boolean;

  // ══════════════════════════════════════════════════════════════════
  // EXHAUST SYSTEM
  // ══════════════════════════════════════════════════════════════════
  exhaustHeaderType: 'stock_manifold' | '4_1_header' | '4_2_1_header' | 'equal_length';
  exhaustHeaderPrimaryDiaMm: number;
  exhaustHeaderPrimaryLenMm: number;
  exhaustHeaderCollectorDiaMm: number;
  exhaustPipeDiaMm: number;
  exhaustMufflerType: 'stock' | 'performance' | 'straight_through' | 'delete';
  exhaustResonatorEnabled: boolean;
  exhaustCatbackType: 'single' | 'dual';
  exhaustTipDiaMm: number;
  exhaustBackpressureKpa: number;

  // ══════════════════════════════════════════════════════════════════
  // ENGINE INTERNALS
  // ══════════════════════════════════════════════════════════════════
  boreMm: number;
  strokeMm: number;
  displacementCc: number;
  numCylinders: number;
  firingOrder: number[];
  connectingRodLenMm: number;
  pistonType: 'cast' | 'hypereutectic' | 'forged';
  pistonRingGapMm: number;
  crankshaftType: 'cast' | 'forged' | 'billet';
  bearingClearanceMm: number;
  oilGrade: '0w20' | '5w30' | '5w40' | '10w30' | '10w40' | '15w50';
  headGasketThickMm: number;
  headGasketBoreDiaMm: number;
  deckHeightMm: number;
  combustionChamberCc: number;
  valvesPerCylinder: number;
  intakeValveDiaMm: number;
  exhaustValveDiaMm: number;
  valveStemDiaMm: number;
  valveSpringPressureLb: number;
  valveSpringInstalledHeightMm: number;
  rockerArmRatio: number;
  timingChainType: 'chain' | 'belt' | 'gear';
  balanceShaftEnabled: boolean;

  // ══════════════════════════════════════════════════════════════════
  // COOLING SYSTEM
  // ══════════════════════════════════════════════════════════════════
  radiatorType: 'stock' | 'aluminum_2row' | 'aluminum_3row' | 'half_size';
  radiatorCapPsi: number;
  thermostatOpenTempF: number;
  thermostatFullOpenTempF: number;
  coolantType: 'water' | 'green' | 'red_oat' | 'waterless';
  coolantMixPct: number;           // Coolant/water mix ratio (50 = 50/50)
  waterPumpType: 'mechanical' | 'electric';
  oilCoolerEnabled: boolean;
  oilCoolerRowCount: number;

  // ══════════════════════════════════════════════════════════════════
  // ELECTRICAL SYSTEM
  // ══════════════════════════════════════════════════════════════════
  batteryVoltage: number;
  alternatorOutputAmps: number;
  ignitionCoilType: 'oem_distributor' | 'cop' | 'cnp' | 'msd_external';
  sparkPlugType: 'copper' | 'platinum' | 'iridium';
  sparkPlugHeatRange: number;      // NGK style (5=hot, 9=cold)
  wiringHarnessType: 'oem' | 'mil_spec' | 'budget_race';
  groundingKitInstalled: boolean;
  relayFanUpgrade: boolean;
  mainRelayType: 'oem' | 'aftermarket';

  // ══════════════════════════════════════════════════════════════════
  // TRANSMISSION EXTENDED
  // ══════════════════════════════════════════════════════════════════
  transmissionType: 'manual' | 'auto_torqueconv' | 'sequential' | 'dct';
  clutchType: 'oem_organic' | 'stage1_organic' | 'stage2_kevlar' | 'stage3_cerametallic' | 'stage4_puck' | 'twin_disc';
  clutchSpringPressureLb: number;
  flywheelType: 'oem_dual_mass' | 'oem_single' | 'lightweight_chromoly' | 'aluminum';
  flywheelMassLb: number;
  synchronizerType: 'brass' | 'carbon' | 'dog_engagement';
  transFluidType: 'oem_mtf' | 'redline_mtl' | 'amsoil_mtf' | 'gl4_75w90';
  transFluidTempWarningF: number;
  limitedSlipPreload: number;      // LSD preload in lb-ft
  shortShifterInstalled: boolean;
  shifterCableBushingType: 'oem_rubber' | 'polyurethane' | 'spherical';

  // ══════════════════════════════════════════════════════════════════
  // TIRE PRESSURE MONITORING (TPMS)
  // ══════════════════════════════════════════════════════════════════
  tpmsEnabled: boolean;
  frontLeftPsi: number;
  frontRightPsi: number;
  rearLeftPsi: number;
  rearRightPsi: number;
  tpmsColdPsi: number;             // Cold inflation target
  tpmsHotDeltaPsi: number;         // Expected hot pressure rise
  tpmsLowWarningPsi: number;

  // ══════════════════════════════════════════════════════════════════
  // WHEEL SPECS
  // ══════════════════════════════════════════════════════════════════
  wheelWidthIn: number;            // Wheel width in inches
  wheelOffsetMm: number;           // Wheel ET offset
  wheelBoltPattern: '4x100' | '4x114' | '5x114';
  wheelCenterBoreMm: number;
  wheelMaterialType: 'steel' | 'alloy_cast' | 'alloy_forged' | 'carbon';
  wheelMassLb: number;
  spareTireType: 'full_size' | 'compact' | 'none';

  // ══════════════════════════════════════════════════════════════════
  // BRAKE EXTENDED
  // ══════════════════════════════════════════════════════════════════
  frontCaliperPistons: number;
  rearCaliperPistons: number;
  frontCaliperPistonDiaMm: number;
  rearCaliperPistonDiaMm: number;
  masterCylBoreMm: number;
  brakeBoosterType: 'vacuum' | 'hydraulic' | 'none';
  brakeLineType: 'rubber' | 'stainless_braided' | 'hard_line';
  brakeFluidType: 'dot3' | 'dot4' | 'dot5_1' | 'racing';
  parkingBrakeType: 'drum_in_hat' | 'caliper_ebrake' | 'hydraulic';
  frontRotorType: 'solid' | 'vented' | 'drilled' | 'slotted' | 'drilled_slotted';
  rearRotorType: 'solid' | 'drum' | 'vented';
  frontRotorThickMm: number;
  rearRotorThickMm: number;
  brakeDuctingEnabled: boolean;

  // ══════════════════════════════════════════════════════════════════
  // SAFETY SYSTEMS
  // ══════════════════════════════════════════════════════════════════
  rollCageType: 'none' | 'harness_bar' | '4_point' | '6_point' | '10_point';
  harnessType: 'oem_3point' | '4_point' | '5_point' | '6_point';
  fireExtinguisherType: 'none' | 'handheld' | 'plumbed';
  killSwitchEnabled: boolean;
  batteryDisconnectEnabled: boolean;
  windowNetEnabled: boolean;
  helmetRequired: boolean;
  fuelCellType: 'oem_tank' | 'fia_cell_5gal' | 'fia_cell_10gal' | 'fia_cell_15gal';

  // ══════════════════════════════════════════════════════════════════
  // BODY / CHASSIS
  // ══════════════════════════════════════════════════════════════════
  chassisType: 'unibody' | 'welded_cage' | 'tube_frame';
  seam_weldEnabled: boolean;
  undercoatingRemoved: boolean;
  soundDeadeningRemoved: boolean;
  brakeLightBarEnabled: boolean;
  towHookFrontEnabled: boolean;
  towHookRearEnabled: boolean;
  frontBumperType: 'oem' | 'delete' | 'lightweight_frp' | 'carbon';
  rearBumperType: 'oem' | 'delete' | 'lightweight_frp' | 'carbon';
  hoodType: 'oem_steel' | 'aluminum' | 'carbon' | 'fiberglass';
  trunkType: 'oem_steel' | 'carbon' | 'fiberglass' | 'delete';
  fenderType: 'oem' | 'rolled' | 'pulled' | 'wide_body';
  windowType: 'oem_glass' | 'polycarbonate' | 'lexan';
  windshieldType: 'oem' | 'lightweight';
  rearSeatDelete: boolean;
  carpetDelete: boolean;
  acDelete: boolean;
  powerSteeringDelete: boolean;
  spareTireDelete: boolean;

  // ══════════════════════════════════════════════════════════════════
  // ENGINE MANAGEMENT / SENSORS EXTENDED
  // ══════════════════════════════════════════════════════════════════
  ecuType: 'oem_p28' | 'oem_p72' | 'hondata_s300' | 'hondata_kpro' | 'haltech_elite' | 'aem_infinity' | 'megasquirt' | 'motec_m1';
  tpsType: 'potentiometer' | 'hall_effect' | 'dual_redundant';
  mapSensorType: '1bar' | '2bar' | '3bar' | '4bar' | '5bar';
  iatSensorType: 'oem_thermistor' | 'gm_open_element' | 'bosch';
  ectSensorType: 'oem_thermistor' | 'aftermarket';
  crankSensorType: 'oem_24tooth' | 'aftermarket_36minus1' | '60minus2' | '12tooth';
  camSensorType: 'oem_1pulse' | 'aftermarket_4pulse';
  knockSensorType: 'piezo_flat' | 'piezo_donut' | 'wideband_knock';
  fuelPressureSensorEnabled: boolean;
  fuelPressureSensorRange: number;
  oilPressureSensorRange: number;
  ethAnalyzerEnabled: boolean;     // Flex fuel ethanol content sensor

  // ══════════════════════════════════════════════════════════════════
  // DRIVE-BY-WIRE / ELECTRONIC THROTTLE
  // ══════════════════════════════════════════════════════════════════
  electronicThrottleEnabled: boolean;
  throttleResponseCurve: 'linear' | 'progressive' | 'aggressive' | 'eco';
  throttleBlipOnDownshift: boolean;
  throttleIdleCreepPct: number;
  cruiseControlEnabled: boolean;
  cruiseControlMaxMph: number;

  // ══════════════════════════════════════════════════════════════════
  // FUEL INJECTION EXTENDED
  // ══════════════════════════════════════════════════════════════════
  injectorType: 'port_low_impedance' | 'port_high_impedance' | 'direct';
  injectorCount: number;
  injectorBrandModel: string;
  injectorFlowAt43Psi: number;     // Rated flow at 43 PSI (cc/min)
  injectorBalanceMaxPct: number;   // Maximum injector imbalance %
  fuelRailType: 'oem' | 'high_flow' | 'dual_feed';
  fuelFilterMicron: number;
  fuelPumpType: 'oem_in_tank' | 'walbro_255' | 'dw300' | 'external_surge';
  fuelPumpFlowLph: number;         // Fuel pump flow liters/hour
  fuelRegulatorBasePsi: number;
  fuelRegulatorRiseRatio: number;  // Rise ratio vs boost (1:1 standard)

  // ══════════════════════════════════════════════════════════════════
  // TURBO EXTENDED (detailed compressor/turbine specs)
  // ══════════════════════════════════════════════════════════════════
  turboFrameSize: string;          // e.g. "GT28", "GT3076R", "T3/T4"
  turboCompressorTrim: number;     // Compressor wheel trim (50-82)
  turboTurbineTrim: number;        // Turbine wheel trim (62-84)
  turboCompressorInducerMm: number;
  turboCompressorExducerMm: number;
  turboTurbineInducerMm: number;
  turboTurbineExducerMm: number;
  turboInletFlange: 'T25' | 'T3' | 'T4' | 'T6' | 'V_band';
  turboExitFlange: 'T25' | 'T3' | 'V_band' | '3inch';
  turboWastegateType: 'internal' | 'external_38mm' | 'external_44mm' | 'external_60mm';
  turboWastegateSpringPsi: number;
  turboBearingType: 'journal' | 'ball_bearing' | 'ceramic_ball';
  turboOilFeedRestricted: boolean;
  turboOilDrainSizeMm: number;
  turboWaterCooled: boolean;
  turboHousingARTurbine: number;   // A/R ratio of turbine housing
  turboHousingARCompressor: number;
  blowOffValveType: 'none' | 'recirculating' | 'atmosphere' | 'dual_port';
  boostControllerType: 'none' | 'manual_mbc' | 'electronic_solenoid' | 'eboost2';
  intercoolerType: 'none' | 'fmic' | 'tmic' | 'water_air';
  intercoolerCoreSizeIn: string;   // e.g. "24x12x3"
  intercoolerPipingDiaMm: number;
  chargePipeBoVEnabled: boolean;

  // ══════════════════════════════════════════════════════════════════
  // DASH / GAUGES / DISPLAY
  // ══════════════════════════════════════════════════════════════════
  tachometerRange: number;         // Max RPM on tach face
  speedometerRange: number;        // Max MPH on speedo face
  shiftLightEnabled: boolean;
  shiftLightColor: 'red' | 'blue' | 'green' | 'amber';
  boostGaugeEnabled: boolean;
  boostGaugeRange: number;
  afrGaugeEnabled: boolean;
  oilPressGaugeEnabled: boolean;
  oilTempGaugeEnabled: boolean;
  egtGaugeEnabled: boolean;
  fuelPressGaugeEnabled: boolean;
  ethContentGaugeEnabled: boolean;
  gpsSpeedEnabled: boolean;
  dataLogOverlayEnabled: boolean;

  // ══════════════════════════════════════════════════════════════════
  // SUSPENSION EXTENDED (advanced kinematic params)
  // ══════════════════════════════════════════════════════════════════
  frontBumpStopGapMm: number;
  rearBumpStopGapMm: number;
  frontBumpStopRatekNmm: number;
  rearBumpStopRatekNmm: number;
  frontSpringPerchHeightMm: number;
  rearSpringPerchHeightMm: number;
  frontStrutTopMountType: 'oem_rubber' | 'pillow_ball' | 'spherical';
  rearTopMountType: 'oem_rubber' | 'pillow_ball' | 'spherical';
  coiloverEnabled: boolean;
  coiloverBrand: string;
  frontHelperSpringEnabled: boolean;
  rearHelperSpringEnabled: boolean;
  frontAdjustableDamper: boolean;
  rearAdjustableDamper: boolean;
  frontDamperClicks: number;       // Current damper click setting
  rearDamperClicks: number;
  frontRollCenterHeightMm: number;
  rearRollCenterHeightMm: number;
  frontAntiDivePct: number;
  rearAntiSquatPct: number;
  cornerWeightFLlb: number;
  cornerWeightFRlb: number;
  cornerWeightRLlb: number;
  cornerWeightRRlb: number;

  // ══════════════════════════════════════════════════════════════════
  // AERO EXTENDED
  // ══════════════════════════════════════════════════════════════════
  rearDiffuserEnabled: boolean;
  rearDiffuserAngleDeg: number;
  sideSkirtType: 'none' | 'oem' | 'aero';
  canardEnabled: boolean;
  canardAngleDeg: number;
  flatUndertrayEnabled: boolean;
  fenderVentsEnabled: boolean;
  hoodVentsEnabled: boolean;
  rearWingType: 'none' | 'lip' | 'duckbill' | 'gt_wing' | 'swan_neck';
  frontSplitterMaterialType: 'abs' | 'carbon' | 'aluminum';
  splitterSupportRods: boolean;
  aeroBalancePct: number;          // 0=full front, 100=full rear

  // ══════════════════════════════════════════════════════════════════
  // FUEL ENRICHMENT / TRIM TABLES (8-bin by coolant temp)
  // ══════════════════════════════════════════════════════════════════
  warmupEnrichTempBins: number[];  // 8 coolant temp °F bins
  warmupEnrichPctTable: number[];  // 8 enrichment % values
  afterstartEnrichPctTable: number[];
  cranking_pw_tempBins: number[];  // 8 temp bins for cranking PW
  cranking_pw_msTable: number[];   // 8 cranking PW values

  // ══════════════════════════════════════════════════════════════════
  // AC / ACCESSORY LOADS
  // ══════════════════════════════════════════════════════════════════
  acCompressorLoadHp: number;
  acIdleUpRpm: number;
  psFluidType: 'atf' | 'ps_fluid';
  psPumpType: 'vane' | 'rack_electric';
  alternatorPulleyRatio: number;

  // ══════════════════════════════════════════════════════════════════
  // PAINT / COSMETIC (EM1 options)
  // ══════════════════════════════════════════════════════════════════
  exteriorColor: string;           // e.g. "Electron Blue Pearl"
  interiorColor: 'black' | 'gray';
  sunroofDelete: boolean;
  tintPct: number;                 // Window tint percentage (0=clear, 5=limo)
}

export function getDefaultEcuConfig(): EcuConfig {
  return {
    redlineRpm: 8200,
    fuelCutRpm: 8300,
    revLimitType: 'fuel_cut',
    softCutRpm: 8000,
    softCutRetard: 10,
    speedLimiterMph: 180,

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

    turboEnabled: false,       // Stock B16A2 is naturally aspirated
    wastegateBaseDuty: 50,
    boostTargetPsi: 8,
    boostCutPsi: 55,             // Safety fuel cut — well above any normal target
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

    // Custom shift points
    customShiftPointsEnabled: false,
    customShiftPointsMode: 'rpm' as const,
    customShiftPointsRpm: [7800, 7800, 7800, 7800],   // Shift 1→2, 2→3, 3→4, 4→5
    customShiftPointsMph: [25, 50, 80, 110],            // Vehicle speed thresholds
    customShiftPointsWheelSpeedMph: [30, 55, 85, 115],  // Wheel speed thresholds

    // 1999-2000 Civic Si (EM1) curb weight: 2489 lbs
    vehicleMassLb: 2659,
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
    clutchMaxTorqueNm: 200,   // Stock B16A2 clutch capacity ~200 Nm; aftermarket stage 2+: 350-600+ Nm
    clutchEngagement: 100,     // 100% = instant hard dump (default), 0% = maximum feathered engagement

    fanOnTemp: 200,
    fanOffTemp: 190,
    overtempWarning: 230,
    overtempEnrichPct: 10,

    mapSensorMaxKpa: 105,
    mapSensorMinKpa: 10,
    o2SensorType: 'narrowband',
    coolantSensorOffset: 0,

    compressionRatio: 10.2,

    vtecTargetHp: 0,             // 0 = disabled (manual cam specs), >0 = auto-generate cam specs
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

    // ── Fuel system ──
    fuelType: 'gasoline',
    ethanolContentPct: 0,
    gasolineOctane: 91,
    intercoolerEnabled: false,
    intercoolerEfficiencyPct: 70,

    // ── Weather / environment ──
    ambientTempF: 77,               // Standard 77°F / 25°C
    humidityPct: 50,
    altitudeFt: 0,

    // ── Drivetrain layout (EM1 stock = FWD) ──
    drivetrainType: 'FWD',
    frontDiffType: 'open',
    rearDiffType: 'open',
    centerDiffType: 'open',
    awdFrontBias: 0.6,

    // ══════════════════════════════════════════════════════════════════
    // ENGINE SWAP SYSTEM — Engine identity, transmissions, rear differentials
    // ══════════════════════════════════════════════════════════════════
    engineId: 'b16a2',               // Default: Honda B16A2 (EM1 Civic Si)
    engineLayout: 'I4',              // Inline-4
    bankAngleDeg: 0,                 // 0 for inline engines
    transmissionModel: 'S4C',        // Honda S4C 5-speed (cable-actuated)
    rearDiffModel: 'stock',          // Stock FWD (no separate rear diff)
    rearAxleWidthMm: 0,              // 0 for FWD (no rear axle)

    // ══════════════════════════════════════════════════════════════════
    // EXPANDED ECU PARAMETERS
    // ══════════════════════════════════════════════════════════════════

    // ── Injector Tuning ──
    injectorDeadTimeMs: 0.9,          // Typical 240cc injector at 14V
    injectorAngleDeg: 355,            // End of injection angle
    injectorStagingEnabled: false,
    injectorStagingRpm: 6000,
    injectorStagingSizeCc: 440,

    // ── Fuel Pump ──
    fuelPumpPrimePct: 100,
    fuelPumpBoostPct: 100,
    fuelReturnEnabled: true,          // B16A2 uses return-type fuel system

    // ── Ignition Extended ──
    dwellTimeMs: 3.0,                 // OEM Honda coil dwell
    dwellVoltageComp: true,
    trailingSpark: false,
    sparkPlugGapMm: 1.1,              // NGK BKR6E-11 spec gap
    ignitionCutType: 'hard',

    // ── EGO / Lambda Control ──
    egoTrimMax: 25,
    egoTrimMin: -25,
    egoUpdateRateHz: 10,
    lambdaTarget: 1.0,

    // ── Data Logging ──
    dataLogRateHz: 50,
    dataLogEnabled: false,

    // ── Aux Outputs ──
    auxOutput1Function: 'vtec',
    auxOutput2Function: 'fan',
    shiftLightRpm: 7800,
    shiftLightFlashRpm: 8000,

    // ── Oil System ──
    oilPressureMinPsi: 15,
    oilTempWarningF: 260,
    oilPressureSensorEnabled: false,
    oilTempSensorEnabled: false,

    // ── Exhaust Gas Temperature ──
    egtWarningF: 1600,
    egtSensorEnabled: false,
    egtFuelEnrichDeg: 1500,

    // ── Wideband O2 ──
    widebandAfrMin: 10.0,
    widebandAfrMax: 20.0,
    widebandCalOffset: 0,

    // ══════════════════════════════════════════════════════════════════
    // EXPANDED VEHICLE PARAMETERS (Honda Civic EM1 OEM specs)
    // ══════════════════════════════════════════════════════════════════

    // ── Suspension Geometry (OEM EM1 alignment specs) ──
    frontCamberDeg: -0.5,            // OEM spec: -1°00' to 0°00'
    rearCamberDeg: -1.0,             // OEM spec: -1°30' to -0°30'
    frontToeDeg: 0,                  // OEM spec: 0mm ± 2mm
    rearToeDeg: 0.1,                 // OEM spec: 2mm ± 2mm toe in
    frontCasterDeg: 2.28,            // OEM spec: 1°48' to 3°48'
    frontKPIDeg: 13.0,               // OEM kingpin inclination

    // ── Springs (Honda Civic Si EM1 stock) ──
    frontSpringRateKgmm: 2.5,       // ~25 N/mm stock
    rearSpringRateKgmm: 2.0,        // ~20 N/mm stock
    frontRideHeightMm: 340,          // Front wheel center to fender
    rearRideHeightMm: 350,           // Rear wheel center to fender

    // ── Dampers ──
    frontDamperBump: 5,              // Middle setting (1-10)
    frontDamperRebound: 5,
    rearDamperBump: 5,
    rearDamperRebound: 5,

    // ── Anti-Roll Bars ──
    frontSwayBarDiaMm: 24,           // EM1 front sway bar 24mm
    rearSwayBarDiaMm: 13,            // EM1 rear sway bar 13mm
    frontSwayBarEnabled: true,
    rearSwayBarEnabled: true,

    // ── Brakes (Honda EM1 stock) ──
    brakeBiasFront: 0.60,            // 60/40 front bias
    frontRotorDiaMm: 262,            // EM1 front: 262mm solid
    rearRotorDiaMm: 239,             // EM1 rear: 239mm drum → disc
    brakePadType: 'stock',
    absEnabled: true,                // EM1 has ABS

    // ── Aero ──
    rearWingEnabled: false,
    rearWingAngleDeg: 5,
    frontSplitterEnabled: false,
    downforceCoefficientFront: 0,
    downforceCoefficientRear: 0,
    bodyLiftCoefficient: 0.29,       // Honda Civic EK body lift (sedan shape)

    // ── Weight Distribution ──
    ballastKg: 0,
    ballastPositionPct: 0.5,
    driverWeightKg: 75,

    // ── Steering (Honda EK) ──
    steeringRatio: 15.7,             // OEM rack ratio
    steeringLockDeg: 35,             // Max steering angle at wheels
    powerSteeringEnabled: true,

    // ══════════════════════════════════════════════════════════════════
    // FUEL MAP TABLE (16×16) — B16A2 naturally aspirated baseline
    // ══════════════════════════════════════════════════════════════════
    fuelMapRpmBins: [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000],
    fuelMapLoadBins: [0, 7, 14, 21, 29, 36, 43, 50, 57, 64, 71, 79, 86, 93, 100, 100],
    fuelMapTable: Array.from({ length: 16 }, () => Array(16).fill(1.0)),
    fuelMapInterpolation: 'bilinear',
    fuelMapUnits: 'multiplier',

    // ══════════════════════════════════════════════════════════════════
    // IGNITION MAP TABLE (16×16) — B16A2 base timing
    // ══════════════════════════════════════════════════════════════════
    ignMapRpmBins: [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000],
    ignMapLoadBins: [0, 7, 14, 21, 29, 36, 43, 50, 57, 64, 71, 79, 86, 93, 100, 100],
    ignMapTable: Array.from({ length: 16 }, (_, r) =>
      Array.from({ length: 16 }, (_, c) => {
        const baseAdv = 14 + (r / 15) * 22 - (c / 15) * 10;
        return Math.round(Math.max(8, Math.min(40, baseAdv)));
      })
    ),
    ignMapInterpolation: 'bilinear',

    // ══════════════════════════════════════════════════════════════════
    // VE TABLE (16×16) — typical NA B16A2
    // ══════════════════════════════════════════════════════════════════
    veMapRpmBins: [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000],
    veMapLoadBins: [0, 7, 14, 21, 29, 36, 43, 50, 57, 64, 71, 79, 86, 93, 100, 100],
    veMapTable: Array.from({ length: 16 }, (_, r) =>
      Array.from({ length: 16 }, (_, c) => {
        const ve = 30 + (r / 15) * 55 + (c / 15) * 20;
        return Math.round(Math.min(105, ve));
      })
    ),

    // ══════════════════════════════════════════════════════════════════
    // AFR TARGET TABLE (16×16)
    // ══════════════════════════════════════════════════════════════════
    afrTargetRpmBins: [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000],
    afrTargetLoadBins: [0, 7, 14, 21, 29, 36, 43, 50, 57, 64, 71, 79, 86, 93, 100, 100],
    afrTargetTable: Array.from({ length: 16 }, (_, r) =>
      Array.from({ length: 16 }, (_, c) => {
        if (c > 12) return 12.2;    // WOT rich
        if (c < 4) return 14.7;     // Light load stoich
        return 14.7 - (c / 15) * 2.5;
      })
    ),

    // ══════════════════════════════════════════════════════════════════
    // BOOST TARGET TABLE (8 RPM × 6 gears)
    // ══════════════════════════════════════════════════════════════════
    boostMapRpmBins: [2000, 3000, 4000, 5000, 5500, 6000, 7000, 8000],
    boostMapGearBins: [1, 2, 3, 4, 5, 6],
    boostMapTable: Array.from({ length: 8 }, () => Array(6).fill(8)),

    // ══════════════════════════════════════════════════════════════════
    // CAN BUS
    // ══════════════════════════════════════════════════════════════════
    canBusBaudRate: 500,
    canBusEnabled: false,
    canBusTermination: true,
    canBusRpmId: 0x100,
    canBusTpsId: 0x101,
    canBusVssId: 0x102,
    canBusAfrId: 0x103,
    canBusBoostId: 0x104,
    canBusTempId: 0x105,
    canBusCustomId1: 0x200,
    canBusCustomId2: 0x201,
    canBusStreamRateHz: 50,

    // ══════════════════════════════════════════════════════════════════
    // EMISSIONS / OBD-II
    // ══════════════════════════════════════════════════════════════════
    catalyticConverterEnabled: true,
    catLightOffTempF: 600,
    secondaryAirInjEnabled: false,
    egrEnabled: false,
    egrDutyPct: 0,
    evapPurgeEnabled: true,
    evapPurgeDutyCyclePct: 50,
    milClearEnabled: false,
    o2HeaterEnabled: true,
    readinessFlagsOverride: false,

    // ══════════════════════════════════════════════════════════════════
    // INTAKE SYSTEM (EM1 stock)
    // ══════════════════════════════════════════════════════════════════
    intakeType: 'stock',
    intakeFilterType: 'paper',
    intakePipeDiaMm: 62,
    throttleBodyDiaMm: 62,           // OEM B16A2 62mm
    throttleBodyType: 'single',
    intakeManifoldType: 'stock',
    intakeManifoldRunnerLenMm: 350,  // OEM B16A2 runner length
    intakeManifoldPlenumVolCc: 2800,
    intakeResonatorEnabled: true,
    idleAirBypassEnabled: true,

    // ══════════════════════════════════════════════════════════════════
    // EXHAUST SYSTEM (EM1 stock)
    // ══════════════════════════════════════════════════════════════════
    exhaustHeaderType: 'stock_manifold',
    exhaustHeaderPrimaryDiaMm: 38,
    exhaustHeaderPrimaryLenMm: 305,
    exhaustHeaderCollectorDiaMm: 51,
    exhaustPipeDiaMm: 51,            // OEM 2" exhaust
    exhaustMufflerType: 'stock',
    exhaustResonatorEnabled: true,
    exhaustCatbackType: 'single',
    exhaustTipDiaMm: 63,
    exhaustBackpressureKpa: 8,

    // ══════════════════════════════════════════════════════════════════
    // ENGINE INTERNALS (B16A2 stock specs)
    // ══════════════════════════════════════════════════════════════════
    boreMm: 81,                      // B16A2 bore
    strokeMm: 77.4,                  // B16A2 stroke
    displacementCc: 1595,            // 1.6L
    numCylinders: 4,
    firingOrder: [1, 3, 4, 2],
    connectingRodLenMm: 134,         // B16A2 rod length
    pistonType: 'hypereutectic',
    pistonRingGapMm: 0.25,
    crankshaftType: 'forged',         // B16A2 has forged crank
    bearingClearanceMm: 0.03,
    oilGrade: '5w30',
    headGasketThickMm: 0.6,
    headGasketBoreDiaMm: 82,
    deckHeightMm: 203.9,             // B16A2 block deck height
    combustionChamberCc: 41.6,
    valvesPerCylinder: 4,
    intakeValveDiaMm: 33,            // B16A2 intake valve
    exhaustValveDiaMm: 29,           // B16A2 exhaust valve
    valveStemDiaMm: 5.5,
    valveSpringPressureLb: 42,
    valveSpringInstalledHeightMm: 37,
    rockerArmRatio: 1.0,             // DOHC — direct actuation (rocker ratio 1:1)
    timingChainType: 'belt',          // B16A2 uses timing belt
    balanceShaftEnabled: false,

    // ══════════════════════════════════════════════════════════════════
    // COOLING SYSTEM
    // ══════════════════════════════════════════════════════════════════
    radiatorType: 'stock',
    radiatorCapPsi: 16,              // OEM 1.1 bar ≈ 16 PSI
    thermostatOpenTempF: 170,
    thermostatFullOpenTempF: 190,
    coolantType: 'green',
    coolantMixPct: 50,
    waterPumpType: 'mechanical',
    oilCoolerEnabled: false,
    oilCoolerRowCount: 0,

    // ══════════════════════════════════════════════════════════════════
    // ELECTRICAL SYSTEM
    // ══════════════════════════════════════════════════════════════════
    batteryVoltage: 12.6,
    alternatorOutputAmps: 70,        // OEM EM1 alternator
    ignitionCoilType: 'oem_distributor',
    sparkPlugType: 'copper',         // NGK BKR6E-11
    sparkPlugHeatRange: 6,
    wiringHarnessType: 'oem',
    groundingKitInstalled: false,
    relayFanUpgrade: false,
    mainRelayType: 'oem',

    // ══════════════════════════════════════════════════════════════════
    // TRANSMISSION EXTENDED (S4C)
    // ══════════════════════════════════════════════════════════════════
    transmissionType: 'manual',
    clutchType: 'oem_organic',
    clutchSpringPressureLb: 1800,
    flywheelType: 'oem_single',
    flywheelMassLb: 14,              // OEM B16A2 single mass flywheel ~14 lbs
    synchronizerType: 'brass',
    transFluidType: 'oem_mtf',
    transFluidTempWarningF: 250,
    limitedSlipPreload: 0,
    shortShifterInstalled: false,
    shifterCableBushingType: 'oem_rubber',

    // ══════════════════════════════════════════════════════════════════
    // TPMS
    // ══════════════════════════════════════════════════════════════════
    tpmsEnabled: false,
    frontLeftPsi: 32,
    frontRightPsi: 32,
    rearLeftPsi: 30,
    rearRightPsi: 30,
    tpmsColdPsi: 32,
    tpmsHotDeltaPsi: 4,
    tpmsLowWarningPsi: 26,

    // ══════════════════════════════════════════════════════════════════
    // WHEEL SPECS (OEM EM1: 15x6 ET50)
    // ══════════════════════════════════════════════════════════════════
    wheelWidthIn: 6,
    wheelOffsetMm: 50,
    wheelBoltPattern: '4x100',
    wheelCenterBoreMm: 56.1,
    wheelMaterialType: 'alloy_cast',
    wheelMassLb: 13,
    spareTireType: 'compact',

    // ══════════════════════════════════════════════════════════════════
    // BRAKE EXTENDED (OEM EM1)
    // ══════════════════════════════════════════════════════════════════
    frontCaliperPistons: 1,
    rearCaliperPistons: 1,
    frontCaliperPistonDiaMm: 51,
    rearCaliperPistonDiaMm: 34,
    masterCylBoreMm: 23.8,           // 15/16" OEM master cylinder
    brakeBoosterType: 'vacuum',
    brakeLineType: 'rubber',
    brakeFluidType: 'dot3',
    parkingBrakeType: 'drum_in_hat',
    frontRotorType: 'solid',          // EM1 front: 262mm solid disc
    rearRotorType: 'drum',            // EM1 rear: drum
    frontRotorThickMm: 22,
    rearRotorThickMm: 9,
    brakeDuctingEnabled: false,

    // ══════════════════════════════════════════════════════════════════
    // SAFETY SYSTEMS
    // ══════════════════════════════════════════════════════════════════
    rollCageType: 'none',
    harnessType: 'oem_3point',
    fireExtinguisherType: 'none',
    killSwitchEnabled: false,
    batteryDisconnectEnabled: false,
    windowNetEnabled: false,
    helmetRequired: false,
    fuelCellType: 'oem_tank',

    // ══════════════════════════════════════════════════════════════════
    // BODY / CHASSIS (EM1 stock)
    // ══════════════════════════════════════════════════════════════════
    chassisType: 'unibody',
    seam_weldEnabled: false,
    undercoatingRemoved: false,
    soundDeadeningRemoved: false,
    brakeLightBarEnabled: false,
    towHookFrontEnabled: false,
    towHookRearEnabled: false,
    frontBumperType: 'oem',
    rearBumperType: 'oem',
    hoodType: 'oem_steel',
    trunkType: 'oem_steel',
    fenderType: 'oem',
    windowType: 'oem_glass',
    windshieldType: 'oem',
    rearSeatDelete: false,
    carpetDelete: false,
    acDelete: false,
    powerSteeringDelete: false,
    spareTireDelete: false,

    // ══════════════════════════════════════════════════════════════════
    // ENGINE MANAGEMENT / SENSORS
    // ══════════════════════════════════════════════════════════════════
    ecuType: 'oem_p72',              // OEM B16A2 ECU
    tpsType: 'potentiometer',
    mapSensorType: '1bar',
    iatSensorType: 'oem_thermistor',
    ectSensorType: 'oem_thermistor',
    crankSensorType: 'oem_24tooth',
    camSensorType: 'oem_1pulse',
    knockSensorType: 'piezo_flat',
    fuelPressureSensorEnabled: false,
    fuelPressureSensorRange: 100,
    oilPressureSensorRange: 150,
    ethAnalyzerEnabled: false,

    // ══════════════════════════════════════════════════════════════════
    // DRIVE-BY-WIRE / ELECTRONIC THROTTLE
    // ══════════════════════════════════════════════════════════════════
    electronicThrottleEnabled: false,  // EM1 is cable throttle
    throttleResponseCurve: 'linear',
    throttleBlipOnDownshift: false,
    throttleIdleCreepPct: 5,
    cruiseControlEnabled: true,
    cruiseControlMaxMph: 120,

    // ══════════════════════════════════════════════════════════════════
    // FUEL INJECTION EXTENDED
    // ══════════════════════════════════════════════════════════════════
    injectorType: 'port_high_impedance',
    injectorCount: 4,
    injectorBrandModel: 'OEM Keihin',
    injectorFlowAt43Psi: 240,
    injectorBalanceMaxPct: 5,
    fuelRailType: 'oem',
    fuelFilterMicron: 10,
    fuelPumpType: 'oem_in_tank',
    fuelPumpFlowLph: 110,            // OEM EM1 fuel pump ~110 LPH
    fuelRegulatorBasePsi: 43,
    fuelRegulatorRiseRatio: 1.0,

    // ══════════════════════════════════════════════════════════════════
    // TURBO EXTENDED (defaults for a common B16 turbo kit)
    // ══════════════════════════════════════════════════════════════════
    turboFrameSize: 'GT2860RS',
    turboCompressorTrim: 60,
    turboTurbineTrim: 76,
    turboCompressorInducerMm: 44,
    turboCompressorExducerMm: 60,
    turboTurbineInducerMm: 53,
    turboTurbineExducerMm: 47,
    turboInletFlange: 'T25',
    turboExitFlange: 'V_band',
    turboWastegateType: 'internal',
    turboWastegateSpringPsi: 7,
    turboBearingType: 'ball_bearing',
    turboOilFeedRestricted: true,
    turboOilDrainSizeMm: 16,
    turboWaterCooled: true,
    turboHousingARTurbine: 0.64,
    turboHousingARCompressor: 0.42,
    blowOffValveType: 'recirculating',
    boostControllerType: 'electronic_solenoid',
    intercoolerType: 'fmic',
    intercoolerCoreSizeIn: '24x12x3',
    intercoolerPipingDiaMm: 63,
    chargePipeBoVEnabled: true,

    // ══════════════════════════════════════════════════════════════════
    // DASH / GAUGES / DISPLAY
    // ══════════════════════════════════════════════════════════════════
    tachometerRange: 9000,
    speedometerRange: 160,
    shiftLightEnabled: false,
    shiftLightColor: 'red',
    boostGaugeEnabled: false,
    boostGaugeRange: 30,
    afrGaugeEnabled: false,
    oilPressGaugeEnabled: false,
    oilTempGaugeEnabled: false,
    egtGaugeEnabled: false,
    fuelPressGaugeEnabled: false,
    ethContentGaugeEnabled: false,
    gpsSpeedEnabled: false,
    dataLogOverlayEnabled: false,

    // ══════════════════════════════════════════════════════════════════
    // SUSPENSION EXTENDED
    // ══════════════════════════════════════════════════════════════════
    frontBumpStopGapMm: 60,
    rearBumpStopGapMm: 65,
    frontBumpStopRatekNmm: 30,
    rearBumpStopRatekNmm: 25,
    frontSpringPerchHeightMm: 150,
    rearSpringPerchHeightMm: 140,
    frontStrutTopMountType: 'oem_rubber',
    rearTopMountType: 'oem_rubber',
    coiloverEnabled: false,
    coiloverBrand: 'None',
    frontHelperSpringEnabled: false,
    rearHelperSpringEnabled: false,
    frontAdjustableDamper: false,
    rearAdjustableDamper: false,
    frontDamperClicks: 5,
    rearDamperClicks: 5,
    frontRollCenterHeightMm: 35,
    rearRollCenterHeightMm: 90,
    frontAntiDivePct: 20,
    rearAntiSquatPct: 15,
    cornerWeightFLlb: 760,          // EM1 ~61% front: ~760 FL, ~760 FR
    cornerWeightFRlb: 760,
    cornerWeightRLlb: 485,
    cornerWeightRRlb: 485,

    // ══════════════════════════════════════════════════════════════════
    // AERO EXTENDED
    // ══════════════════════════════════════════════════════════════════
    rearDiffuserEnabled: false,
    rearDiffuserAngleDeg: 12,
    sideSkirtType: 'oem',
    canardEnabled: false,
    canardAngleDeg: 10,
    flatUndertrayEnabled: false,
    fenderVentsEnabled: false,
    hoodVentsEnabled: false,
    rearWingType: 'none',
    frontSplitterMaterialType: 'abs',
    splitterSupportRods: false,
    aeroBalancePct: 45,

    // ══════════════════════════════════════════════════════════════════
    // FUEL ENRICHMENT / TRIM TABLES
    // ══════════════════════════════════════════════════════════════════
    warmupEnrichTempBins: [-40, 0, 40, 80, 120, 160, 190, 210],
    warmupEnrichPctTable: [45, 35, 25, 18, 10, 5, 0, 0],
    afterstartEnrichPctTable: [30, 22, 15, 10, 5, 2, 0, 0],
    cranking_pw_tempBins: [-40, 0, 40, 80, 120, 160, 190, 210],
    cranking_pw_msTable: [25, 20, 17, 15, 13, 12, 11, 10],

    // ══════════════════════════════════════════════════════════════════
    // AC / ACCESSORY LOADS
    // ══════════════════════════════════════════════════════════════════
    acCompressorLoadHp: 5,
    acIdleUpRpm: 100,
    psFluidType: 'ps_fluid',
    psPumpType: 'vane',
    alternatorPulleyRatio: 2.5,

    // ══════════════════════════════════════════════════════════════════
    // PAINT / COSMETIC
    // ══════════════════════════════════════════════════════════════════
    exteriorColor: 'Electron Blue Pearl',
    interiorColor: 'black',
    sunroofDelete: false,
    tintPct: 0,
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
  wheelSpeedMph: number;
  speedMph: number;
  distanceFt: number;
  elapsedTime: number;
  accelerationG: number;
  quarterMileET: number | null;
  quarterMileActive: boolean;
  quarterMileLaunched: boolean;  // True after clutch dump
  clutchIn: boolean;             // True = clutch pedal pressed (disengaged)

  topSpeedMode: boolean;         // True when in top speed run mode
  topSpeedReached: boolean;      // True when terminal velocity detected
  topSpeedMph: number | null;    // Final top speed when reached
  topSpeedDistanceMi: number;    // Distance in miles during top speed run

  currentGearDisplay: number;
  currentGearRatio: number;
  driveshaftRpm: number;
  clutchStatus: string;
  clutchSlipPct: number;       // 0 = fully locked, >0 = clutch disc slipping
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
  effectiveGripPct: number;  // Real-time computed grip as a % (100 = stock baseline)

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
  aeroDownforceFrontLb: number;     // Front aero downforce (or lift if negative) in lbs
  aeroDownforceRearLb: number;      // Rear aero downforce (or lift if negative) in lbs
  aeroLiftLb: number;               // Body lift force in lbs (reduces grip)

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

  // Fuel / weather / drivetrain readouts
  fuelType: string;
  iatF: number;
  airDensity: number;
  densityCorrection: number;
  drivetrainType: string;
  frontDiffType: string;
  rearDiffType: string;
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
  tempFactor: number = 1.0,
  speedMps: number = 0
): { breakingLoose: boolean; slipSeverity: number; slipRatio: number; availableForce: number } {
  // Defensive: ensure normalLoad is positive to prevent division by zero
  const safeNormalLoad = Math.max(normalLoad, 100);
  
  // Get peak slip and force for this compound
  const peakSlip = getPeakSlipRatio(compound);
  const peakForce = pacejkaTireForce(peakSlip, safeNormalLoad, compound, tempFactor);
  
  // Speed-based decay: at highway speed, tires can't physically spin much
  // faster than road speed — higher gears mean less torque multiplication
  // and the wheel's rotational inertia is dominated by road speed.
  const speedMph = speedMps * 2.237;
  const speedDecay = clamp(1 - speedMph / 120, 0.05, 1);
  
  // If wheel force exceeds what tire can provide at peak, we're spinning
  if (wheelForceN <= peakForce) {
    // Tire can handle the force - find the slip ratio that matches
    // Binary search for slip ratio that produces this force
    let lowSlip = 0;
    let highSlip = peakSlip;
    let currentSlip = peakSlip / 2;
    
    for (let i = 0; i < 10; i++) {
      const forceAtSlip = pacejkaTireForce(currentSlip, safeNormalLoad, compound, tempFactor);
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
      slipRatio: currentSlip * speedDecay,
      availableForce: pacejkaTireForce(currentSlip, safeNormalLoad, compound, tempFactor)
    };
  }
  
  // Tire is overwhelmed - find how much slip we have
  // Force exceeds peak, so we're past optimal slip on the declining part of the curve
  const excessForce = wheelForceN - peakForce;
  // Defensive check: prevent division by zero if peakForce is 0 (edge case with no load)
  const forceRatio = peakForce > 0 ? wheelForceN / peakForce : 1;
  
  // Power factor affects how quickly slip develops
  const powerFactor = Math.min(horsePower / 200, 2.5);
  
  // Calculate slip ratio based on excess force
  // More excess = higher slip, modified by power and grip
  const baseSlipIncrease = (forceRatio - 1) * 0.3;
  // Apply speed decay — at 220 mph even with massive power, real slip is tiny
  const rawSlip = peakSlip + baseSlipIncrease * powerFactor;
  const slipRatio = rawSlip * speedDecay;
  
  // At high speed, if the decayed slip is negligible, tires aren't really breaking loose
  if (slipRatio < peakSlip * 0.5) {
    return {
      breakingLoose: false,
      slipSeverity: 0,
      slipRatio: slipRatio,
      availableForce: pacejkaTireForce(Math.min(slipRatio, peakSlip), normalLoad, compound, tempFactor)
    };
  }
  
  // Slip severity for effects (tire squeal, smoke, etc)
  const slipSeverity = (slipRatio - peakSlip) / peakSlip;
  
  // Get actual available force at this slip ratio (will be less than peak)
  const availableForce = pacejkaTireForce(slipRatio, safeNormalLoad, compound, tempFactor);
  
  return {
    breakingLoose: true,
    slipSeverity: clamp(slipSeverity, 0, 3),
    slipRatio: clamp(slipRatio, 0, 3.0),
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
  // Work fine at ambient temps, minimal cold penalty
  street: { baseGrip: 0.88, optimalTempLow: 70, optimalTempHigh: 190, coldGripFactor: 0.97, hotGripFactor: 0.75, heatRate: 1.0, coolRate: 1.0 },
  // Sport: Summer performance tires - matches D=0.95
  // Need slight warmth but cold grip is still strong
  sport: { baseGrip: 0.95, optimalTempLow: 100, optimalTempHigh: 200, coldGripFactor: 0.93, hotGripFactor: 0.65, heatRate: 1.4, coolRate: 0.9 },
  // Semi-slick: R-compound track tires - matches D=1.15
  // Noticeable cold penalty but soft compound still grips well below temp
  semi_slick: { baseGrip: 1.15, optimalTempLow: 140, optimalTempHigh: 250, coldGripFactor: 0.82, hotGripFactor: 0.60, heatRate: 1.5, coolRate: 0.8 },
  // Full slick: Racing slicks - matches D=1.30
  // Cold penalty meaningful but even cold, rubber is softer than any street tire
  full_slick: { baseGrip: 1.30, optimalTempLow: 170, optimalTempHigh: 280, coldGripFactor: 0.72, hotGripFactor: 0.55, heatRate: 2.0, coolRate: 0.7 },
  // Drag slick: Extreme traction - matches D=1.50
  // Designed for burnout warmup; cold still beats all other compounds
  drag_slick: { baseGrip: 1.50, optimalTempLow: 180, optimalTempHigh: 320, coldGripFactor: 0.68, hotGripFactor: 0.50, heatRate: 2.5, coolRate: 0.6 },
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

// Stock reference: 195/55R15 on front axle of FWD Civic Si (~7200N load)
// This gives a baseline patch area that patchMultiplier normalizes against.
// Stock tires → patchMultiplier = 1.0. Wider tires get a modest bonus.
const STOCK_CONTACT_PATCH_AREA = (() => {
  const w = 195 / 25.4; // stock 195mm width
  const load = 1206 * 9.81 * 0.61; // stock front axle load (2659 lb, 61% front)
  const df = clamp(load / 8000, 0.5, 1.5);
  const pl = 3.0 + df * 2.5;
  return w * pl * df * 0.7; // ~25.5 sq in
})();

function getContactPatchArea(widthMm: number, aspectRatio: number, loadN: number): number {
  const sectionWidthIn = widthMm / 25.4;
  const sideWallHeight = widthMm * (aspectRatio / 100);
  const deflectionFactor = clamp(loadN / 8000, 0.5, 1.5);
  const patchLengthIn = 3.0 + deflectionFactor * 2.5;
  return sectionWidthIn * patchLengthIn * deflectionFactor * 0.7;
}

/**
 * Contact patch grip multiplier, normalized to stock 195/55R15.
 * Stock tires = 1.0. Wider tires get a dampened bonus:
 *   225mm → ~1.04, 255mm → ~1.09, 315mm → ~1.15
 * Narrower tires get a slight penalty:
 *   165mm → ~0.96
 * On dry pavement, tire width gives diminishing returns for grip
 * (Coulomb friction is mostly independent of contact area).
 */
function getContactPatchMultiplier(widthMm: number, aspectRatio: number, loadN: number): number {
  const area = getContactPatchArea(widthMm, aspectRatio, loadN);
  const rawRatio = area / STOCK_CONTACT_PATCH_AREA;
  // Dampen: only 30% of the area difference translates to grip change
  // This matches real-world data where wider tires help modestly on dry surfaces
  const mult = 1 + (rawRatio - 1) * 0.3;
  return clamp(mult, 0.85, 1.20);
}

export const B16A2_TORQUE_MAP: [number, number][] = [
  [750, 40], [1000, 50], [1500, 58], [2000, 67], [2500, 75],
  [3000, 82], [3500, 88], [4000, 93], [4500, 96], [5000, 99],
  [5500, 103], [6000, 107], [6500, 109], [7000, 111], [7500, 111],
  [7600, 110.5], [8000, 100], [8200, 95],
];

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE SWAP TORQUE MAPS — Realistic torque curves for every engine preset
// Peak torque values in lb-ft. Each map represents a WOT torque curve.
// ═══════════════════════════════════════════════════════════════════════════

/** Per-engine torque maps keyed by engineId. All values are lb-ft at WOT. */
const ENGINE_TORQUE_MAPS: Record<string, [number, number][]> = {
  // Honda B16A2 — 160 HP @ 7600, 111 lb-ft @ 7000. VTEC high-rev NA.
  'b16a2': B16A2_TORQUE_MAP,

  // Toyota 2JZ-GTE — 320 HP @ 5600, 315 lb-ft @ 4000. Twin-turbo I6.
  '2jz-gte': [
    [750, 95], [1000, 120], [1500, 155], [2000, 200], [2500, 250],
    [3000, 285], [3500, 305], [4000, 315], [4500, 310], [5000, 300],
    [5500, 290], [5600, 285], [6000, 265], [6500, 240], [6800, 220],
  ],

  // Nissan RB26DETT — 276 HP @ 6800, 260 lb-ft @ 4400. Twin-turbo I6.
  'rb26dett': [
    [750, 80], [1000, 105], [1500, 135], [2000, 170], [2500, 210],
    [3000, 238], [3500, 252], [4000, 258], [4400, 260], [5000, 255],
    [5500, 248], [6000, 238], [6500, 225], [6800, 213], [7500, 185], [8000, 165],
  ],

  // GM LS3 6.2L — 430 HP @ 5900, 424 lb-ft @ 4600. Pushrod V8.
  'ls3': [
    [750, 160], [1000, 200], [1500, 255], [2000, 300], [2500, 340],
    [3000, 375], [3500, 400], [4000, 415], [4500, 422], [4600, 424],
    [5000, 418], [5500, 405], [5900, 383], [6200, 360], [6600, 330],
  ],

  // Subaru EJ257 — 305 HP @ 6000, 290 lb-ft @ 4000. Turbo boxer-4.
  'ej257': [
    [750, 85], [1000, 110], [1500, 145], [2000, 185], [2500, 230],
    [3000, 265], [3500, 280], [4000, 290], [4500, 285], [5000, 275],
    [5500, 268], [6000, 267], [6500, 245], [7000, 220],
  ],

  // Mitsubishi 4G63T — 276 HP @ 6500, 275 lb-ft @ 3500. Turbo I4.
  '4g63t': [
    [750, 80], [1000, 108], [1500, 140], [2000, 185], [2500, 235],
    [3000, 260], [3500, 275], [4000, 272], [4500, 265], [5000, 258],
    [5500, 250], [6000, 240], [6500, 223], [7000, 195], [7500, 170],
  ],

  // Honda K20A — 220 HP @ 8000, 152 lb-ft @ 6000. NA i-VTEC.
  'k20a': [
    [750, 48], [1000, 60], [1500, 72], [2000, 82], [2500, 92],
    [3000, 100], [3500, 108], [4000, 118], [4500, 128], [5000, 138],
    [5500, 145], [6000, 152], [6500, 150], [7000, 148], [7500, 145],
    [8000, 144], [8300, 135], [8600, 120],
  ],

  // Mazda 13B-REW — 255 HP @ 6500, 217 lb-ft @ 5000. Twin-turbo rotary.
  '13b-rew': [
    [750, 60], [1000, 82], [1500, 105], [2000, 132], [2500, 160],
    [3000, 182], [3500, 195], [4000, 205], [4500, 212], [5000, 217],
    [5500, 215], [6000, 210], [6500, 206], [7000, 190], [7500, 170],
    [8000, 148], [8500, 125],
  ],

  // Nissan SR20DET — 250 HP @ 6400, 217 lb-ft @ 4800. Turbo I4.
  'sr20det': [
    [750, 65], [1000, 85], [1500, 110], [2000, 140], [2500, 170],
    [3000, 192], [3500, 205], [4000, 212], [4500, 216], [4800, 217],
    [5000, 215], [5500, 208], [6000, 200], [6400, 205], [7000, 180], [7500, 155],
  ],

  // Honda F20C — 240 HP @ 8300, 153 lb-ft @ 7500. NA VTEC S2000.
  'f20c': [
    [750, 45], [1000, 56], [1500, 68], [2000, 78], [2500, 86],
    [3000, 94], [3500, 102], [4000, 110], [4500, 118], [5000, 126],
    [5500, 133], [6000, 140], [6500, 145], [7000, 150], [7500, 153],
    [8000, 151], [8300, 152], [8600, 140], [9000, 120],
  ],

  // Nissan VR38DETT — 565 HP @ 6800, 467 lb-ft @ 3300. Twin-turbo V6.
  'vr38dett': [
    [750, 140], [1000, 185], [1500, 250], [2000, 330], [2500, 400],
    [3000, 450], [3300, 467], [3500, 465], [4000, 458], [4500, 448],
    [5000, 438], [5500, 428], [6000, 418], [6500, 430], [6800, 436],
    [7100, 395],
  ],

  // Toyota/Subaru FA20 — 200 HP @ 7000, 151 lb-ft @ 6400. NA flat-4.
  'fa20': [
    [750, 48], [1000, 60], [1500, 72], [2000, 82], [2500, 92],
    [3000, 102], [3500, 110], [4000, 118], [4500, 126], [5000, 134],
    [5500, 142], [6000, 148], [6400, 151], [7000, 150], [7400, 135],
  ],
};

/**
 * Look up the torque map for a given engine. Falls back to B16A2 if not found.
 * Returns a reference (not a copy) for performance — callers should NOT mutate.
 */
function getEngineTorqueMap(engineId: string): [number, number][] {
  return ENGINE_TORQUE_MAPS[engineId] || B16A2_TORQUE_MAP;
}

/**
 * Compute optimal shift RPM for each gear based on the power curve.
 * For each gear, finds the RPM where power-at-wheel in the NEXT gear
 * (at the RPM it would land at after shifting) first exceeds the power
 * in the current gear. This is the crossover point — shifting any later
 * wastes time on the falling side of the power curve.
 *
 * Works for ANY engine / gear ratio combination automatically.
 */
function computeOptimalShiftPoints(
  gearRatios: number[],
  redlineRpm: number,
  engineId: string,
  customMap?: [number, number][] | null,
  compressionRatio: number = STOCK_COMPRESSION_RATIO,
): number[] {
  const shiftPoints: number[] = [];
  for (let g = 0; g < gearRatios.length - 1; g++) {
    const ratioDrop = gearRatios[g + 1] / gearRatios[g]; // e.g. 2.105/3.230 = 0.652
    let bestShiftRpm = redlineRpm; // fallback: shift at redline
    // Scan from peak-torque region upward in 50 RPM steps.
    // Find the RPM where staying in current gear produces less power
    // than shifting to the next gear would (at the landed RPM).
    for (let rpm = 3000; rpm <= redlineRpm; rpm += 50) {
      const currentPower = getEngineTorque(rpm, 1.0, compressionRatio, customMap, engineId) * rpm;
      const nextGearRpm = rpm * ratioDrop;
      const nextPower = getEngineTorque(nextGearRpm, 1.0, compressionRatio, customMap, engineId) * nextGearRpm;
      // Once power in current gear < power in next gear, we've passed the crossover
      if (currentPower < nextPower && rpm > 4000) {
        bestShiftRpm = rpm;
        break;
      }
    }
    // Clamp: never shift below 5000 or above redline
    shiftPoints.push(clamp(bestShiftRpm, 5000, redlineRpm));
  }
  return shiftPoints;
}

/** Get the stock torque map for the CURRENT engine by ID (for dyno editor baseline) */
export function getStockTorqueMapForEngine(engineId: string): [number, number][] {
  const map = getEngineTorqueMap(engineId);
  return map.map(([r, t]) => [r, t]);
}

/** Get a fresh copy of the stock B16A2 torque map for UI editing (legacy compat) */
export function getStockTorqueMap(): [number, number][] {
  return B16A2_TORQUE_MAP.map(([r, t]) => [r, t]);
}

// Stock B16A2 compression ratio for baseline
const STOCK_COMPRESSION_RATIO = 10.2;

// Per-engine stock compression ratios for proper baseline comparison
const ENGINE_STOCK_COMPRESSION: Record<string, number> = {
  'b16a2': 10.2, '2jz-gte': 8.5, 'rb26dett': 8.5, 'ls3': 10.7,
  'ej257': 8.2, '4g63t': 8.8, 'k20a': 11.5, '13b-rew': 9.0,
  'sr20det': 8.5, 'f20c': 11.7, 'vr38dett': 9.0, 'fa20': 12.5,
};

/** Stock cylinder count per engine — used to scale torque when user changes numCylinders */
const ENGINE_STOCK_CYLINDERS: Record<string, number> = {
  'b16a2': 4, '2jz-gte': 6, 'rb26dett': 6, 'ls3': 8,
  'ej257': 4, '4g63t': 4, 'k20a': 4, '13b-rew': 2,
  'sr20det': 4, 'f20c': 4, 'vr38dett': 6, 'fa20': 4,
};

/**
 * Get engine torque at a given RPM, throttle position, and compression ratio.
 * Supports engine swaps via engineId — uses the correct torque map per engine.
 * If a customMap is provided (user dyno editor), that takes priority.
 * Compression ratio multiplier is relative to the STOCK compression of the swapped engine.
 */
function getEngineTorque(rpm: number, throttlePos: number, compressionRatio: number = STOCK_COMPRESSION_RATIO, customMap?: [number, number][] | null, engineId: string = 'b16a2'): number {
  // Priority: user custom map > engine-specific map > B16A2 fallback
  const tMap = customMap || getEngineTorqueMap(engineId);
  const stockCR = ENGINE_STOCK_COMPRESSION[engineId] || STOCK_COMPRESSION_RATIO;
  
  // Below map minimum: clamp to first point
  if (rpm <= tMap[0][0]) {
    const baseTorque = tMap[0][1] * (0.1 + 0.9 * throttlePos);
    return baseTorque * getCompressionMultiplierRelative(compressionRatio, stockCR);
  }
  
  // Above map maximum: extrapolate with natural falloff
  // Engines lose torque above their designed RPM range due to valve float,
  // breathing losses, friction, etc. — approximately 16% per 1000 RPM.
  if (rpm >= tMap[tMap.length - 1][0]) {
    const lastRpm = tMap[tMap.length - 1][0];
    const lastTorque = tMap[tMap.length - 1][1];
    const overRpmRatio = (rpm - lastRpm) / 1000;
    const falloff = Math.max(0.15, 1 - overRpmRatio * 0.16);
    const baseTorque = lastTorque * falloff * (0.1 + 0.9 * throttlePos);
    return baseTorque * getCompressionMultiplierRelative(compressionRatio, stockCR);
  }
  
  // Within map range: interpolate normally
  let i = 0;
  while (i < tMap.length - 1 && tMap[i + 1][0] <= rpm) i++;
  if (i >= tMap.length - 1) {
    const baseTorque = tMap[tMap.length - 1][1] * (0.1 + 0.9 * throttlePos);
    return baseTorque * getCompressionMultiplierRelative(compressionRatio, stockCR);
  }
  const [r0, t0] = tMap[i];
  const [r1, t1] = tMap[i + 1];
  const frac = (rpm - r0) / (r1 - r0);
  const wotTorque = t0 + (t1 - t0) * frac;
  const baseTorque = wotTorque * (0.1 + 0.9 * throttlePos);
  
  return baseTorque * getCompressionMultiplierRelative(compressionRatio, stockCR);
}

/**
 * Get cylinder count scaling multiplier.
 * The torque map represents the engine at its stock cylinder count.
 * Adding or removing cylinders scales torque proportionally.
 * e.g. B16A2 has 4 cylinders → 6 cylinders = 1.5x torque
 */
export function getCylinderScaling(numCylinders: number, engineId: string): number {
  const stockCyls = ENGINE_STOCK_CYLINDERS[engineId] || 4;
  if (numCylinders === stockCyls || numCylinders <= 0) return 1.0;
  return numCylinders / stockCyls;
}

/** Legacy compatibility wrapper — calls getEngineTorque with B16A2 defaults */
function getB16Torque(rpm: number, throttlePos: number, compressionRatio: number = STOCK_COMPRESSION_RATIO, customMap?: [number, number][] | null): number {
  return getEngineTorque(rpm, throttlePos, compressionRatio, customMap, 'b16a2');
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

/**
 * Compression multiplier relative to a specific engine's stock compression ratio.
 * This way, an LS3 at its stock 10.7:1 = 1.0x, not 1.02x like it would be if
 * compared to the B16A2's 10.2:1 baseline.
 */
function getCompressionMultiplierRelative(compressionRatio: number, stockCR: number): number {
  const cr = Math.max(compressionRatio, 6.0);
  const gamma = 1.3;
  const stockEfficiency = 1 - Math.pow(1 / stockCR, gamma - 1);
  const newEfficiency = 1 - Math.pow(1 / cr, gamma - 1);
  let multiplier = newEfficiency / stockEfficiency;
  if (cr > 14) {
    const excess = cr - 14;
    const baseAt14 = (1 - Math.pow(1 / 14, gamma - 1)) / stockEfficiency;
    const additionalGain = Math.log(1 + excess * 0.15) * 0.25;
    multiplier = baseAt14 + additionalGain;
  }
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

/**
 * Generate VTEC cam specifications to add a target HP on top of low-cam power.
 * 
 * vtecHpAdder is the ADDITIONAL horsepower gained when VTEC engages.
 * Low cam specs stay at stock values; only VTEC cam lift/duration are computed
 * so that (vtecCamMultiplier - lowCamMultiplier) × baseTorque × rpm / 5252
 * equals the requested HP adder at the peak-power RPM.
 * 
 * Returns { vtecIntakeLiftMm, vtecExhaustLiftMm, vtecIntakeDuration, vtecExhaustDuration }
 */
export function generateCamSpecsFromHp(
  vtecHpAdder: number,
  engineId: string = 'b16a2',
  numCylinders: number = 4,
  compressionRatio: number = 10.2,
): {
  vtecIntakeLiftMm: number; vtecExhaustLiftMm: number;
  vtecIntakeDuration: number; vtecExhaustDuration: number;
} {
  // Stock baselines
  const STOCK_VTEC_INTAKE_LIFT = 10.6;
  const STOCK_VTEC_EXHAUST_LIFT = 9.4;
  const STOCK_VTEC_INTAKE_DURATION = 240;
  const STOCK_VTEC_EXHAUST_DURATION = 228;
  const STOCK_LOW_INTAKE_LIFT = 7.6;
  const STOCK_LOW_EXHAUST_LIFT = 7.0;
  const STOCK_LOW_INTAKE_DURATION = 210;
  const STOCK_LOW_EXHAUST_DURATION = 200;

  // Compute the stock low-cam multiplier (what the engine makes without VTEC)
  const lowIntakeLiftRatio = clamp(STOCK_LOW_INTAKE_LIFT / STOCK_LOW_INTAKE_LIFT, 0.7, 1.4); // 1.0
  const lowExhaustLiftRatio = clamp(STOCK_LOW_EXHAUST_LIFT / STOCK_LOW_EXHAUST_LIFT, 0.7, 1.4); // 1.0
  const lowAvgLiftRatio = (lowIntakeLiftRatio + lowExhaustLiftRatio) / 2;
  const lowIntakeDurRatio = clamp(STOCK_LOW_INTAKE_DURATION / STOCK_LOW_INTAKE_DURATION, 0.8, 1.3);
  const lowExhaustDurRatio = clamp(STOCK_LOW_EXHAUST_DURATION / STOCK_LOW_EXHAUST_DURATION, 0.8, 1.3);
  const lowAvgDurRatio = (lowIntakeDurRatio + lowExhaustDurRatio) / 2;
  const lowCamMult = lowAvgLiftRatio * 0.6 + lowAvgDurRatio * 0.4; // ≈ 1.0 for stock

  // Find peak power point from the engine's torque map
  const tMap = getEngineTorqueMap(engineId);
  const cylScale = getCylinderScaling(numCylinders, engineId);
  const stockCR = ENGINE_STOCK_COMPRESSION[engineId] || 10.2;
  const crMult = getCompressionMultiplierRelative(compressionRatio, stockCR);
  
  let bestRpm = 7000;
  let bestHp = 0;
  for (const [rpm, torque] of tMap) {
    const hp = (torque * crMult * cylScale * rpm) / 5252;
    if (hp > bestHp) {
      bestHp = hp;
      bestRpm = rpm;
    }
  }
  
  // Base torque at peak power RPM (from map, with CR and cylinder scaling)
  const baseTorqueAtPeak = interpolateTorqueMap(tMap, bestRpm) * crMult * cylScale;
  
  // Low-cam HP at peak RPM
  const lowCamHp = (baseTorqueAtPeak * lowCamMult * bestRpm) / 5252;
  
  // Total HP the VTEC cam must produce = low-cam HP + the adder
  const totalVtecHp = lowCamHp + vtecHpAdder;
  
  // Required VTEC cam multiplier: totalVtecHp = baseTorque × vtecCamMult × rpm / 5252
  const requiredVtecCamMult = (totalVtecHp * 5252) / (baseTorqueAtPeak * bestRpm);
  
  // Clamp to realistic range (0.8 to 1.8 — mild to full race cam)
  const clampedMult = Math.max(0.8, Math.min(1.8, requiredVtecCamMult));
  
  // The cam multiplier formula is: mult = avgLiftRatio * 0.6 + avgDurationRatio * 0.4
  // We distribute the required gain between lift (60% weight) and duration (40% weight)
  const totalGain = clampedMult - 1.0;
  const liftGainFactor = 1.0 + totalGain * 1.1;   // lift scales more aggressively
  const durationGainFactor = 1.0 + totalGain * 0.85; // duration scales more gradually
  
  // VTEC cam specs
  const vtecIntakeLift = Math.round(clamp(STOCK_VTEC_INTAKE_LIFT * liftGainFactor, 7.0, 15.0) * 10) / 10;
  const vtecExhaustLift = Math.round(clamp(STOCK_VTEC_EXHAUST_LIFT * liftGainFactor, 6.0, 14.0) * 10) / 10;
  const vtecIntakeDur = Math.round(clamp(STOCK_VTEC_INTAKE_DURATION * durationGainFactor, 220, 320) / 2) * 2;
  const vtecExhaustDur = Math.round(clamp(STOCK_VTEC_EXHAUST_DURATION * durationGainFactor, 210, 300) / 2) * 2;
  
  return {
    vtecIntakeLiftMm: vtecIntakeLift,
    vtecExhaustLiftMm: vtecExhaustLift,
    vtecIntakeDuration: vtecIntakeDur,
    vtecExhaustDuration: vtecExhaustDur,
  };
}

/** Helper: interpolate torque from a map at any RPM */
function interpolateTorqueMap(map: [number, number][], rpm: number): number {
  if (rpm <= map[0][0]) return map[0][1];
  if (rpm >= map[map.length - 1][0]) return map[map.length - 1][1];
  let i = 0;
  while (i < map.length - 1 && map[i + 1][0] <= rpm) i++;
  if (i >= map.length - 1) return map[map.length - 1][1];
  const [r0, t0] = map[i];
  const [r1, t1] = map[i + 1];
  return t0 + (t1 - t0) * (rpm - r0) / (r1 - r0);
}

function getGear(speedMph: number): number {
  if (speedMph < 18) return 0;
  if (speedMph < 38) return 1;
  if (speedMph < 62) return 2;
  if (speedMph < 95) return 3;
  return 4;
}

const QUARTER_MILE_FT = 1320;
const STD_AIR_DENSITY = 1.225;  // kg/m³ at sea level 15°C
const GRAVITY = 9.81;
const N_TO_LBS = 0.2248;

// ── Air density model (temperature, humidity, altitude) ──
function getAirDensity(tempF: number, humidityPct: number, altitudeFt: number): number {
  const tempK = (tempF - 32) * 5 / 9 + 273.15;
  // Barometric pressure lapse with altitude (tropospheric model)
  const pressurePa = 101325 * Math.pow(1 - 2.25577e-5 * (altitudeFt * 0.3048), 5.25588);
  // Saturation vapor pressure (Buck equation)
  const tempC = tempK - 273.15;
  const pSat = 611.21 * Math.exp((18.678 - tempC / 234.5) * (tempC / (257.14 + tempC)));
  const pVapor = (humidityPct / 100) * pSat;
  const pDry = pressurePa - pVapor;
  // Density: dry air + water vapor (Rd=287.058, Rv=461.495)
  return (pDry / (287.058 * tempK)) + (pVapor / (461.495 * tempK));
}

// ── Fuel type multipliers ──
function getFuelMultipliers(config: EcuConfig): { powerMult: number; octaneBonus: number; afrTarget: number } {
  let ethPct = 0;
  switch (config.fuelType) {
    case 'e85':      ethPct = 85; break;
    case 'methanol': ethPct = 100; break; // treat methanol as max-ethanol equivalent for power
    case 'flex':     ethPct = config.ethanolContentPct; break;
    default:         ethPct = 0;
  }
  // Ethanol: ~3-5% more power per 10% ethanol, cooler charge temps
  // Methanol: ~5-8% more power (higher latent heat of vaporization)
  const ethanolPowerBonus = config.fuelType === 'methanol'
    ? 0.08  // methanol: +8% power
    : (ethPct / 100) * 0.05;  // E85: up to +5% at full E85
  // Octane bonus: higher octane allows more aggressive timing → more power
  // Baseline = 91 octane, each octane point above gives ~0.5% power
  const octaneBase = config.fuelType === 'gasoline' ? config.gasolineOctane : 105; // E85/meth = ~105 equivalent
  const octaneBonus = (octaneBase - 91) * 0.005;
  // Ethanol AFR: stoich for E85 ≈ 9.8, gasoline ≈ 14.7, methanol ≈ 6.5
  const afrTarget = config.fuelType === 'methanol' ? 6.5
    : 14.7 - (ethPct / 100) * (14.7 - 9.8);
  return {
    powerMult: 1 + ethanolPowerBonus + octaneBonus,
    octaneBonus,
    afrTarget,
  };
}

// ── Intake Air Temperature model ──
function getIATCorrection(ambientTempF: number, boostPsi: number, intercoolerEnabled: boolean, intercoolerEff: number): { iatF: number; densityCorrection: number } {
  const refTempF = 77;

  // Compressor heat rise (~10°F per psi average across typical boost range)
  const compressorHeatF = boostPsi > 0 ? boostPsi * 10 : 0;
  let chargeTemp = ambientTempF + compressorHeatF;
  if (intercoolerEnabled && boostPsi > 0) {
    // Intercooler removes a percentage of the heat added by compression
    const heatRemoved = compressorHeatF * (intercoolerEff / 100);
    chargeTemp -= heatRemoved;
  }

  if (boostPsi > 0) {
    // For boosted engines the boost multiplier (1 + psi/14.7 × 0.9) already
    // models the net torque increase from forced induction.  Applying a full
    // Rankine density correction on top of that double-penalises the output.
    //
    // Instead we only correct for:
    //   1. Ambient temperature deviation from the 77°F reference.
    //   2. A realistic no-intercooler penalty: compressed charge air is hotter
    //      and less dense, costing ~3 % at 10 PSI up to ~20 % at 90 PSI.
    //      An intercooler reduces this penalty proportional to its efficiency.
    let densityCorrection = (refTempF + 459.67) / (ambientTempF + 459.67);

    const heatPenalty = 1 - 1 / (1 + compressorHeatF * 0.0003);
    if (intercoolerEnabled) {
      densityCorrection *= 1 - heatPenalty * (1 - intercoolerEff / 100);
    } else {
      densityCorrection *= 1 - heatPenalty;
    }

    return { iatF: chargeTemp, densityCorrection };
  }

  // NA engines: full charge-temp-based density correction
  // colder air = denser = more power, hotter air = less dense
  const densityCorrection = (refTempF + 459.67) / (chargeTemp + 459.67);
  return { iatF: chargeTemp, densityCorrection };
}

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
  drivenWheels: number;  // 2 for FWD/RWD, 4 for AWD
}

function computeDerived(config: EcuConfig): DerivedConstants {
  const tireCircumferenceFt = (config.tireDiameterIn * Math.PI) / 12;
  const tireRadiusM = config.tireDiameterIn * 0.0254 / 2;
  const tireMassKg = config.tireMassLb * 0.4536;
  const tireInertia = 0.75 * tireMassKg * tireRadiusM * tireRadiusM;
  const drivenWheels = config.drivetrainType === 'AWD' ? 4 : 2;
  const totalTireInertia = drivenWheels * tireInertia;
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
    drivenWheels,
  };
}

// ══════════════════════════════════════════════════════════════════
// DYNO MODE TYPES
// ══════════════════════════════════════════════════════════════════

export interface DynoDataPoint {
  rpm: number;
  torqueNm: number;
  torqueFtLb: number;
  hp: number;
  boostPsi: number;
  afrActual: number;
  egtF: number;
  iatF: number;
  timingDeg: number;
  vePct: number;
  injDutyPct: number;
  oilTempF: number;
  coolantTempF: number;
  throttlePct: number;
  timestamp: number;
}

export interface DynoRun {
  id: string;
  name: string;
  timestamp: number;
  startRpm: number;
  endRpm: number;
  peakHp: number;
  peakHpRpm: number;
  peakTorqueNm: number;
  peakTorqueFtLb: number;
  peakTorqueRpm: number;
  points: DynoDataPoint[];
  programType: DynoProgramType;
  correctionFactor: number;
}

export type DynoProgramType = 'wot_sweep' | 'steady_state' | 'step_test' | 'part_throttle' | 'manual';

export interface DynoPullConfig {
  programType: DynoProgramType;
  startRpm: number;
  endRpm: number;
  sweepRateRpmPerSec: number;
  throttlePct: number;
  holdRpm?: number;
  stepSizeRpm?: number;
  stepHoldTimeSec?: number;
  saeCorrectionEnabled: boolean;
}

export function getDefaultDynoPullConfig(): DynoPullConfig {
  return {
    programType: 'wot_sweep',
    startRpm: 2500,
    endRpm: 8200,
    sweepRateRpmPerSec: 300,
    throttlePct: 100,
    saeCorrectionEnabled: true,
  };
}

export function createEngineSimulation(ecuConfig?: EcuConfig) {
  let config: EcuConfig = ecuConfig ? { ...ecuConfig } : getDefaultEcuConfig();
  let derived = computeDerived(config);
  log.info('engineSim', 'Simulation created', { redline: config.redlineRpm, mass: config.vehicleMassLb, drive: config.drivetrainType });
  let aiCorrections = { gripMultiplier: 1.0, weightTransferMultiplier: 1.0, slipMultiplier: 1.0, dragMultiplier: 1.0, tractionMultiplier: 1.0 };
  let customTorqueMap: [number, number][] | null = null;

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
  let topSpeedMode = false;       // Unlimited road space mode
  let topSpeedReached = false;    // Terminal velocity detected
  let topSpeedMph: number | null = null;  // Final measured top speed
  let topSpeedSamples: number[] = [];     // Speed samples for terminal velocity detection
  let prevSpeedMps = 0;
  let currentGear = 0;
  let shiftTimer = 0;
  let wheelSpeedMps = 0;
  let highRpmDwellTime = 0;  // Tracks how long RPM has been above 8000 in current gear
  let cachedOptimalShiftPoints: number[] = computeOptimalShiftPoints(
    config.gearRatios, config.redlineRpm, config.engineId, customTorqueMap, config.compressionRatio
  );

  let tireTemp = 115;  // Start tires warmer (ambient + staging/burnout heat) — adjusted per-run below
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

  // ── Dyno mode state ──
  let dynoMode = false;
  let dynoPullActive = false;
  let dynoPullConfig: DynoPullConfig = getDefaultDynoPullConfig();
  let dynoPullProgress = 0;   // 0-1 progress through sweep
  let dynoRpmTarget = 0;      // Current RPM target for absorber
  let dynoPullElapsed = 0;    // Seconds elapsed in current pull
  let dynoCurrentRun: DynoDataPoint[] = [];
  let dynoRunHistory: DynoRun[] = [];
  let dynoSampleTimer = 0;
  let dynoStepIndex = 0;      // For step test
  let dynoStepHoldTimer = 0;  // For step test hold duration
  // Dyno absorber: models inertia drum / eddy-current brake
  const DYNO_INERTIA_KGM2 = 0.5; // Virtual drum inertia (like a smallish chassis dyno roller)
  const DYNO_ABSORBER_GAIN = 50;  // How aggressively absorber brakes to hold RPM (Nm per rad/s error)
  let dynoAbsorberTorqueNm = 0;   // Current absorber braking torque

  // ── Per-frame telemetry capture for diagnostics ──
  let runTelemetry: Record<string, unknown>[] = [];
  let _lastEngineTorqueNm = 0;
  let _lastTransmittedTorqueNm = 0;
  let _lastRawWheelForceN = 0;

  // ── Clutch slip model state ──
  // When the clutch is dumped, it doesn't instantly lock — the clutch disc
  // slips against the flywheel, transferring torque limited by clamping force.
  // Engine RPM and wheel-driven RPM converge over time as the clutch heats
  // and grabs harder.
  let clutchSlipping = false;       // True during clutch slip after launch
  let clutchFullyEngaged = false;   // Once true, never re-enter slip phase this run
  let clutchLockupTimer = 0;        // Time since clutch dump (for progressive lockup)
  // Engine rotational inertia = crank + clutch disc (fixed ~0.04 kgm²) + flywheel (from config mass).
  // OEM B16 single-mass flywheel: 14 lb = 0.08 kgm², total ≈ 0.12 kgm².
  // Lightweight aluminum: 7 lb = 0.04 kgm², total ≈ 0.08 kgm² (revs faster, less stored energy at launch).
  const flywheelInertia = (config.flywheelMassLb * 0.4536) * 0.005; // rough kgm² from mass
  const ENGINE_INERTIA_KGM2 = 0.04 + flywheelInertia; // crank+clutch disc + flywheel

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
    log.info('engineSim', 'Quarter mile started — staging');
    runTelemetry = [];  // Clear previous run telemetry
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
    // CRITICAL: Reset throttle to idle for staging, otherwise repeat runs
    // carry over throttle=1.0 from previous launch and the staging code
    // free-revs the engine to redline before the driver even dumps the clutch.
    throttle = 0;
    prevThrottle = 0;
    targetRpm = config.targetIdleRpm;
    currentRpm = config.targetIdleRpm;

    clutchSlipping = false;
    clutchFullyEngaged = false;
    clutchLockupTimer = 0;
    // Tire starting temp: ambient base + pavement heat soak + burnout warmup
    // On a 95°F day with ~148°F pavement, tires start around 140°F
    // On a 77°F day with ~103°F pavement, tires start around 115°F
    const _surfTemp1 = config.ambientTempF + clamp((config.ambientTempF - 60) * 1.5, 0, 70);
    tireTemp = Math.max(config.ambientTempF + 20, _surfTemp1 * 0.8 + 20);
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
      // ── Auto-floor throttle ──────────────────────────────────
      // In a real drag launch, the driver floors it AS they dump the clutch.
      // Without this, the user would need to separately manage a throttle
      // slider on a phone screen — unrealistic and results in idle-bog launches.
      throttle = 1.0;
      targetRpm = config.redlineRpm;

      // ── Pre-launch rev buildup ──────────────────────────────
      // Simulate the driver revving the engine before dumping the clutch.
      // In reality, you hold the brake, build RPM, then dump.
      // Default launch RPM: launch control RPM if enabled, otherwise ~60% of redline.
      const launchRpm = config.launchControlEnabled
        ? config.launchControlRpm
        : Math.min(config.redlineRpm * 0.6, 5500);
      // UNCONDITIONALLY set launch RPM — don't let stale high RPM carry over.
      // In real life, the driver holds brake + revs to a specific RPM.
      currentRpm = launchRpm;

      qmLaunched = true;
      clutchIn = false;       // Release clutch pedal
      clutchSlipping = true;  // Clutch disc slips against flywheel initially
      clutchFullyEngaged = false; // Reset — clutch hasn't locked up yet
      clutchLockupTimer = 0;  // Start lockup timer
      log.info('engineSim', 'Launch! Clutch dumped', { rpm: currentRpm, gear: currentGear + 1, boostPsi: boostPsi.toFixed(1), throttle: '100%' });
    } else {
    }
  }

  function resetQuarterMile() {
    // runTelemetry is NOT cleared here — dashboard grabs it before reset
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

    clutchSlipping = false;
    clutchFullyEngaged = false;
    clutchLockupTimer = 0;
    const _surfTemp2 = config.ambientTempF + clamp((config.ambientTempF - 60) * 1.5, 0, 70);
    tireTemp = Math.max(config.ambientTempF + 20, _surfTemp2 * 0.8 + 20);
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
    topSpeedMode = false;
    topSpeedReached = false;
    topSpeedMph = null;
    topSpeedSamples = [];
  }

  function startTopSpeedRun() {
    log.info('engineSim', 'Top speed run started — staging');
    speedMps = 0;
    distanceFt = 0;
    qmElapsedTime = 0;
    qmET = null;
    qmActive = true;
    qmLaunched = false;
    clutchIn = true;
    prevSpeedMps = 0;
    currentGear = 0;
    shiftTimer = 0;
    wheelSpeedMps = 0;
    const _surfTemp3 = config.ambientTempF + clamp((config.ambientTempF - 60) * 1.5, 0, 70);
    tireTemp = Math.max(config.ambientTempF + 20, _surfTemp3 * 0.8 + 20);
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
    topSpeedMode = true;
    topSpeedReached = false;
    topSpeedMph = null;
    topSpeedSamples = [];
  }

  function resetTopSpeedRun() {
    topSpeedMode = false;
    topSpeedReached = false;
    topSpeedMph = null;
    topSpeedSamples = [];
    resetQuarterMile();
  }

  function setEcuConfig(newConfig: EcuConfig) {
    config = { ...newConfig };
    config.tireDiameterIn = (config.tireWidthMm * (config.tireAspectRatio / 100) * 2 / 25.4) + config.tireWheelDiameterIn;
    derived = computeDerived(config);
    cachedOptimalShiftPoints = computeOptimalShiftPoints(
      config.gearRatios, config.redlineRpm, config.engineId, customTorqueMap, config.compressionRatio
    );
  }

  function getEcuConfig(): EcuConfig {
    return { ...config };
  }

  function update(deltaMs: number): EngineState {
    // ── CRITICAL: Clamp delta to prevent physics divergence ──
    // Large deltas (tab backgrounded, GC pause, heavy rendering) cause
    // speed/RPM to overshoot, NaN propagation, and audio freeze.
    // Max single-step dt = 50ms (20 FPS minimum). If larger, sub-step.
    const MAX_STEP_MS = 50;
    const clampedDeltaMs = Math.min(Math.max(deltaMs, 0), 200); // absolute max 200ms
    if (clampedDeltaMs > MAX_STEP_MS) {
      // Sub-step: run multiple small physics steps
      const steps = Math.ceil(clampedDeltaMs / MAX_STEP_MS);
      const stepMs = clampedDeltaMs / steps;
      let lastState: EngineState | null = null;
      for (let i = 0; i < steps; i++) {
        lastState = update(stepMs);
      }
      return lastState!;
    }
    const dt = clampedDeltaMs / 1000;
    // Guard against zero/negative dt
    if (dt <= 0) return update(16); // fallback to ~60fps step

    const idleRpm = config.targetIdleRpm;
    const redline = config.redlineRpm;
    const fuelCutRpm = config.fuelCutRpm;
    const softCutRpm = config.softCutRpm;

    const compound = TIRE_COMPOUNDS[config.tireCompound] || TIRE_COMPOUNDS.street;

    // ── Weather & fuel corrections (computed once per frame) ──
    const airDensity = getAirDensity(config.ambientTempF, config.humidityPct, config.altitudeFt);
    const airDensityRatio = airDensity / STD_AIR_DENSITY; // <1 in hot/high altitude, >1 in cold
    const fuelMults = getFuelMultipliers(config);
    const iatData = getIATCorrection(config.ambientTempF, boostPsi, config.intercoolerEnabled, config.intercoolerEfficiencyPct);
    // Combined intake charge correction: denser air + fuel octane/type bonus
    const chargePowerMult = iatData.densityCorrection * fuelMults.powerMult;

    // ══════════════════════════════════════════════════════════════════
    // DYNO MODE — engine runs on virtual dyno, no vehicle dynamics
    // ══════════════════════════════════════════════════════════════════
    if (dynoMode) {
      // VTEC engagement
      if (vtecActive) {
        if (currentRpm < config.vtecDisengageRpm) vtecActive = false;
      } else {
        if (currentRpm >= config.vtecEngageRpm) vtecActive = true;
      }

      // Fan control
      if (coolantTemp + config.coolantSensorOffset >= config.fanOnTemp) fanOn = true;
      else if (coolantTemp + config.coolantSensorOffset <= config.fanOffTemp) fanOn = false;

      // Boost model (simplified version of the main loop's turbo logic)
      if (config.turboEnabled) {
        const rpmFactor = clamp((currentRpm - 2000) / 4000, 0, 1);
        const boostTarget = config.boostTargetPsi;
        const effectiveTarget = Math.min(boostTarget, (config.boostCutPsi || boostTarget + 4) - 2);
        const rawTarget = effectiveTarget * rpmFactor * throttle;
        const turboLag = rawTarget > 20 ? 1.5 : rawTarget > 10 ? 2.5 : 3.5;
        boostPsi = lerp(boostPsi, rawTarget, dt * turboLag);
        if (boostPsi < 0.1) boostPsi = 0;
      } else if (config.superchargerEnabled) {
        boostPsi = config.superchargerMaxBoostPsi * clamp(currentRpm / redline, 0, 1) * throttle;
      } else {
        boostPsi = 0;
      }

      // Engine torque calculation
      let torqueFtLb = getEngineTorque(currentRpm, throttle, config.compressionRatio, customTorqueMap, config.engineId);

      // Boost multiplier
      const boostMult = boostPsi > 0 ? 1 + (boostPsi / 14.7) * 0.9 : 1;
      torqueFtLb *= boostMult * chargePowerMult;

      // Nitrous
      let nitrousActiveNow = false;
      if (config.nitrousEnabled && currentRpm >= config.nitrousActivationRpm && throttle >= 0.95) {
        const nitrousTorqueAdd = (config.nitrousHpAdder * 5252) / Math.max(currentRpm, 1000);
        torqueFtLb += nitrousTorqueAdd;
        nitrousActiveNow = true;
      }

      // Supercharger parasitic loss
      let scParasiticLoss = 0;
      if (config.superchargerEnabled) {
        scParasiticLoss = boostPsi * 2.5;
        torqueFtLb -= scParasiticLoss;
      }

      // Rev limiter
      let fuelCutActive = false;
      let revLimitActive = false;
      if (currentRpm >= fuelCutRpm) {
        torqueFtLb = 0;
        fuelCutActive = true;
        revLimitActive = true;
      } else if (currentRpm >= softCutRpm) {
        torqueFtLb *= 0.5;
        fuelCutActive = true;
      }

      const torqueNm = torqueFtLb * 1.3558;
      const engineHp = torqueFtLb * currentRpm / 5252;

      // Dyno absorber physics: engine torque vs absorber load
      // Net torque on the engine+dyno system determines RPM change
      if (dynoPullActive) {
        // During a pull, absorber targets the sweep RPM
        const rpmError = currentRpm - dynoRpmTarget;
        dynoAbsorberTorqueNm = clamp(rpmError * DYNO_ABSORBER_GAIN, 0, torqueNm * 2);
        const netTorque = torqueNm - dynoAbsorberTorqueNm;
        const totalInertia = ENGINE_INERTIA_KGM2 + DYNO_INERTIA_KGM2;
        const angularAccel = netTorque / totalInertia;
        currentRpm += angularAccel * (30 / Math.PI) * dt;
        updateDynoPull(dt, torqueNm, engineHp);
      } else {
        // Free rev / idle: engine spins against its own inertia + light friction
        const frictionTorque = 5 + currentRpm * 0.003; // Engine internal friction (Nm)
        const netTorque = torqueNm - frictionTorque;
        const angularAccel = netTorque / ENGINE_INERTIA_KGM2;
        currentRpm += angularAccel * (30 / Math.PI) * dt;
      }

      // Clamp RPM
      currentRpm = clamp(currentRpm, idleRpm * 0.5, fuelCutRpm + 200);
      if (throttle < 0.02 && currentRpm > idleRpm) {
        currentRpm = lerp(currentRpm, idleRpm, dt * 3);
      }

      // Crank angle
      crankAngle = (crankAngle + currentRpm * 6 * dt) % 720;

      // Temperature models
      const heatInput = (torqueNm * currentRpm / 9549) * 0.3; // ~30% of power → heat
      coolantTemp = lerp(coolantTemp, 185 + heatInput * 0.15, dt * 0.05);
      oilTemp = lerp(oilTemp, coolantTemp + 20 + heatInput * 0.1, dt * 0.03);
      if (fanOn) coolantTemp -= dt * 5;

      // Sensor values
      const cylinderPressure = getCylinderPressure(crankAngle, throttle, currentRpm, config.compressionRatio);
      const intakeManifoldPressure = boostPsi > 0 ? 14.7 + boostPsi : 14.7 * (0.3 + throttle * 0.7);
      const exhaustGasTemp = 400 + (currentRpm / redline) * 800 + throttle * 200 + boostPsi * 15;
      const oilPressure = 15 + (currentRpm / 1000) * 8;
      const airFuelRatio = throttle > 0.7 ? config.targetAfrWot : throttle > 0.3 ? config.targetAfrCruise : config.targetAfrIdle;
      const ignitionTiming = config.baseTimingDeg + (config.maxAdvanceDeg - config.baseTimingDeg) * clamp(currentRpm / redline, 0, 1) - currentKnockRetard;
      const intakeValveLift = getValveLift(crankAngle, true) * (vtecActive ? config.vtecIntakeLiftMm / 10.6 : config.lowCamIntakeLiftMm / 10.6);
      const exhaustValveLift = getValveLift(crankAngle, false) * (vtecActive ? config.vtecExhaustLiftMm / 9.4 : config.lowCamExhaustLiftMm / 9.4);
      const fuelInjectionPulse = clamp(throttle * 8 + (currentRpm / redline) * 4, 0.5, 20);
      const volumetricEfficiency = 85 + throttle * 15 * clamp(currentRpm / (redline * 0.7), 0.5, 1.1);
      const speedMph = 0;
      const engineLoad = clamp(throttle * 100 * (currentRpm / redline) * 0.8 + 20, 0, 100);

      // Knock detection
      if (currentKnockRetard > 0) {
        currentKnockRetard = Math.max(0, currentKnockRetard - config.knockRecoveryRate * dt);
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
        sparkAdvance: Math.round(ignitionTiming * 10) / 10,
        fuelInjectionPulse: Math.round(fuelInjectionPulse * 100) / 100,
        volumetricEfficiency: Math.round(volumetricEfficiency * 10) / 10,
        torque: Math.round(torqueFtLb * 10) / 10,
        horsepower: Math.round(engineHp * 10) / 10,
        fuelConsumption: Math.round(torqueFtLb * currentRpm / 5252 * 0.5 * 10) / 10,
        tireRpm: 0,
        wheelSpeedMph: 0,
        speedMph: 0,
        distanceFt: 0,
        elapsedTime: 0,
        accelerationG: 0,
        quarterMileET: null,
        quarterMileActive: false,
        quarterMileLaunched: false,
        clutchIn: true,
        topSpeedMode: false,
        topSpeedReached: false,
        topSpeedMph: null,
        topSpeedDistanceMi: 0,
        currentGearDisplay: 0,
        currentGearRatio: 0,
        driveshaftRpm: 0,
        clutchStatus: "DYNO",
        clutchSlipPct: 0,
        wheelTorque: Math.round(torqueFtLb * 10) / 10,
        wheelForce: 0,
        frontAxleLoad: 0,
        rearAxleLoad: 0,
        weightTransfer: 0,
        tireSlipPercent: 0,
        tractionLimit: 0,
        tireTemp: 0,
        contactPatchArea: 0,
        tireTempOptimal: true,
        effectiveGripPct: 0,
        sixtyFootTime: null,
        threeThirtyTime: null,
        eighthMileTime: null,
        thousandFootTime: null,
        trapSpeed: null,
        peakAccelG: 0,
        peakWheelHp: Math.round(engineHp * 10) / 10,
        peakRpm: Math.round(currentRpm),
        peakBoostPsi: Math.round(boostPsi * 10) / 10,
        peakSpeedMph: 0,
        peakSlipPercent: 0,
        dragForce: 0,
        rollingResistance: 0,
        netForce: 0,
        aeroDownforceFrontLb: 0,
        aeroDownforceRearLb: 0,
        aeroLiftLb: 0,
        vtecActive,
        engineLoad: Math.round(engineLoad),
        intakeAirTemp: Math.round(iatData.iatF),
        intakeVacuum: clamp((101.325 - intakeManifoldPressure * 0.6895) * 0.2953, 0, 25),
        fuelPressure: Math.round(config.fuelPressurePsi * 10) / 10,
        batteryVoltage: 14.2,
        o2SensorVoltage: airFuelRatio < 14.7 ? 0.8 : 0.15,
        knockCount,
        catalystTemp: Math.round(exhaustGasTemp * 0.85),
        speedKmh: 0,
        distanceMeters: 0,
        boostPsi: Math.round(boostPsi * 10) / 10,
        fanStatus: fanOn,
        closedLoopStatus: throttle < 0.7 && config.closedLoopEnabled ? 'CLOSED' : 'OPEN',
        launchControlActive: false,
        tractionControlActive: false,
        knockRetardActive: Math.round(currentKnockRetard * 10) / 10,
        fuelCutActive,
        revLimitActive,
        turboEnabled: config.turboEnabled,
        nitrousActive: nitrousActiveNow,
        superchargerEnabled: config.superchargerEnabled,
        fuelType: config.fuelType,
        iatF: Math.round(iatData.iatF),
        airDensity: Math.round(airDensity * 1000) / 1000,
        densityCorrection: Math.round(iatData.densityCorrection * 1000) / 1000,
        drivetrainType: config.drivetrainType,
        frontDiffType: config.frontDiffType,
        rearDiffType: config.rearDiffType,
      };
    }
    // ══════════════════════════════════════════════════════════════════
    // END DYNO MODE — normal vehicle dynamics below
    // ══════════════════════════════════════════════════════════════════

    // Cold-weather traction penalty: below 40°F, rubber hardens
    const coldTractionPenalty = config.ambientTempF < 40
      ? clamp(1 - (40 - config.ambientTempF) / 80 * 0.15, 0.85, 1) : 1;
    // Track surface temperature: asphalt absorbs solar heat.
    // On a hot day (95°F), pavement can reach 140-160°F.
    // Hot pavement heats tires faster AND the soft asphalt bites into rubber.
    const trackSurfaceTempF = config.ambientTempF + clamp((config.ambientTempF - 60) * 1.5, 0, 70);
    // Hot surface grip bonus: prepped hot drag strip adds traction.
    // At 77°F ambient → surface ~103°F → small bonus (1.02×)
    // At 95°F ambient → surface ~148°F → meaningful bonus (1.06×)
    // Below 70°F → no bonus (cold pavement doesn't help)
    const hotSurfaceGripMult = trackSurfaceTempF > 100
      ? clamp(1 + (trackSurfaceTempF - 100) * 0.001, 1.0, 1.08)
      : 1.0;
    // Drivetrain traction: which axle is driven?
    const isFWD = config.drivetrainType === 'FWD';
    const isRWD = config.drivetrainType === 'RWD';
    const isAWD = config.drivetrainType === 'AWD';
    const drivenAxleBias = isFWD ? config.frontWeightBias
      : isRWD ? (1 - config.frontWeightBias)
      : 1; // AWD uses both axles — full weight for traction

    // ── Differential type ────────────────────────────────────────
    // The diff type doesn't change the tire's static grip limit — both tires
    // have full grip on a flat, straight drag strip regardless of diff.
    // What changes is how much PROPULSIVE FORCE the car keeps during
    // wheelspin: open diff sends all torque to the spinning wheel (wasted),
    // LSD keeps both wheels pushing, locked = full coupling.
    const drivenDiffType = isFWD ? config.frontDiffType
      : isRWD ? config.rearDiffType
      : config.centerDiffType === 'locked' ? 'locked'
      : config.centerDiffType === 'torsen' ? 'lsd'
      : config.centerDiffType === 'viscous' ? 'lsd'
      : 'open';
    // Multiplier on kinetic friction force DURING wheelspin:
    // On a drag strip (equal surface both sides), an open diff sends EQUAL
    // torque to both wheels. Both tires spin, both provide kinetic friction.
    // The penalty is from slight asymmetry, torque steer, and spider gear
    // friction — roughly 15%, not 45%. LSD adds clutch-pack coupling for
    // better traction recovery. Locked = perfect coupling.
    const diffWheelspinMult = drivenDiffType === 'locked' ? 1.0
      : drivenDiffType === 'lsd' ? 0.95
      : 0.85; // open — both wheels spin on equal surface, small penalty

    let wheelForceN = 0;
    let dragForceN = 0;
    let rollingForceN = 0;
    let netForceN = 0;
    let weightTransferN = 0;
    let aeroDownforceFrontN = 0;
    let aeroDownforceRearN = 0;
    let aeroLiftN = 0;
    // Driven axle load depends on drivetrain type
    let frontAxleLoadN = derived.vehicleMassKg * GRAVITY * config.frontWeightBias;
    let rearAxleLoadN = derived.vehicleMassKg * GRAVITY * (1 - config.frontWeightBias);
    let drivenAxleLoadN = isFWD ? frontAxleLoadN
      : isRWD ? rearAxleLoadN
      : (frontAxleLoadN + rearAxleLoadN); // AWD = full vehicle weight for traction
    let effectiveGrip = getTireGripAtTemp(compound, tireTemp, config.tireGripPct, config.tireTempSensitivity) * coldTractionPenalty;
    let patchMultiplier = getContactPatchMultiplier(config.tireWidthMm, config.tireAspectRatio, drivenAxleLoadN);
    let finalGrip = effectiveGrip * patchMultiplier;
    let maxTractionForceN = drivenAxleLoadN * finalGrip;
    let slipRatio = 0;
    let clutchStatus = "ENGAGED";
    let clutchSlipPct = 0;
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
        log.debug('engineSim', 'VTEC disengaged', { rpm: Math.round(currentRpm) });
      }
    } else {
      if (currentRpm >= config.vtecEngageRpm) {
        vtecActive = true;
        log.debug('engineSim', 'VTEC engaged!', { rpm: Math.round(currentRpm) });
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
      
      // ── Load-dependent boost ──────────────────────────────────
      // Boost depends on exhaust energy (RPM × throttle × load).
      // In neutral the load factor reduces boost since there's no combustion load.
      // Once launched and under acceleration, full boost is available quickly.
      let loadFactor: number;
      
      // Antilag / two-step override: builds boost while staging
      const antiLagActive = config.antiLagEnabled && config.turboEnabled && clutchIn && throttle > 0.3 && currentRpm > 2500;
      const twoStepActive = config.twoStepEnabled && clutchIn && currentRpm >= config.twoStepRpm * 0.9;
      
      if (antiLagActive || twoStepActive) {
        // Antilag: builds 70-85% boost while stationary via timing retard
        loadFactor = clamp(0.7 + throttle * 0.15, 0.7, 0.85);
        const antilagRetardDeg = config.antiLagRetard || 20;
        timingRetardTotal += antilagRetardDeg * 0.5;
      } else if (clutchIn || (!qmActive && currentGear === 0)) {
        // Neutral / clutch disengaged: reduced load but not negligible
        // Turbo still spools from exhaust gas — just less efficiently
        loadFactor = clamp(0.15 + rpmFactor * 0.25, 0.15, 0.40);
      } else {
        // In gear under load (launched, driving): full boost available
        // Immediately after clutch dump engine is under full load
        loadFactor = clamp(0.85 + throttle * 0.15, 0.85, 1.0);
      }
      
      // Effective target: can never exceed boost cut safety threshold.
      // A real ECU targets below the cut point to avoid oscillation.
      // If the user sets target > boostCut, the wastegate simply limits
      // boost to just under the cut threshold — it doesn't oscillate.
      //
      // Wastegate duty controls HOW the target is maintained:
      //   0% duty = wastegate fully open = boost bleeds off, hard to hold target
      //  50% duty = normal control = reaches and holds target cleanly
      // 100% duty = wastegate fully closed = may overshoot target briefly
      // It does NOT scale the target itself — it affects spool authority.
      const wgAuthorityFactor = clamp(0.5 + (config.wastegateBaseDuty / 100) * 0.5, 0.5, 1.0);
      
      const effectiveTargetBoost = Math.min(
        gearTarget * rpmFactor * throttleFactor * loadFactor,
        config.boostCutPsi - 2 // stay 2 PSI below cut
      );
      
      // Turbo spool rate: bigger turbo = slower spool, but not absurdly slow.
      // A big turbo (200 PSI) on a built motor with anti-lag hits target
      // within 1-2 seconds of launch — it's not a glacier.
      // Log scale keeps small turbos snappy and big turbos reasonable.
      const turboLag = clamp(3.5 / (1 + Math.log(1 + gearTarget / 10)), 0.8, 3.5);
      const spoolRate = effectiveTargetBoost > boostPsi ? dt * turboLag * wgAuthorityFactor : dt * 6;
      boostPsi = lerp(boostPsi, effectiveTargetBoost, spoolRate);

      if (boostPsi >= config.boostCutPsi) {
        // Safety fuel cut: brief cut to bleed off a few PSI, then recover.
        // In a real ECU, boost cut closes the wastegate and cuts fuel for
        // one combustion cycle — just enough to drop boost below threshold.
        fuelCutActive = true;
        fuelCutFraction = 1.0;
        // Drop boost slightly below the cut point, not nuke toward 0
        boostPsi = config.boostCutPsi - 3;
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

    // ── Turbo despool during fuel cut ────────────────────────
    // When fuel is cut (rev limiter, boost cut, etc.), no combustion occurs
    // → no exhaust gas → no energy to drive the turbine. The turbo's
    // rotational inertia keeps it spinning briefly, but boost bleeds off.
    // Bigger turbos have more rotational inertia → slower despool.
    // A brief rev-limiter bounce (10-20ms) barely affects boost.
    // A sustained fuel cut (boost cut) drops it faster.
    if (config.turboEnabled && fuelCutFraction > 0.5 && boostPsi > 0) {
      // Bigger turbo (higher target) = heavier turbine wheel = more inertia
      const turboInertiaFactor = clamp(1.0 / (1 + config.boostTargetPsi / 50), 0.2, 1.0);
      const despoolRate = dt * 1.5 * turboInertiaFactor;
      boostPsi = lerp(boostPsi, boostPsi * 0.7, despoolRate * fuelCutFraction);
    }

    if (qmActive && qmET === null) {
      if (shiftTimer > 0) {
        shiftTimer -= dt;
        if (shiftTimer <= 0) {
          shiftTimer = 0;
          // Shift just completed — snap RPM to match wheel speed through NEW gear.
          // In a manual transmission: clutch in → gear change → clutch out.
          // Engine RPM must match wheel angular velocity × new gear ratio.
          // This naturally drops RPM on upshift (lower ratio = lower RPM for same wheel speed).
          gearRatio = config.gearRatios[clamp(currentGear, 0, config.gearRatios.length - 1)];
          totalRatio = gearRatio * config.finalDriveRatio;
          const postShiftWheelRadius = derived.tireRadiusM;
          const wheelAngVel = wheelSpeedMps / postShiftWheelRadius;
          const postShiftRpm = wheelAngVel * totalRatio * 60 / (2 * Math.PI);
          currentRpm = clamp(Math.max(postShiftRpm, config.targetIdleRpm), config.targetIdleRpm, config.fuelCutRpm);
        }
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
        
        // Two-step rev limiter: secondary rev limit for launch staging
        // Holds RPM at twoStepRpm while clutch is in, building boost on turbo cars
        if (config.twoStepEnabled && currentRpm > config.twoStepRpm) {
          // Hard cut at two-step RPM (bouncing limiter feel)
          fuelCutFraction = Math.max(fuelCutFraction, 0.8);
          timingRetardTotal += 15; // aggressive retard for backfire pops
          currentRpm = clamp(currentRpm, idleRpm, config.twoStepRpm + 100);
        }
        
        // Smoothly approach target RPM (engine not loaded)
        const rpmDelta = targetRevRpm - currentRpm;
        currentRpm = clamp(currentRpm + rpmDelta * dt * 8, idleRpm, fuelCutRpm);
        
        clutchStatus = "DISENGAGED";
        wheelForceN = 0;  // No power to wheels while clutch is in
        wheelTorqueFtLb = 0;
        
      } else {
        // ═══════════════════════════════════════════════════════════
        // LAUNCHED: Clutch is out, power goes to wheels
        // ═══════════════════════════════════════════════════════════
        //
        // Physics model:
        //   1. Compute engine torque at current RPM
        //   2. Brief clutch engagement phase (clutchSlipping = true)
        //      limits transmitted torque for first ~0.05-0.15s
        //   3. After clutch locks: full engine torque → wheel force
        //   4. Check wheel surface speed vs ground speed:
        //      - If wheel speed > ground speed → WHEELSPIN
        //        RPM via torque balance, car pushes forward via kinetic friction
        //      - If wheel speed ≈ ground speed → GRIP
        //        RPM = ground speed × gearing, full traction
        //   5. Shift decision
        //
        qmElapsedTime += dt;
        
        // ── Step 1: Engine torque at current RPM ─────────────────
        let torqueFtLb = getEngineTorque(currentRpm, throttle, config.compressionRatio, customTorqueMap, config.engineId);
        torqueFtLb *= getCylinderScaling(config.numCylinders, config.engineId);
        torqueFtLb *= getCamTorqueMultiplier(currentRpm, vtecActive, config);
        
        if (config.turboEnabled && boostPsi > 0) {
          torqueFtLb *= 1 + (boostPsi / 14.7) * 0.9;
        } else if (config.superchargerEnabled && boostPsi > 0) {
          torqueFtLb *= 1 + (boostPsi / 14.7) * 0.9;
          torqueFtLb -= scParasiticLoss;
        }
        if (config.nitrousEnabled) {
          const nosActive = currentRpm >= config.nitrousActivationRpm && (throttle >= 0.95 || !config.nitrousFullThrottleOnly);
          if (nosActive && currentRpm > 0) {
            nitrousActiveNow = true;
            torqueFtLb += config.nitrousHpAdder * 5252 / currentRpm;
          }
        }
        torqueFtLb *= chargePowerMult;
        torqueFtLb *= Math.max(0.3, 1 - timingRetardTotal / 60); // timing retard
        torqueFtLb *= (1 - fuelCutFraction); // fuel cut
        
        const engineTorqueNm = torqueFtLb * 1.3558;
        
        // ── Step 2: Clutch engagement ────────────────────────────
        // When the clutch is dumped (100% engagement), the disc face slams
        // into the flywheel and locks INSTANTLY — no progressive grab, no
        // smoothing curve, no slip phase. The pressure plate clamps the disc
        // to the flywheel face and ALL engine torque transfers directly
        // through the gearbox to the wheels. Period.
        //
        // For partial engagement (feathered clutch), there IS a progressive
        // grab phase where the disc slips against the flywheel.
        let transmittedTorqueNm = engineTorqueNm;
        
        if (clutchSlipping && !clutchFullyEngaged) {
          clutchLockupTimer += dt;
          const engagementPct = clamp(config.clutchEngagement, 0, 100);
          
          if (engagementPct >= 95) {
            // HARD DUMP: Instant lockup on the FIRST frame.
            // Clutch disc face slams against flywheel — mechanical bond.
            // No grab curve, no smoothing, no slip. This is a drag launch.
            clutchSlipping = false;
            clutchFullyEngaged = true;
            clutchSlipPct = 0;
            transmittedTorqueNm = engineTorqueNm; // 100% torque transfer
            
            // ── Clutch lockup: what happens to RPM? ──
            // It depends on whether the tires can hold the torque.
            //
            // CASE 1: Wheel force > tire grip (WHEELSPIN)
            //   The tires break loose immediately. The engine only feels
            //   kinetic friction reflected through the drivetrain — a fraction
            //   of the full vehicle inertia. Engine RPM stays HIGH because
            //   the load is small. Tires scream, car creeps forward.
            //   This is the 50psi-on-street-tires scenario.
            //
            // CASE 2: Wheel force ≤ tire grip (TRACTION)
            //   Tires hold. Engine couples rigidly to vehicle mass through
            //   gearing. Conservation of angular momentum: both engine and
            //   vehicle equilibrate to a common speed. Engine RPM drops
            //   significantly (bogs). This is the stock NA car scenario.
            
            // Compute what the wheel force WOULD be once the engine is under load.
            // For forced-induction cars, the turbo/supercharger will spool rapidly
            // once the clutch locks and the engine sees full load. Using ONLY the
            // current boost (which is near-zero from neutral) would incorrectly
            // predict the grip path and bog the engine to death before the turbo
            // can ever spool. Instead, estimate the POTENTIAL torque the engine
            // will produce within ~0.5s of being under full load.
            let potentialTorqueNm = engineTorqueNm;
            
            if (config.turboEnabled && config.boostTargetPsi > 0) {
              // Strip current (minimal) boost to get base NA torque
              const currentBoostMult = boostPsi > 0 ? (1 + (boostPsi / 14.7) * 0.9) : 1;
              const baseTorqueNm = engineTorqueNm / currentBoostMult;
              // Estimate ~60% of target boost available shortly after lockup
              // (big turbos spool slower, but even 60% of 50 PSI is massive)
              const potentialBoostPsi = config.boostTargetPsi * 0.6;
              const potentialBoostMult = 1 + (potentialBoostPsi / 14.7) * 0.9;
              potentialTorqueNm = baseTorqueNm * potentialBoostMult;
            } else if (config.superchargerEnabled && config.superchargerMaxBoostPsi > 0) {
              // Superchargers are mechanically driven — immediate boost at RPM
              const currentBoostMult = boostPsi > 0 ? (1 + (boostPsi / 14.7) * 0.9) : 1;
              const baseTorqueNm = engineTorqueNm / currentBoostMult;
              const potentialBoostMult = 1 + (config.superchargerMaxBoostPsi * 0.8 / 14.7) * 0.9;
              potentialTorqueNm = baseTorqueNm * potentialBoostMult;
            }
            if (config.nitrousEnabled && currentRpm >= config.nitrousActivationRpm) {
              potentialTorqueNm += config.nitrousHpAdder * 5252 / currentRpm * 1.3558;
            }
            
            const launchWheelForceN = (potentialTorqueNm * totalRatio * (1 - derived.drivetrainLoss)) / wheelRadius;
            
            // On a drag strip with equal surface, open diff sends equal torque
            // to both wheels. The effective traction threshold is similar for
            // all diff types. LSD/locked = slightly better grip under asymmetry.
            const launchTractionEffective = drivenDiffType === 'locked' ? maxTractionForceN
              : drivenDiffType === 'lsd' ? maxTractionForceN * 0.85
              : maxTractionForceN * 0.85; // open diff: both tires contribute on equal surface
            
            if (launchWheelForceN > launchTractionEffective) {
              // ═══ WHEELSPIN LAUNCH ═══
              // Tires can't hold. Engine stays at launch RPM.
              // Wheel speed set from engine RPM — tires spinning on pavement.
              // Step 4 wheelspin code will handle the torque balance from here.
              wheelSpeedMps = (currentRpm / totalRatio) * (2 * Math.PI * wheelRadius) / 60;
              // Car gets a small speed bump from the kinetic friction impulse
              // but engine RPM barely drops.
            } else {
              // ═══ GRIP LAUNCH ═══
              // Tires hold. Conservation of angular momentum determines
              // the equilibrium between engine inertia and vehicle inertia.
              const engineSideInertia = ENGINE_INERTIA_KGM2 + 0.03; // engine + flywheel + gears
              const vehicleInertiaAtCrank = derived.vehicleMassKg * wheelRadius * wheelRadius / (totalRatio * totalRatio);
              const totalSystemInertia = engineSideInertia + vehicleInertiaAtCrank;
              
              const engineOmegaRad = currentRpm * 2 * Math.PI / 60;
              const vehicleOmegaAtCrank = speedMps > 0.1
                ? (speedMps / wheelRadius) * totalRatio
                : 0;
              
              const combinedOmega = (engineSideInertia * engineOmegaRad + vehicleInertiaAtCrank * vehicleOmegaAtCrank) / totalSystemInertia;
              const equilibriumRpm = clamp(combinedOmega * 60 / (2 * Math.PI), idleRpm, fuelCutRpm);
              const equilibriumSpeedMps = (equilibriumRpm / totalRatio) * (2 * Math.PI * wheelRadius) / 60;
              
              currentRpm = equilibriumRpm;
              wheelSpeedMps = equilibriumSpeedMps;
              speedMps = Math.max(speedMps, equilibriumSpeedMps);
              // Sync prevSpeedMps so the weight transfer calculation later this
              // frame doesn't see a phantom 150+ m/s² acceleration from the
              // instantaneous speed jump (0 → equilibrium in one frame).
              prevSpeedMps = speedMps;
            }
          } else {
            // FEATHERED CLUTCH: Progressive engagement for partial clutch dumps.
            const engagementTime = Math.max(0.08, 1.5 * Math.pow(1 - engagementPct / 100, 2));
            const grabProgress = clamp(clutchLockupTimer / engagementTime, 0, 1);
            const grabCurve = grabProgress * grabProgress * (3 - 2 * grabProgress);
            
            const effectiveClutchNm = Math.max(config.clutchMaxTorqueNm, engineTorqueNm * 1.1);
            const clutchCapacityNm = effectiveClutchNm * grabCurve;
            transmittedTorqueNm = Math.min(engineTorqueNm, clutchCapacityNm);
            
            clutchSlipPct = engineTorqueNm > 0 && clutchCapacityNm < engineTorqueNm
              ? Math.round((1 - clutchCapacityNm / engineTorqueNm) * 1000) / 10 : 0;
            
            if (grabProgress >= 0.98) {
              clutchSlipping = false;
              clutchFullyEngaged = true;
              clutchSlipPct = 0;
              const wheelDrivenRpm = (wheelSpeedMps / wheelRadius) * (60 / (2 * Math.PI)) * totalRatio;
              currentRpm = clamp(Math.max(wheelDrivenRpm, idleRpm), idleRpm, fuelCutRpm);
            }
          }
        } else {
          // Clutch fully locked — disc is clamped to flywheel.
          // 100% of engine torque passes through. No capacity limit.
          // A locked clutch is a rigid mechanical connection.
          transmittedTorqueNm = engineTorqueNm;
          clutchSlipPct = 0;
        }
        
        // ── Step 3: Wheel force from transmitted torque ──────────
        const rawWheelForceN = (transmittedTorqueNm * totalRatio * (1 - derived.drivetrainLoss)) / wheelRadius;
        wheelTorqueFtLb = (transmittedTorqueNm / 1.3558) * totalRatio * (1 - derived.drivetrainLoss);
        _lastEngineTorqueNm = engineTorqueNm;
        _lastTransmittedTorqueNm = transmittedTorqueNm;
        _lastRawWheelForceN = rawWheelForceN;
        
        // ── Step 4: Wheelspin vs Grip ────────────────────────────
        // During shift (clutch disengaged): no drive force, wheels coast.
        // Otherwise, check if tires are spinning.
        if (shiftTimer > 0) {
          // SHIFTING: clutch is in, no power to wheels, engine unloaded
          wheelForceN = 0;
          wheelTorqueFtLb = 0;
          // Wheel speed decays toward ground speed via tire-road friction.
          // Undriven spinning wheels decelerate based on kinetic friction
          // and the wheel assembly's rotational inertia (tire + rim).
          // Much faster than rolling resistance — the tires are sliding,
          // so µ_kinetic × normalForce decelerates the spinning wheels.
          const shiftFrictionN = maxTractionForceN * 0.78 * diffWheelspinMult;
          const wheelEffMass = Math.max(derived.totalTireInertia / (wheelRadius * wheelRadius), 20);
          const wheelDecel = Math.min(shiftFrictionN / wheelEffMass, 40); // cap at 40 m/s²
          wheelSpeedMps = Math.max(wheelSpeedMps - wheelDecel * dt, speedMps);
          slipRatio = speedMps > 0.5 ? clamp((wheelSpeedMps - speedMps) / speedMps, 0, 3.0) : 0;
          clutchStatus = "SHIFTING";
          // Engine free-revs slightly down (no load, fuel cut during shift)
          currentRpm = clamp(currentRpm - 500 * dt, config.targetIdleRpm, config.fuelCutRpm);
        }

        const wheelSurfaceSpeedMps = (currentRpm / totalRatio) * (2 * Math.PI * wheelRadius) / 60;
        const groundSpeedMps = speedMps;
        const speedBasedWheelspin = wheelSurfaceSpeedMps > groundSpeedMps + 0.5; // >0.5 m/s difference
        const forceBasedWheelspin = rawWheelForceN > maxTractionForceN && throttle > 0.15;
        // CRITICAL: wheels must actually be spinning faster than the car is moving.
        // forceBasedWheelspin alone means the engine CAN break the tires loose,
        // but if wheel surface speed ≤ ground speed, the tires are hooked up
        // and we must use the GRIP path (RPM locked to ground speed).
        const wheelsActuallySpinning = wheelSurfaceSpeedMps > groundSpeedMps + 0.3;
        
        if (shiftTimer > 0) {
          // Already handled above — skip wheelspin/grip during shift
        } else if ((forceBasedWheelspin || speedBasedWheelspin) && wheelsActuallySpinning) {
          // ═══════════════════════════════════════════════════════
          // WHEELSPIN: tires spinning faster than car is moving
          // ═══════════════════════════════════════════════════════
          
          // Kinetic friction coefficient by compound
          const kineticRatio = config.tireCompound === 'drag_slick' ? 0.92
            : config.tireCompound === 'full_slick' ? 0.88
            : config.tireCompound === 'semi_slick' ? 0.85
            : config.tireCompound === 'sport' ? 0.82
            : 0.78; // street
          
          // Kinetic force: sliding friction from the spinning tire(s).
          // With open diff, only one tire spins → diffWheelspinMult ≈ 0.55.
          const kineticForceN = maxTractionForceN * kineticRatio * diffWheelspinMult;
          
          // Compute slip ratio for hookup model
          let currentSlipRatio: number;
          if (groundSpeedMps > 1.0) {
            currentSlipRatio = clamp((wheelSurfaceSpeedMps - groundSpeedMps) / groundSpeedMps, 0, 5.0);
          } else {
            currentSlipRatio = clamp((wheelSurfaceSpeedMps - groundSpeedMps) / 2.0, 0, 5.0);
          }
          
          // ── Unified hookup model ──────────────────────────────
          // As slip ratio decreases, the tire progressively transitions from
          // kinetic (sliding) to static (adhesion) friction — like a Pacejka
          // slip curve. The tire's grip force at the contact patch depends
          // ONLY on the tire/road interface (normal load × µ at current slip),
          // NOT on how much torque the engine is producing.
          //
          // This friction force simultaneously:
          //   1. Pushes the car forward (reaction force at contact patch)
          //   2. Brakes the wheel (resisting rotation)
          //
          // When friction > engine torque at wheel → wheel decelerates →
          // slip drops → hookup increases → convergence.
          //
          // The "extra" forward force (beyond what the engine pushes) comes
          // from the decelerating wheel/engine assembly's rotational KE.
          //
          // hookup at slip=0: 1.0 (full grip)
          // hookup at slip=0.5: 0.61
          // hookup at slip=1.0: 0.37
          // hookup at slip=2.0: 0.14
          // hookup at slip=5.0: 0.007 (pure slide)
          const hookupSmooth = Math.exp(-currentSlipRatio * 1.0);
          
          // Tire friction force: blends from kinetic toward FULL axle static grip
          // as tires hook up. This is the contact-patch force, independent of
          // engine output — it's what the road surface "pushes back" on the tire.
          const hookupForceN = lerp(kineticForceN, maxTractionForceN, hookupSmooth);
          
          // Forward force on the car from spinning tires:
          // When the engine IS producing torque (rawWheelForceN > 0):
          //   Cap at rawWheelForceN — the tire can't push harder than the
          //   engine drives it (prevents phantom acceleration).
          // When the engine is in FUEL CUT (rawWheelForceN ≈ 0):
          //   The spinning wheels still have angular momentum. The kinetic
          //   friction at the contact patch simultaneously:
          //     1. Pushes the car forward (hookupForceN)
          //     2. Decelerates the wheel (converting rotational KE to linear KE)
          //   This is real physics — the car doesn't lose ALL thrust during
          //   a momentary fuel cut at the rev limiter. The tires are still
          //   spinning and still have contact-patch friction.
          wheelForceN = rawWheelForceN > 0
            ? Math.min(hookupForceN, rawWheelForceN)
            : hookupForceN; // fuel cut: spinning wheels still push via kinetic friction
          
          // Engine load = tire friction force reflected back to the crankshaft.
          // The tire-road contact patch pushes back on the wheel with hookupForceN.
          // This is what resists wheel rotation — NOT the engine's own output.
          // With open diff at high slip: hookupForceN ≈ kineticForceN (very low)
          //   → engine sees almost no load → revs to redline instantly (correct!)
          // As tires hook up: hookupForceN → maxTractionForceN (high)
          //   → engine sees heavy load → RPM drops toward equilibrium
          // Using rawWheelForceN here was WRONG: it made engineLoad = engineTorque
          // (perfect cancellation), so net torque = 0 and RPM never changed.
          const engineLoadForceN = hookupForceN;
          
          // ── Engine RPM via torque balance ──────────────────────
          const roadLoadAtCrank = engineLoadForceN * wheelRadius / (totalRatio * (1 - derived.drivetrainLoss));
          const effectiveLoad = clutchSlipping
            ? Math.min(transmittedTorqueNm, roadLoadAtCrank)
            : roadLoadAtCrank;
          
          const netEngineTorqueNm = engineTorqueNm - effectiveLoad;
          const wheelInertiaAtCrank = derived.totalTireInertia / (totalRatio * totalRatio);
          const engineInertia = ENGINE_INERTIA_KGM2 + 0.03 + wheelInertiaAtCrank;
          const angularAccel = netEngineTorqueNm / engineInertia;
          const rpmChange = (angularAccel * 60) / (2 * Math.PI) * dt;
          currentRpm = clamp(currentRpm + rpmChange, idleRpm, fuelCutRpm);
          
          // Wheel speed from engine RPM (engine drives wheels through gearbox)
          wheelSpeedMps = (currentRpm / totalRatio) * (2 * Math.PI * wheelRadius) / 60;
          
          // Slip ratio
          if (groundSpeedMps > 0.5) {
            slipRatio = clamp((wheelSpeedMps - groundSpeedMps) / groundSpeedMps, 0.02, 3.0);
          } else {
            slipRatio = clamp(wheelSpeedMps / 2.0, 0.1, 3.0);
          }
          
          clutchStatus = slipRatio > 0.1 ? "SPINNING" : "ENGAGING";
          
        } else {
          // ═══════════════════════════════════════════════════════
          // GRIP: wheel speed ≈ ground speed, full traction
          // ═══════════════════════════════════════════════════════
          // Cap forward force at max traction — any excess will cause
          // wheelspin on the NEXT frame (entering SPINNING path).
          wheelForceN = Math.min(rawWheelForceN, maxTractionForceN);
          slipRatio = 0;
          wheelSpeedMps = groundSpeedMps;
          
          // RPM = ground speed × gearing (engine locked to wheels locked to ground)
          const wheelDrivenRpm = (groundSpeedMps / wheelRadius) * (60 / (2 * Math.PI)) * totalRatio;
          currentRpm = clamp(Math.max(wheelDrivenRpm, idleRpm), idleRpm, fuelCutRpm);
          clutchStatus = clutchSlipping ? "ENGAGING" : "ENGAGED";
        }
        
        // ── Step 5: Shift decision ───────────────────────────────
        if (shiftTimer > 0) {
          clutchStatus = "SHIFTING";
        }
        
        const minShiftSpeedMph = currentGear === 0 ? 5 : 3; // bare-minimum safety floor
        const currentSpeedForShift = speedMps * 2.237;
        // Block shifts during excessive wheelspin in FIRST GEAR ONLY.
        // At launch, upshifting during a massive burnout makes things worse.
        // In higher gears, the driver would shift normally even with moderate slip —
        // the tires recover quickly after the shift because the next gear's
        // torque multiplication is lower.
        const excessiveWheelspin = currentGear === 0 && slipRatio > 0.5;
        
        // ── Landed-RPM gate ─────────────────────────────────────
        // A skilled driver doesn't shift until the car has enough speed
        // that the RPM will land in the powerband of the next gear.
        // Compute where RPM would land in the next gear based on
        // ACTUAL VEHICLE SPEED (not wheel speed during wheelspin).
        let landedRpmOk = true;
        if (currentGear < config.gearRatios.length - 1) {
          const nextGearRatio = config.gearRatios[currentGear + 1];
          const nextTotalRatio = nextGearRatio * config.finalDriveRatio;
          // RPM = (groundSpeed / wheelRadius) × totalRatio × 60/(2π)
          const landedRpm = (speedMps / wheelRadius) * nextTotalRatio * 60 / (2 * Math.PI);
          // Find peak torque RPM for this engine
          const tMap = customTorqueMap || getEngineTorqueMap(config.engineId);
          let peakTorqueRpm = 5000;
          let peakTorque = 0;
          for (const [r, t] of tMap) {
            if (t > peakTorque) { peakTorque = t; peakTorqueRpm = r; }
          }
          // Must land at least at 50% of peak torque RPM.
          // This prevents shifting into a gear where RPM is too low to
          // make useful power, but allows shifts once the car has built
          // enough speed. A real driver won't sit at the limiter for 5+
          // seconds — they shift once RPM will land above mid-range.
          const minLandedRpm = peakTorqueRpm * 0.50;
          landedRpmOk = landedRpm >= minLandedRpm;
        }
        
        // canUpshift: base requirements for shifting (speed, clutch, landed RPM)
        // The landed-RPM gate is NON-NEGOTIABLE — a real driver would NEVER
        // shift if RPM would land below the powerband, regardless of how long
        // they've been bouncing off the limiter. They wait for speed.
        const canUpshift = currentSpeedForShift > minShiftSpeedMph && !clutchSlipping && landedRpmOk;
        // The first-gear wheelspin block can be overridden by the dwell timer
        // (after enough time, even a wheelspin shift is better than sitting).
        const canUpshiftNow = canUpshift && !excessiveWheelspin;
        
        let shouldShift = false;
        const gearRedline = config.gearRevLimits[clamp(currentGear, 0, config.gearRevLimits.length - 1)] || redline;

        if (config.customShiftPointsEnabled && currentGear < config.gearRatios.length - 1) {
          if (config.customShiftPointsMode === 'rpm') {
            shouldShift = currentRpm >= (config.customShiftPointsRpm[currentGear] ?? gearRedline);
          } else if (config.customShiftPointsMode === 'wheel_speed') {
            shouldShift = (wheelSpeedMps * 2.23694) >= (config.customShiftPointsWheelSpeedMph[currentGear] ?? 999);
          } else {
            shouldShift = (speedMps * 2.23694) >= (config.customShiftPointsMph[currentGear] ?? 999);
          }
        } else {
          const optimalRpm = cachedOptimalShiftPoints[currentGear] ?? gearRedline;
          shouldShift = currentRpm >= Math.min(optimalRpm, gearRedline) && currentGear < config.gearRatios.length - 1;
        }
        if (currentRpm >= gearRedline && currentGear < config.gearRatios.length - 1 && canUpshiftNow) {
          shouldShift = true;
        }

        // High-RPM dwell timer: tracks time spent bouncing off the limiter.
        // Used to override the first-gear wheelspin block after enough time,
        // but NEVER overrides the landed-RPM gate — that's physics, not preference.
        const dwellThresholdRpm = Math.min(
          cachedOptimalShiftPoints[currentGear] ?? gearRedline,
          gearRedline
        ) - 200; // 200 RPM below shift point
        if (currentRpm >= dwellThresholdRpm && shiftTimer <= 0 && currentGear < config.gearRatios.length - 1) {
          highRpmDwellTime += dt;
        } else {
          highRpmDwellTime = 0;
        }
        // After 1s at the limiter, override the first-gear wheelspin block
        // but ONLY if landed RPM is in the powerband (canUpshift includes it).
        if (highRpmDwellTime >= 1.0 && canUpshift && shiftTimer <= 0 && currentGear < config.gearRatios.length - 1) {
          shouldShift = true;
          log.debug('engineSim', `High-RPM dwell shift forced after ${highRpmDwellTime.toFixed(2)}s at ${Math.round(currentRpm)} RPM`, { gear: currentGear + 1 });
        }

        if (shouldShift && (canUpshiftNow || (highRpmDwellTime >= 1.0 && canUpshift)) && shiftTimer <= 0) {
          currentGear++;
          highRpmDwellTime = 0;
          if (config.flatFootShiftEnabled) {
            shiftTimer = (config.flatFootShiftCutTime || 80) / 1000;
          } else {
            shiftTimer = derived.shiftTimeS;
          }
          log.debug('engineSim', `Shift to gear ${currentGear + 1}`, { rpm: Math.round(currentRpm), speed: Math.round(speedMps * 2.237) });
        }
      }

      const prevAccelMps2 = dt > 0 && speedMps > 0.05 ? (speedMps - prevSpeedMps) / dt : 0;
      weightTransferN = (derived.vehicleMassKg * Math.max(prevAccelMps2, 0) * config.cgHeightM) / config.wheelbaseM;
      weightTransferN *= aiCorrections.weightTransferMultiplier;
      const staticFrontLoadN = derived.vehicleMassKg * GRAVITY * config.frontWeightBias;
      const staticRearLoadN = derived.vehicleMassKg * GRAVITY * (1 - config.frontWeightBias);

      // ── Aero downforce & lift (speed² dependent, active at ALL speeds) ──
      // F = 0.5 × ρ × C × A × v²
      const aeroQ = 0.5 * airDensity * config.frontalAreaM2 * speedMps * speedMps; // dynamic pressure × area

      // Body lift — positive = upward force that reduces normal load
      // Typical sedan: CL ≈ 0.20-0.35, Honda Civic EK ≈ 0.29
      const bodyLiftCl = config.bodyLiftCoefficient ?? 0.29;
      aeroLiftN = aeroQ * bodyLiftCl;

      // Downforce from aero parts (configured coefficients + contributions from extended aero parts)
      // Each aero part adds to the total downforce coefficient
      let totalDownforceCl = (config.downforceCoefficientFront ?? 0) + (config.downforceCoefficientRear ?? 0);

      // Extended aero part contributions (realistic Cl increments):
      // Rear wing: Cl depends on type and angle of attack
      if (config.rearWingEnabled || (config.rearWingType && config.rearWingType !== 'none')) {
        const wingAngle = config.rearWingAngleDeg ?? 5;
        const wingBase = config.rearWingType === 'gt_wing' ? 0.22
          : config.rearWingType === 'swan_neck' ? 0.25
          : config.rearWingType === 'duckbill' ? 0.08
          : config.rearWingType === 'lip' ? 0.04
          : 0.12; // generic
        // More angle = more downforce (diminishing above ~15°, stalling above ~25°)
        const angleEff = wingAngle <= 15 ? wingAngle / 10
          : wingAngle <= 25 ? 1.5 - (wingAngle - 15) * 0.03
          : Math.max(0.3, 1.2 - (wingAngle - 15) * 0.04);
        totalDownforceCl += wingBase * angleEff;
      }
      // Front splitter
      if (config.frontSplitterEnabled) {
        const splitterCl = config.frontSplitterMaterialType === 'carbon' ? 0.10
          : config.frontSplitterMaterialType === 'aluminum' ? 0.09
          : 0.07; // ABS
        totalDownforceCl += splitterCl;
      }
      // Rear diffuser
      if (config.rearDiffuserEnabled) {
        const diffAngle = config.rearDiffuserAngleDeg ?? 12;
        // Optimal diffuser angle ~7-12°; too steep = flow separation
        const diffEff = diffAngle <= 12 ? diffAngle / 12 : Math.max(0.4, 1.0 - (diffAngle - 12) * 0.04);
        totalDownforceCl += 0.15 * diffEff;
      }
      // Canards
      if (config.canardEnabled) {
        const canardAngle = config.canardAngleDeg ?? 10;
        totalDownforceCl += 0.04 * Math.min(canardAngle / 10, 1.5);
      }
      // Flat undertray (reduces turbulence, enables ground effect)
      if (config.flatUndertrayEnabled) {
        totalDownforceCl += 0.08;
        // Also reduces body lift by ~30%
        aeroLiftN *= 0.70;
      }
      // Side skirts help seal underbody air
      if (config.sideSkirtType === 'aero') {
        totalDownforceCl += 0.03;
        aeroLiftN *= 0.90;
      }

      const totalDownforceN = aeroQ * totalDownforceCl;
      // Split downforce front/rear using aeroBalancePct (0=full front, 100=full rear)
      const aeroBalance = (config.aeroBalancePct ?? 45) / 100; // default 45% front
      aeroDownforceFrontN = totalDownforceN * (1 - aeroBalance);
      aeroDownforceRearN = totalDownforceN * aeroBalance;

      // Lift splits roughly 40% front / 60% rear on a sedan body
      const liftFrontN = aeroLiftN * 0.40;
      const liftRearN = aeroLiftN * 0.60;

      // Weight transfer: under acceleration, load shifts to rear
      // Aero: downforce adds to load, lift subtracts from load
      frontAxleLoadN = staticFrontLoadN - weightTransferN + aeroDownforceFrontN - liftFrontN;
      rearAxleLoadN = staticRearLoadN + weightTransferN + aeroDownforceRearN - liftRearN;
      // Clamp to prevent negative axle loads (car would lift off ground)
      frontAxleLoadN = Math.max(frontAxleLoadN, 0);
      rearAxleLoadN = Math.max(rearAxleLoadN, 0);
      // Driven axle load for traction calculation
      if (isFWD) {
        // FWD loses some traction under acceleration (weight lifts off front)
        drivenAxleLoadN = Math.max(frontAxleLoadN, derived.vehicleMassKg * GRAVITY * 0.35);
      } else if (isRWD) {
        // RWD gains traction under acceleration (weight pushes rear down)
        drivenAxleLoadN = rearAxleLoadN;
      } else {
        // AWD: total vehicle weight available for traction (split between axles)
        drivenAxleLoadN = frontAxleLoadN + rearAxleLoadN;
      }

      effectiveGrip = getTireGripAtTemp(compound, tireTemp, config.tireGripPct, config.tireTempSensitivity) * coldTractionPenalty * hotSurfaceGripMult;
      patchMultiplier = getContactPatchMultiplier(config.tireWidthMm, config.tireAspectRatio, drivenAxleLoadN);
      finalGrip = effectiveGrip * patchMultiplier;
      maxTractionForceN = drivenAxleLoadN * finalGrip * aiCorrections.gripMultiplier;

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
          drivenAxleLoadN,
          tempEfficiency,
          speedMps
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
              drivenAxleLoadN,
              tempEfficiency,
              speedMps
            );
            slipRatio = updatedTractionCheck.slipRatio;
          }

          // Cap wheel force at traction limit — excess force causes wheelspin,
          // it doesn't create free acceleration. Wheel speed for visual.
          wheelForceN = Math.min(wheelForceN, maxTractionForceN);
          wheelSpeedMps = speedMps * (1 + slipRatio);
        }
      }

      dragForceN = 0.5 * airDensity * config.dragCoefficient * config.frontalAreaM2 * speedMps * speedMps * aiCorrections.dragMultiplier;
      rollingForceN = config.rollingResistanceCoeff * derived.vehicleMassKg * GRAVITY;

      netForceN = wheelForceN - dragForceN - rollingForceN;
      const accelMps2 = netForceN / derived.effectiveMassKg;

      prevSpeedMps = speedMps;
      speedMps = Math.max(speedMps + accelMps2 * dt, 0);

      // ── QM race telemetry (every ~0.1s) ──────────────────────
      if (qmLaunched && qmET === null) {
        // Log at ~10Hz (every 100ms) plus first 5 frames for launch detail
        const frameNum = Math.round(qmElapsedTime / dt);
        if (frameNum <= 5 || Math.round(qmElapsedTime * 10) !== Math.round((qmElapsedTime - dt) * 10)) {
          console.log(`[QM ${qmElapsedTime.toFixed(3)}s] RPM=${Math.round(currentRpm)} gear=${currentGear + 1} mph=${(speedMps * 2.237).toFixed(1)} ft=${distanceFt.toFixed(1)} wheelF=${Math.round(wheelForceN)}N netF=${Math.round(netForceN)}N accel=${accelMps2.toFixed(2)}m/s² slip=${(slipRatio * 100).toFixed(1)}% clutch=${clutchSlipping ? 'SLIP' : clutchFullyEngaged ? 'LOCKED' : 'OPEN'} status=${clutchStatus} fuelCut=${fuelCutFraction.toFixed(2)}`);
        }
        // ── Capture EVERY frame for diagnostics ──
        runTelemetry.push({
          t: +qmElapsedTime.toFixed(4),
          rpm: Math.round(currentRpm),
          gear: currentGear + 1,
          mph: +(speedMps * 2.237).toFixed(2),
          ft: +distanceFt.toFixed(2),
          wheelF: Math.round(wheelForceN),
          rawWheelF: Math.round(_lastRawWheelForceN),
          maxTractionF: Math.round(maxTractionForceN),
          netF: Math.round(netForceN),
          accel: +accelMps2.toFixed(3),
          slip: +(slipRatio * 100).toFixed(2),
          clutchSlip: clutchSlipping,
          clutchLocked: clutchFullyEngaged,
          status: clutchStatus,
          engineTorqueNm: +_lastEngineTorqueNm.toFixed(1),
          transmittedNm: +_lastTransmittedTorqueNm.toFixed(1),
          fuelCut: +fuelCutFraction.toFixed(3),
          tireTemp: +tireTemp.toFixed(1),
          grip: +finalGrip.toFixed(4),
          frontLoadLbs: +(frontAxleLoadN * 0.2248).toFixed(1),
          rearLoadLbs: +(rearAxleLoadN * 0.2248).toFixed(1),
          drivenLoadLbs: +(drivenAxleLoadN * 0.2248).toFixed(1),
          weightTransferLbs: +(weightTransferN * 0.2248).toFixed(1),
          wheelSpeedMph: +(wheelSpeedMps * 2.237).toFixed(2),
          dragF: Math.round(dragForceN),
          boostPsi: +boostPsi.toFixed(2),
          dt: +dt.toFixed(5),
          throttle: +throttle.toFixed(3),
        });
      }

      // Speed limiter via progressive fuel cut (like a real ECU)
      // Disabled during quarter mile runs (drag strip, no street speed limit)
      if (!qmLaunched) {
        const speedLimitMps = config.speedLimiterMph / 2.237;
        const speedLimitOnsetMps = (config.speedLimiterMph - 5) / 2.237;
        if (speedMps > speedLimitOnsetMps) {
          const limitProgress = clamp((speedMps - speedLimitOnsetMps) / (speedLimitMps - speedLimitOnsetMps), 0, 1);
          // Progressive braking force — simulates fuel cut + aero drag at limit
          const limitForce = limitProgress * derived.vehicleMassKg * 3.0; // strong decel
          speedMps = Math.max(speedMps - (limitForce / derived.effectiveMassKg) * dt, 0);
          if (limitProgress > 0.5) fuelCutActive = true;
        }
        // Hard backstop — never exceed limiter
        if (speedMps > speedLimitMps) speedMps = speedLimitMps;
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

      // Tire temperature model — heat from slip friction and mechanical deformation.
      // Street tires on a stock Civic should gain ~20-40°F in a quarter mile,
      // NOT overheat. Previous coefficients (200, 5) were ~15x too aggressive,
      // causing grip to plummet from 0.88→0.63 in 5 seconds.
      const slipHeat = Math.abs(slipRatio) * dt * 15 * compound.heatRate;
      const forceHeat = (wheelForceN * N_TO_LBS / 5000) * dt * 0.5 * compound.heatRate;
      // Hot track surface heats tires faster (conduction from pavement)
      const surfaceHeat = trackSurfaceTempF > tireTemp ? (trackSurfaceTempF - tireTemp) * 0.002 * dt : 0;
      tireTemp += slipHeat + forceHeat + surfaceHeat;
      // Tire cools toward track surface temp (not ambient — tire sits on hot pavement)
      const tireCoolTarget = Math.max(trackSurfaceTempF * 0.7, config.ambientTempF);
      tireTemp = lerp(tireTemp, tireCoolTarget, dt * 0.01 * compound.coolRate);
      tireTemp = clamp(tireTemp, config.ambientTempF, 400);

      if (topSpeedMode) {
        // TOP SPEED MODE — no distance limit, detect terminal velocity
        // Record speed samples every ~0.5s for terminal velocity detection
        const sampleInterval = 0.5; // seconds
        const sampleIndex = Math.floor(qmElapsedTime / sampleInterval);
        if (sampleIndex >= topSpeedSamples.length && qmElapsedTime > 2) {
          topSpeedSamples.push(currentSpeedMph);
        }
        // Terminal velocity: last 6 samples (3 seconds) differ by < 0.5 mph
        if (!topSpeedReached && topSpeedSamples.length >= 6) {
          const recent = topSpeedSamples.slice(-6);
          const maxRecent = Math.max(...recent);
          const minRecent = Math.min(...recent);
          if (maxRecent - minRecent < 0.5 && currentSpeedMph > 10) {
            topSpeedReached = true;
            topSpeedMph = Math.round(currentSpeedMph * 10) / 10;
            trapSpeed = topSpeedMph;
            qmET = qmElapsedTime;
            log.info('engineSim', 'Top speed REACHED', {
              topSpeed: topSpeedMph?.toFixed(1),
              elapsed: qmElapsedTime.toFixed(1),
              distanceMi: (distanceFt / 5280).toFixed(2),
              peakHp: peakWheelHp.toFixed(1),
            });
          }
        }
      } else if (distanceFt >= QUARTER_MILE_FT) {
        const overshootFt = distanceFt - QUARTER_MILE_FT;
        const overshootTime = avgSpeedMps > 0 ? (overshootFt * 0.3048) / avgSpeedMps : 0;
        qmET = qmElapsedTime - overshootTime;
        trapSpeed = currentSpeedMph;
        distanceFt = QUARTER_MILE_FT;
        log.info('engineSim', 'Quarter mile FINISHED', {
          et: qmET?.toFixed(3),
          trapMph: trapSpeed?.toFixed(1),
          peakHp: peakWheelHp.toFixed(1),
          peakRpm: Math.round(peakRpm),
          sixtyFt: sixtyFootTime?.toFixed(3),
        });
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
      rearAxleLoadN = derived.vehicleMassKg * GRAVITY * (1 - config.frontWeightBias);
      drivenAxleLoadN = isFWD ? frontAxleLoadN : isRWD ? rearAxleLoadN : (frontAxleLoadN + rearAxleLoadN);
      effectiveGrip = getTireGripAtTemp(compound, tireTemp, config.tireGripPct, config.tireTempSensitivity) * coldTractionPenalty * hotSurfaceGripMult;
      patchMultiplier = getContactPatchMultiplier(config.tireWidthMm, config.tireAspectRatio, drivenAxleLoadN);
      finalGrip = effectiveGrip * patchMultiplier;
      maxTractionForceN = drivenAxleLoadN * finalGrip * aiCorrections.gripMultiplier;

      let freeRevTorque = getEngineTorque(currentRpm, throttle, config.compressionRatio, customTorqueMap, config.engineId);
      freeRevTorque *= getCylinderScaling(config.numCylinders, config.engineId);
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

      // Fuel type & intake air charge correction
      freeRevTorque *= chargePowerMult;

      const freeRevTimingFactor = Math.max(0.3, 1 - timingRetardTotal / 60);
      freeRevTorque *= freeRevTimingFactor;
      const freeRevFuelFactor = 1 - fuelCutFraction;
      freeRevTorque *= freeRevFuelFactor;

      let engineTorqueNmFree = freeRevTorque * 1.3558;
      // Clutch torque capacity — auto-scale to handle engine output
      const effectiveClutchNmFree = Math.max(config.clutchMaxTorqueNm, engineTorqueNmFree * 1.1);
      if (engineTorqueNmFree > effectiveClutchNmFree) {
        const cSlip = 1 - effectiveClutchNmFree / engineTorqueNmFree;
        clutchSlipPct = Math.max(clutchSlipPct, Math.round(cSlip * 1000) / 10);
        engineTorqueNmFree = effectiveClutchNmFree;
      }
      wheelForceN = (engineTorqueNmFree * totalRatio * (1 - derived.drivetrainLoss)) / wheelRadius;
      wheelTorqueFtLb = (engineTorqueNmFree / 1.3558) * totalRatio * (1 - derived.drivetrainLoss);

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
        drivenAxleLoadN,
        freeRevTempEfficiency,
        speedMps
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
            drivenAxleLoadN,
            freeRevTempEfficiency,
            speedMps
          );
          slipRatio = updatedFreeRevCheck.slipRatio;
        }

        const slipHeat = slipRatio * dt * 12 * compound.heatRate;
        tireTemp += slipHeat;
      } else {
        slipRatio = freeRevTractionCheck.slipRatio; // Even when not breaking loose, use Pacejka slip
      }

      const freeRevCoolTarget = Math.max(trackSurfaceTempF * 0.7, config.ambientTempF);
      tireTemp = lerp(tireTemp, freeRevCoolTarget, dt * 0.01 * compound.coolRate);
      tireTemp = clamp(tireTemp, config.ambientTempF, 400);
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

    let torque = getEngineTorque(currentRpm, throttle, config.compressionRatio, customTorqueMap, config.engineId);
    torque *= getCylinderScaling(config.numCylinders, config.engineId);
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

    // Apply fuel/IAT charge correction to display torque too
    torque *= chargePowerMult;

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
    // Antilag / two-step: unburnt fuel igniting in exhaust manifold causes extreme EGT
    const isAntilagFiring = config.turboEnabled && config.antiLagEnabled && clutchIn && throttle > 0.3 && currentRpm > 2500;
    const isTwoStepFiring = config.turboEnabled && config.twoStepEnabled && clutchIn && currentRpm >= config.twoStepRpm * 0.9;
    if (isAntilagFiring || isTwoStepFiring) {
      // Antilag exhaust flames: 200-400°F extra EGT from combustion in manifold
      egtExtra = 300 + Math.random() * 100;
    } else if (config.turboEnabled && config.antiLagEnabled && throttle < 0.2 && currentRpm > 3000) {
      // Off-throttle antilag (mild pops and bangs)
      egtExtra = 100 + Math.random() * 80;
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
      if (slipRatio > 0.03) {
        // WHEELSPIN! Tire spins faster than vehicle ground speed.
        // Tire RPM = engine RPM / total gear ratio (engine drives wheels through gearbox)
        // This is the ACTUAL wheel surface speed, which is faster than ground speed.
        tireRpm = engineDrivenWheelRpm;
        
        // Ensure tire RPM is at least the ground-speed RPM (can't spin slower than road)
        tireRpm = Math.max(tireRpm, groundSpeedRpm);
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

    // ── Knock detection: accounts for compression ratio, fuel octane, and RPM ──
    // Higher compression requires higher octane fuel to avoid detonation.
    // Methanol (~105 octane equiv) and E85 (~105) are nearly knock-proof.
    // Gasoline octane must be sufficient for the compression ratio.
    {
      const octaneBase = config.fuelType === 'gasoline' ? config.gasolineOctane
        : config.fuelType === 'e85' ? 105
        : config.fuelType === 'methanol' ? 108
        : Math.max(config.gasolineOctane, 90 + config.ethanolContentPct * 0.15); // flex

      // Required octane rises with compression ratio. Stock 10.2:1 needs ~91 octane.
      // Every 1.0 CR above stock needs ~3 more octane points.
      const requiredOctane = 91 + (config.compressionRatio - STOCK_COMPRESSION_RATIO) * 3;

      // Knock probability: only if fuel octane is insufficient for the CR
      const octaneDeficit = requiredOctane - octaneBase; // positive = knock-prone
      if (currentRpm > 4000 && throttle > 0.6 && octaneDeficit > 0) {
        // Knock chance scales with deficit: 1 octane short = mild, 5+ = severe
        const knockChance = (config.knockSensitivity / 10) * 0.003 * Math.pow(octaneDeficit, 1.5);
        if (Math.random() < knockChance) {
          knockCount++;
          currentKnockRetard += config.knockRetardDeg;
        }
      }
      // With sufficient octane (methanol, E85, high-octane gas): zero knock
    }

    const closedLoopStatus = (config.closedLoopEnabled && throttle < 0.7 && currentRpm < redline * 0.8) ? 'CLOSED' : 'OPEN';

    const speedKmh = speedMph * 1.60934;
    const distanceMeters = distanceFt * 0.3048;

    const currentGearDisplay = currentGear + 1;
    const currentGearRatio = gearRatio;
    const driveshaftRpm = gearRatio > 0 ? currentRpm / gearRatio : 0;

    // Update rear axle load for display (already computed in QM path, recalc for non-QM)
    if (!qmActive) {
      rearAxleLoadN = derived.vehicleMassKg * GRAVITY - frontAxleLoadN;
    }

    const tireSlipPercent = Math.abs(slipRatio) * 100;

    if (fuelCutFraction > 0) {
      fuelCutActive = true;
    }

    // ── CRITICAL: NaN/Infinity sanitization ──
    // Prevents NaN/Infinity from corrupting state. No artificial gameplay caps.
    function sanitize(v: number, fallback: number): number {
      if (!Number.isFinite(v)) return fallback;
      return v;
    }
    currentRpm = sanitize(currentRpm, idleRpm);
    speedMps = sanitize(speedMps, 0);
    boostPsi = sanitize(boostPsi, 0);
    tireTemp = sanitize(tireTemp, 100);
    coolantTemp = sanitize(coolantTemp, 185);
    oilTemp = sanitize(oilTemp, 210);
    crankAngle = sanitize(crankAngle, 0);
    distanceFt = sanitize(distanceFt, 0);

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
      clutchSlipPct: clutchSlipPct,
      tireRpm: Math.round(tireRpm),
      wheelSpeedMph: Math.round(tireRpm * derived.tireCircumferenceFt * 60 / 5280 * 10) / 10,
      speedMph: Math.round(speedMph * 10) / 10,
      distanceFt: Math.round(distanceFt * 10) / 10,
      elapsedTime: Math.round(qmElapsedTime * 1000) / 1000,
      accelerationG: Math.round(clamp(accelG, 0, 5) * 100) / 100,
      quarterMileET: qmET !== null ? Math.round(qmET * 1000) / 1000 : null,
      quarterMileActive: qmActive,
      quarterMileLaunched: qmLaunched,
      clutchIn: clutchIn,

      topSpeedMode: topSpeedMode,
      topSpeedReached: topSpeedReached,
      topSpeedMph: topSpeedMph,
      topSpeedDistanceMi: Math.round(distanceFt / 5280 * 100) / 100,

      currentGearDisplay,
      currentGearRatio: Math.round(currentGearRatio * 1000) / 1000,
      driveshaftRpm: Math.round(driveshaftRpm),
      clutchStatus: clutchSlipPct > 1 ? 'SLIPPING' : clutchStatus,
      wheelTorque: Math.round(wheelTorqueFtLb * 10) / 10,
      wheelForce: Math.round(wheelForceN * N_TO_LBS * 10) / 10,

      frontAxleLoad: Math.round(frontAxleLoadN * N_TO_LBS * 10) / 10,
      rearAxleLoad: Math.round(rearAxleLoadN * N_TO_LBS * 10) / 10,
      weightTransfer: qmActive ? Math.round(weightTransferN * N_TO_LBS * 10) / 10 : 0,
      tireSlipPercent: Math.round(tireSlipPercent * 10) / 10,
      tractionLimit: Math.round(maxTractionForceN * N_TO_LBS * 10) / 10,
      tireTemp: Math.round(tireTemp * 10) / 10,
      contactPatchArea: Math.round(getContactPatchArea(config.tireWidthMm, config.tireAspectRatio, drivenAxleLoadN) * 10) / 10,
      tireTempOptimal: tireTemp >= compound.optimalTempLow && tireTemp <= compound.optimalTempHigh,
      // Effective grip as percentage: finalGrip / stock_baseline × 100
      // Stock street tire at optimal temp = 100%. Compound changes, temp, surface, patch all affect this.
      effectiveGripPct: Math.round(finalGrip / 0.88 * 100 * 10) / 10,

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
      aeroDownforceFrontLb: Math.round(aeroDownforceFrontN * N_TO_LBS * 10) / 10,
      aeroDownforceRearLb: Math.round(aeroDownforceRearN * N_TO_LBS * 10) / 10,
      aeroLiftLb: Math.round(aeroLiftN * N_TO_LBS * 10) / 10,

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

      // Fuel / weather / drivetrain readouts
      fuelType: config.fuelType,
      iatF: Math.round(iatData.iatF),
      airDensity: Math.round(airDensity * 1000) / 1000,
      densityCorrection: Math.round(iatData.densityCorrection * 1000) / 1000,
      drivetrainType: config.drivetrainType,
      frontDiffType: config.frontDiffType,
      rearDiffType: config.rearDiffType,
    };
  }

  function setAiCorrections(c: { gripMultiplier: number; weightTransferMultiplier: number; slipMultiplier: number; dragMultiplier: number; tractionMultiplier: number }) { aiCorrections = c; }
  function getAiCorrections() { return aiCorrections; }
  function setCustomTorqueMap(map: [number, number][] | null) {
    customTorqueMap = map;
    cachedOptimalShiftPoints = computeOptimalShiftPoints(
      config.gearRatios, config.redlineRpm, config.engineId, customTorqueMap, config.compressionRatio
    );
  }
  function getCustomTorqueMap(): [number, number][] | null { return customTorqueMap ? customTorqueMap.map(([r, t]) => [r, t]) : null; }

  // ══════════════════════════════════════════════════════════════════
  // DYNO MODE METHODS
  // ══════════════════════════════════════════════════════════════════

  function setDynoMode(enabled: boolean) {
    dynoMode = enabled;
    if (!enabled) {
      dynoPullActive = false;
      dynoPullProgress = 0;
      dynoCurrentRun = [];
      dynoAbsorberTorqueNm = 0;
    }
    // In dyno mode, engine idles on the dyno — no vehicle motion
    if (enabled) {
      speedMps = 0;
      distanceFt = 0;
      wheelSpeedMps = 0;
      qmActive = false;
      qmLaunched = false;
      topSpeedMode = false;
      clutchIn = true;
      currentGear = 0;
    }
  }

  function isDynoMode(): boolean { return dynoMode; }

  function startDynoPull(pullConfig: DynoPullConfig) {
    dynoPullConfig = pullConfig;
    dynoPullActive = true;
    dynoPullProgress = 0;
    dynoPullElapsed = 0;
    dynoCurrentRun = [];
    dynoSampleTimer = 0;
    dynoStepIndex = 0;
    dynoStepHoldTimer = 0;
    dynoAbsorberTorqueNm = 0;

    // Set initial RPM target
    if (pullConfig.programType === 'steady_state') {
      dynoRpmTarget = pullConfig.holdRpm ?? pullConfig.startRpm;
    } else {
      dynoRpmTarget = pullConfig.startRpm;
    }

    // Pre-condition engine RPM near start
    currentRpm = Math.max(currentRpm, pullConfig.startRpm * 0.8);

    // Set throttle
    throttle = pullConfig.throttlePct / 100;
    targetRpm = config.redlineRpm; // let absorber control RPM
  }

  function abortDynoPull() {
    dynoPullActive = false;
    throttle = 0;
    targetRpm = config.targetIdleRpm;
  }

  function freeDynoRev(throttleValue: number) {
    if (!dynoMode) return;
    throttle = clamp(throttleValue, 0, 1);
    targetRpm = config.targetIdleRpm + throttle * (config.redlineRpm - config.targetIdleRpm);
  }

  /** Called each frame when dynoMode + dynoPullActive — updates RPM target, samples data, detects completion */
  function updateDynoPull(dt: number, engineTorqueNm: number, engineHp: number) {
    if (!dynoPullActive) return;
    dynoPullElapsed += dt;
    dynoSampleTimer += dt;

    const cfg = dynoPullConfig;

    // Advance RPM target based on program type
    if (cfg.programType === 'wot_sweep' || cfg.programType === 'part_throttle') {
      dynoRpmTarget = cfg.startRpm + dynoPullElapsed * cfg.sweepRateRpmPerSec;
      dynoPullProgress = clamp((dynoRpmTarget - cfg.startRpm) / (cfg.endRpm - cfg.startRpm), 0, 1);
    } else if (cfg.programType === 'steady_state') {
      dynoRpmTarget = cfg.holdRpm ?? cfg.startRpm;
      dynoPullProgress = clamp(dynoPullElapsed / 10, 0, 1); // 10s steady state pull
    } else if (cfg.programType === 'step_test') {
      const stepSize = cfg.stepSizeRpm ?? 500;
      const holdTime = cfg.stepHoldTimeSec ?? 3;
      const nSteps = Math.ceil((cfg.endRpm - cfg.startRpm) / stepSize) + 1;
      dynoStepHoldTimer += dt;
      if (dynoStepHoldTimer >= holdTime && dynoStepIndex < nSteps - 1) {
        dynoStepIndex++;
        dynoStepHoldTimer = 0;
      }
      dynoRpmTarget = cfg.startRpm + dynoStepIndex * stepSize;
      dynoPullProgress = clamp(dynoStepIndex / (nSteps - 1), 0, 1);
    }

    // Absorber torque: PD controller to hold engine at dynoRpmTarget
    const rpmError = currentRpm - dynoRpmTarget;
    const omega = currentRpm * Math.PI / 30;
    dynoAbsorberTorqueNm = clamp(rpmError * DYNO_ABSORBER_GAIN * 0.1, -200, engineTorqueNm * 1.5);

    // Sample data every ~25ms (40 Hz)
    if (dynoSampleTimer >= 0.025) {
      dynoSampleTimer = 0;
      const airDensity = getAirDensity(config.ambientTempF, config.humidityPct, config.altitudeFt);
      const iatCorr = getIATCorrection(config.ambientTempF, boostPsi, config.intercoolerEnabled, config.intercoolerEfficiencyPct);
      const point: DynoDataPoint = {
        rpm: Math.round(currentRpm),
        torqueNm: Math.round(engineTorqueNm * 10) / 10,
        torqueFtLb: Math.round(engineTorqueNm * 0.7376 * 10) / 10,
        hp: Math.round(engineHp * 10) / 10,
        boostPsi: Math.round(boostPsi * 10) / 10,
        afrActual: Math.round((config.targetAfrWot + (Math.random() - 0.5) * 0.3) * 10) / 10,
        egtF: Math.round(900 + (currentRpm / config.redlineRpm) * 600 + boostPsi * 15),
        iatF: Math.round(iatCorr.iatF),
        timingDeg: Math.round(config.baseTimingDeg + (config.maxAdvanceDeg - config.baseTimingDeg) * clamp(currentRpm / config.redlineRpm, 0, 1) - currentKnockRetard),
        vePct: Math.round(85 + throttle * 15 * clamp(currentRpm / (config.redlineRpm * 0.7), 0.5, 1.1)),
        injDutyPct: Math.round(clamp((currentRpm / config.redlineRpm) * throttle * 85, 5, 98)),
        oilTempF: Math.round(oilTemp),
        coolantTempF: Math.round(coolantTemp),
        throttlePct: Math.round(throttle * 100),
        timestamp: dynoPullElapsed,
      };
      dynoCurrentRun.push(point);
    }

    // Completion check
    if (cfg.programType === 'wot_sweep' || cfg.programType === 'part_throttle') {
      if (dynoRpmTarget >= cfg.endRpm) {
        finalizeDynoPull();
      }
    } else if (cfg.programType === 'steady_state') {
      if (dynoPullElapsed >= 10) {
        finalizeDynoPull();
      }
    } else if (cfg.programType === 'step_test') {
      const stepSize = cfg.stepSizeRpm ?? 500;
      const holdTime = cfg.stepHoldTimeSec ?? 3;
      const nSteps = Math.ceil((cfg.endRpm - cfg.startRpm) / stepSize) + 1;
      if (dynoStepIndex >= nSteps - 1 && dynoStepHoldTimer >= holdTime) {
        finalizeDynoPull();
      }
    }
  }

  function finalizeDynoPull() {
    dynoPullActive = false;
    throttle = 0;
    targetRpm = config.targetIdleRpm;

    if (dynoCurrentRun.length === 0) return;

    // SAE J1349 correction factor (simplified: altitude + temperature)
    let corrFactor = 1.0;
    if (dynoPullConfig.saeCorrectionEnabled) {
      const altCorr = 1 + config.altitudeFt * 0.00003; // ~3% per 1000ft
      const tempCorr = (config.ambientTempF + 459.67) / (77 + 459.67); // Rankine ratio vs 77°F reference
      corrFactor = altCorr * Math.sqrt(tempCorr);
    }

    // Find peaks
    let peakHp = 0, peakHpRpm = 0, peakTq = 0, peakTqFtLb = 0, peakTqRpm = 0;
    for (const pt of dynoCurrentRun) {
      const corrHp = pt.hp * corrFactor;
      const corrTq = pt.torqueNm * corrFactor;
      if (corrHp > peakHp) { peakHp = corrHp; peakHpRpm = pt.rpm; }
      if (corrTq > peakTq) { peakTq = corrTq; peakTqFtLb = pt.torqueFtLb * corrFactor; peakTqRpm = pt.rpm; }
    }

    const run: DynoRun = {
      id: `dyno_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `Pull ${dynoRunHistory.length + 1}`,
      timestamp: Date.now(),
      startRpm: dynoPullConfig.startRpm,
      endRpm: dynoPullConfig.endRpm,
      peakHp: Math.round(peakHp * 10) / 10,
      peakHpRpm: peakHpRpm,
      peakTorqueNm: Math.round(peakTq * 10) / 10,
      peakTorqueFtLb: Math.round(peakTqFtLb * 10) / 10,
      peakTorqueRpm: peakTqRpm,
      points: dynoCurrentRun.map(p => ({
        ...p,
        hp: Math.round(p.hp * corrFactor * 10) / 10,
        torqueNm: Math.round(p.torqueNm * corrFactor * 10) / 10,
        torqueFtLb: Math.round(p.torqueFtLb * corrFactor * 10) / 10,
      })),
      programType: dynoPullConfig.programType,
      correctionFactor: Math.round(corrFactor * 10000) / 10000,
    };

    dynoRunHistory.push(run);
    dynoCurrentRun = [];
  }

  function getDynoState() {
    return {
      dynoMode,
      dynoPullActive,
      dynoPullProgress,
      dynoRpmTarget: Math.round(dynoRpmTarget),
      dynoAbsorberTorqueNm: Math.round(dynoAbsorberTorqueNm),
      dynoRunCount: dynoRunHistory.length,
      dynoCurrentRunPoints: dynoCurrentRun.length,
    };
  }

  function getDynoRunHistory(): DynoRun[] { return dynoRunHistory; }
  function clearDynoRunHistory() { dynoRunHistory = []; }
  function deleteDynoRun(id: string) { dynoRunHistory = dynoRunHistory.filter(r => r.id !== id); }

  return {
    update, setThrottle,
    startQuarterMile, launchCar, resetQuarterMile,
    startTopSpeedRun, resetTopSpeedRun,
    isRunning: () => running,
    setEcuConfig, getEcuConfig,
    setAiCorrections, getAiCorrections,
    setCustomTorqueMap, getCustomTorqueMap,
    getRunTelemetry: () => runTelemetry,
    clearRunTelemetry: () => { runTelemetry = []; },
    // Dyno mode
    setDynoMode, isDynoMode,
    startDynoPull, abortDynoPull, freeDynoRev,
    getDynoState, getDynoRunHistory, clearDynoRunHistory, deleteDynoRun,
  };
}
