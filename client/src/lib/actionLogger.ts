// ═══════════════════════════════════════════════════════════════════════════
// ACTION LOGGER — Full telemetry capture for sim analysis & troubleshooting
// ═══════════════════════════════════════════════════════════════════════════
// Captures EVERYTHING needed to analyze and validate racing times:
//   • Full vehicle config snapshots on every change / preset load
//   • Complete sim telemetry every 100ms during active runs
//   • All gauge readings (RPM, boost, HP, TQ, AFR, temps, pressures)
//   • Split times as they happen (60ft, 330ft, 660ft, 1000ft, 1320ft)
//   • Gear shift events with full state
//   • Peak values at finish (peak HP, peak boost, peak G, peak slip)
//   • Tire data (temp, slip %, traction limit, contact patch)
//   • Drivetrain data (wheel force, wheel torque, clutch status/slip)
//   • Aero/drag forces, rolling resistance, net force
//   • VTEC, launch control, traction control, fuel cut, knock status
//
// Logs are batched and sent to the server every 3s, persisted as JSON.
// Agent queries /api/action-logs/* to review and troubleshoot.
// ═══════════════════════════════════════════════════════════════════════════

import { log } from '../../../shared/logger';
import { type EngineState } from './engineSim';

// ── Types ──────────────────────────────────────────────────────────────

export type ActionLogType =
  | 'config_change'      // User changed an ECU/vehicle config value
  | 'button_press'       // User pressed a button (launch, clutch in/out, etc.)
  | 'preset_load'        // User loaded a preset
  | 'qm_start'           // Quarter mile run started (includes full config)
  | 'qm_split'           // Quarter mile split time with full state
  | 'qm_finish'          // Quarter mile run completed with time slip + peaks
  | 'top_speed_result'   // Top speed run completed
  | 'sim_snapshot'       // Periodic full telemetry capture during runs
  | 'shift'              // Gear shift event with full state
  | 'page_nav'           // Page navigation
  | 'error'              // Error occurred
  | 'session_start'      // Session began
  | 'session_config';    // Full config snapshot

/** Complete telemetry snapshot — mirrors every useful field from EngineState */
export interface SimSnapshot {
  // ── Engine ──
  rpm: number;
  throttle: number;
  hp: number;
  torqueFtLb: number;
  boostPsi: number;
  afr: number;
  ignitionTiming: number;
  volumetricEfficiency: number;
  engineLoad: number;

  // ── Drivetrain ──
  gear: number;
  gearRatio: number;
  driveshaftRpm: number;
  clutchStatus: string;
  clutchSlipPct: number;
  wheelTorqueFtLb: number;
  wheelForceN: number;

  // ── Vehicle dynamics ──
  speedMph: number;
  speedKmh: number;
  distanceFt: number;
  distanceMeters: number;
  elapsedTime: number;
  accelerationG: number;
  wheelSpeedMph: number;
  tireRpm: number;

  // ── Tires / Traction ──
  tireSlipPct: number;
  tractionLimitN: number;
  tireTemp: number;
  tireTempOptimal: boolean;
  contactPatchArea: number;
  frontAxleLoadN: number;
  rearAxleLoadN: number;
  weightTransferN: number;

  // ── Aero / Resistance ──
  dragForceN: number;
  rollingResistanceN: number;
  netForceN: number;

  // ── Temperatures / pressures / sensors ──
  coolantTemp: number;
  oilTemp: number;
  oilPressure: number;
  egt: number;
  iat: number;
  fuelPressure: number;
  intakeVacuum: number;
  batteryVoltage: number;

  // ── ECU status flags ──
  vtecActive: boolean;
  launchControlActive: boolean;
  tractionControlActive: boolean;
  fuelCutActive: boolean;
  revLimitActive: boolean;
  knockRetardDeg: number;
  fanOn: boolean;
  nitrousActive: boolean;

  // ── Splits available so far ──
  sixtyFtTime: number | null;
  threeThirtyTime: number | null;
  eighthMileTime: number | null;
  thousandFtTime: number | null;

  // ── Peaks so far ──
  peakRpm: number;
  peakHp: number;
  peakBoostPsi: number;
  peakAccelG: number;
  peakSpeedMph: number;
  peakSlipPct: number;
}

export interface ActionLogEntry {
  id: string;
  timestamp: number;
  isoTime: string;
  sessionId: string;
  type: ActionLogType;
  event: string;
  data: Record<string, unknown>;
  simState?: Partial<SimSnapshot>;
}

// ── Session management ─────────────────────────────────────────────────

let sessionId: string = generateSessionId();
const logBuffer: ActionLogEntry[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let entryCounter = 0;
let lastSnapshotTime = 0;
const SNAPSHOT_INTERVAL_MS = 100;    // Telemetry every 100ms during active runs (~10/s)
const FLUSH_INTERVAL_MS = 1500;      // Send logs to server every 1.5s (was 3s — faster for race data)
const MAX_BUFFER_SIZE = 400;         // Flush if buffer gets this large (was 800)

// ── Shift & split detection state ──────────────────────────────────────
let lastGear = 0;
let lastSixtyFt: number | null = null;
let lastThreeThirty: number | null = null;
let lastEighthMile: number | null = null;
let lastThousandFt: number | null = null;

function generateSessionId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  return `${date}_${time}_${rand}`;
}

function makeId(): string {
  entryCounter++;
  return `${sessionId}_${entryCounter}`;
}

// ── Core logging function ──────────────────────────────────────────────

function logAction(
  type: ActionLogType,
  event: string,
  data: Record<string, unknown> = {},
  simState?: Partial<SimSnapshot>
): void {
  const entry: ActionLogEntry = {
    id: makeId(),
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
    sessionId,
    type,
    event,
    data,
    simState,
  };

  logBuffer.push(entry);
  log.debug('actionLog', `[${type}] ${event}`, data);

  // Auto-flush if buffer is large
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    flushLogs();
  }
}

// ── Flush logs to server ───────────────────────────────────────────────

async function flushLogs(): Promise<void> {
  if (logBuffer.length === 0) return;

  const batch = logBuffer.splice(0, logBuffer.length);

  try {
    const res = await fetch('/api/action-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logs: batch }),
    });

    if (!res.ok) {
      logBuffer.unshift(...batch);
      log.warn('actionLog', `Failed to flush ${batch.length} entries: ${res.status}`);
    }
  } catch (err) {
    logBuffer.unshift(...batch);
    log.warn('actionLog', 'Flush failed (network)', { error: String(err) });
  }
}

/**
 * Synchronous flush using sendBeacon — works during page unload / tab close.
 * Falls back to async flush if sendBeacon is not available.
 */
function flushLogsSync(): void {
  if (logBuffer.length === 0) return;
  const batch = logBuffer.splice(0, logBuffer.length);
  const payload = JSON.stringify({ logs: batch });
  if (typeof navigator.sendBeacon === 'function') {
    const sent = navigator.sendBeacon('/api/action-logs', new Blob([payload], { type: 'application/json' }));
    if (!sent) {
      logBuffer.unshift(...batch);
    }
  } else {
    // Fallback: push back and do async flush (may not complete on unload)
    logBuffer.unshift(...batch);
    flushLogs();
  }
}

/** Flush immediately — call after critical race events */
function flushNow(): void {
  flushLogs();
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Build full telemetry snapshot from EngineState
// ═══════════════════════════════════════════════════════════════════════

function r2(v: number | null | undefined): number { return Math.round((v ?? 0) * 100) / 100; }
function r4(v: number | null | undefined): number { return Math.round((v ?? 0) * 10000) / 10000; }

export function snapshotFromState(s: EngineState): SimSnapshot {
  return {
    rpm:                  Math.round(s.rpm),
    throttle:             r2(s.throttlePosition),
    hp:                   r2(s.horsepower),
    torqueFtLb:           r2(s.torque),
    boostPsi:             r2(s.boostPsi),
    afr:                  r2(s.airFuelRatio),
    ignitionTiming:       r2(s.ignitionTiming),
    volumetricEfficiency: r2(s.volumetricEfficiency),
    engineLoad:           r2(s.engineLoad),

    gear:                 s.currentGearDisplay,
    gearRatio:            r4(s.currentGearRatio),
    driveshaftRpm:        Math.round(s.driveshaftRpm),
    clutchStatus:         s.clutchStatus || '',
    clutchSlipPct:        r2(s.clutchSlipPct),
    wheelTorqueFtLb:      r2(s.wheelTorque),
    wheelForceN:          r2(s.wheelForce),

    speedMph:             r2(s.speedMph),
    speedKmh:             r2(s.speedKmh),
    distanceFt:           r2(s.distanceFt),
    distanceMeters:       r2(s.distanceMeters),
    elapsedTime:          r4(s.elapsedTime),
    accelerationG:        r4(s.accelerationG),
    wheelSpeedMph:        r2(s.wheelSpeedMph),
    tireRpm:              Math.round(s.tireRpm),

    tireSlipPct:          r2(s.tireSlipPercent),
    tractionLimitN:       r2(s.tractionLimit),
    tireTemp:             r2(s.tireTemp),
    tireTempOptimal:      s.tireTempOptimal,
    contactPatchArea:     r2(s.contactPatchArea),
    frontAxleLoadN:       r2(s.frontAxleLoad),
    rearAxleLoadN:        r2(s.rearAxleLoad),
    weightTransferN:      r2(s.weightTransfer),

    dragForceN:           r2(s.dragForce),
    rollingResistanceN:   r2(s.rollingResistance),
    netForceN:            r2(s.netForce),

    coolantTemp:          r2(s.coolantTemp),
    oilTemp:              r2(s.oilTemp),
    oilPressure:          r2(s.oilPressure),
    egt:                  r2(s.exhaustGasTemp),
    iat:                  r2(s.intakeAirTemp),
    fuelPressure:         r2(s.fuelPressure),
    intakeVacuum:         r2(s.intakeVacuum),
    batteryVoltage:       r2(s.batteryVoltage),

    vtecActive:              s.vtecActive,
    launchControlActive:     s.launchControlActive,
    tractionControlActive:   s.tractionControlActive,
    fuelCutActive:           s.fuelCutActive,
    revLimitActive:          s.revLimitActive,
    knockRetardDeg:          r2(s.knockRetardActive),
    fanOn:                   s.fanStatus,
    nitrousActive:           s.nitrousActive,

    sixtyFtTime:          s.sixtyFootTime,
    threeThirtyTime:      s.threeThirtyTime,
    eighthMileTime:       s.eighthMileTime,
    thousandFtTime:       s.thousandFootTime,

    peakRpm:              Math.round(s.peakRpm),
    peakHp:               r2(s.peakWheelHp),
    peakBoostPsi:         r2(s.peakBoostPsi),
    peakAccelG:           r4(s.peakAccelG),
    peakSpeedMph:         r2(s.peakSpeedMph),
    peakSlipPct:          r2(s.peakSlipPercent),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// START / STOP
// ═══════════════════════════════════════════════════════════════════════

export function startActionLogger(): void {
  sessionId = generateSessionId();
  entryCounter = 0;
  logBuffer.length = 0;
  lastGear = 0;
  lastSixtyFt = null;
  lastThreeThirty = null;
  lastEighthMile = null;
  lastThousandFt = null;

  if (flushTimer) clearInterval(flushTimer);
  flushTimer = setInterval(flushLogs, FLUSH_INTERVAL_MS);

  // ── Ensure logs are flushed on page unload / tab close / app backgrounding ──
  window.addEventListener('beforeunload', flushLogsSync);
  window.addEventListener('pagehide', flushLogsSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushLogsSync();
  });

  logAction('session_start', 'New session started', {
    userAgent: navigator.userAgent,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    touchSupport: 'ontouchstart' in window,
  });

  // Immediately flush session_start to server
  flushNow();

  log.info('actionLog', `Action logger started — session: ${sessionId}`);
}

export function stopActionLogger(): void {
  flushLogsSync();
  window.removeEventListener('beforeunload', flushLogsSync);
  window.removeEventListener('pagehide', flushLogsSync);
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API — specific event loggers
// ═══════════════════════════════════════════════════════════════════════

/** Log a config value change (slider, toggle, select) */
export function logConfigChange(
  field: string,
  oldValue: unknown,
  newValue: unknown,
  section?: string
): void {
  logAction('config_change', `${section ? section + '.' : ''}${field} changed`, {
    field,
    oldValue,
    newValue,
    ...(section && { section }),
  });
}

/** Log full config snapshot (preset load, session start, stage) */
export function logFullConfig(config: Record<string, unknown>, reason: string): void {
  logAction('session_config', reason, { config });
}

/** Log a button press */
export function logButtonPress(
  button: string,
  data?: Record<string, unknown>,
  simState?: Partial<SimSnapshot>
): void {
  logAction('button_press', button, data || {}, simState);
}

/** Log a preset being loaded */
export function logPresetLoad(presetName: string, config: Record<string, unknown>): void {
  logAction('preset_load', `Loaded preset: ${presetName}`, { presetName, config });
}

/** Log quarter-mile run start with FULL config */
export function logQMStart(
  config: Record<string, unknown>,
  simState?: Partial<SimSnapshot>
): void {
  logAction('qm_start', 'Quarter mile run started', { config }, simState);
  flushNow(); // Critical event — flush immediately
}

/** Log quarter-mile split time with FULL telemetry */
export function logQMSplit(
  distance: string,
  time: number,
  speedMph: number,
  simState?: SimSnapshot
): void {
  logAction('qm_split', `Split: ${distance}`, {
    distance,
    time: r4(time),
    speedMph: r2(speedMph),
  }, simState);
  flushNow(); // Critical event — flush immediately
}

/** Log quarter-mile finish — FULL TIME SLIP with all peaks and splits */
export function logQMFinish(state: EngineState, config: Record<string, unknown>): void {
  const snap = snapshotFromState(state);
  logAction('qm_finish', 'Quarter mile completed', {
    // ── Time Slip ──
    et:             r4(state.quarterMileET!),
    trapSpeedMph:   r2(state.trapSpeed || 0),
    sixtyFtTime:    r4(state.sixtyFootTime || 0),
    threeThirtyTime: r4(state.threeThirtyTime || 0),
    eighthMileTime: r4(state.eighthMileTime || 0),
    thousandFtTime: r4(state.thousandFootTime || 0),
    // ── Peak values ──
    peakRpm:        Math.round(state.peakRpm),
    peakWheelHp:    r2(state.peakWheelHp),
    peakAccelG:     r4(state.peakAccelG),
    peakBoostPsi:   r2(state.peakBoostPsi),
    peakSpeedMph:   r2(state.peakSpeedMph),
    peakSlipPct:    r2(state.peakSlipPercent),
    // ── Final state ──
    finalRpm:       Math.round(state.rpm),
    finalSpeedMph:  r2(state.speedMph),
    finalGear:      state.currentGearDisplay,
    finalBoostPsi:  r2(state.boostPsi),
    // ── Config used ──
    config,
  }, snap);
  flushNow(); // Critical event — flush immediately
}

/** Log top speed run result with full telemetry */
export function logTopSpeedResult(state: EngineState, config: Record<string, unknown>): void {
  const snap = snapshotFromState(state);
  logAction('top_speed_result', 'Top speed run completed', {
    topSpeedMph:    r2(state.topSpeedMph || state.speedMph),
    timeToTopSpeed: r4(state.elapsedTime || 0),
    distanceMi:     r4(state.topSpeedDistanceMi),
    peakHp:         r2(state.peakWheelHp),
    peakTorque:     r2(state.torque),
    peakBoostPsi:   r2(state.peakBoostPsi),
    peakRpm:        Math.round(state.peakRpm),
    finalGear:      state.currentGearDisplay,
    config,
  }, snap);
  flushNow(); // Critical event — flush immediately
}

/** Log a gear shift event during a run — auto-detected */
export function logShift(
  fromGear: number,
  toGear: number,
  simState: SimSnapshot
): void {
  logAction('shift', `Shift ${fromGear} → ${toGear}`, {
    fromGear,
    toGear,
    atRpm:      simState.rpm,
    atSpeedMph: simState.speedMph,
    atBoostPsi: simState.boostPsi,
    atHp:       simState.hp,
  }, simState);
}

/**
 * MAIN TICK LOGGER — call this every frame from the dashboard tick loop.
 * Handles: telemetry snapshots, shift detection, split detection.
 */
export function logTickTelemetry(state: EngineState): void {
  const isRunning = state.quarterMileActive && state.quarterMileLaunched && state.quarterMileET === null;
  const isTopSpeed = state.topSpeedMode && state.quarterMileLaunched && !state.topSpeedReached;

  if (!isRunning && !isTopSpeed) return;

  const snap = snapshotFromState(state);

  // ── Shift detection ──
  if (state.currentGearDisplay !== lastGear && lastGear !== 0) {
    logShift(lastGear, state.currentGearDisplay, snap);
  }
  lastGear = state.currentGearDisplay;

  // ── Split detection (QM mode) ──
  if (isRunning) {
    if (state.sixtyFootTime !== null && lastSixtyFt === null) {
      lastSixtyFt = state.sixtyFootTime;
      logQMSplit('60ft', state.sixtyFootTime, state.speedMph, snap);
    }
    if (state.threeThirtyTime !== null && lastThreeThirty === null) {
      lastThreeThirty = state.threeThirtyTime;
      logQMSplit('330ft', state.threeThirtyTime, state.speedMph, snap);
    }
    if (state.eighthMileTime !== null && lastEighthMile === null) {
      lastEighthMile = state.eighthMileTime;
      logQMSplit('660ft (1/8 mi)', state.eighthMileTime, state.speedMph, snap);
    }
    if (state.thousandFootTime !== null && lastThousandFt === null) {
      lastThousandFt = state.thousandFootTime;
      logQMSplit('1000ft', state.thousandFootTime, state.speedMph, snap);
    }
  }

  // ── Periodic full telemetry snapshot ──
  const now = Date.now();
  if (now - lastSnapshotTime >= SNAPSHOT_INTERVAL_MS) {
    lastSnapshotTime = now;
    logAction('sim_snapshot', isTopSpeed ? 'top_speed_run' : 'qm_run', {}, snap);
  }
}

/**
 * Reset split/shift tracking (call on stage or reset)
 */
export function resetRunTracking(): void {
  lastGear = 0;
  lastSixtyFt = null;
  lastThreeThirty = null;
  lastEighthMile = null;
  lastThousandFt = null;
}

/** Log page navigation */
export function logPageNav(page: string): void {
  logAction('page_nav', `Navigated to: ${page}`, { page });
}

/** Log an error event */
export function logError(context: string, error: unknown): void {
  logAction('error', context, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

/** Get the current session ID */
export function getSessionId(): string {
  return sessionId;
}
