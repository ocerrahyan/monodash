import React, { useRef, useMemo, useState, useCallback, useEffect, memo, Suspense, Component, ErrorInfo, ReactNode, createContext, useContext } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { log } from '@shared/logger';
import { useTheme, type ThemeColors } from '@/lib/theme';

// ── Module-level mutable props store ──────────────────────────────────
// This singleton is written to directly by the parent component every render.
// R3F scene children read from it in useFrame — zero React overhead.
// Because it's module-level, memo(() => true) on the component is irrelevant;
// the data always flows.
interface PropsStore {
  tireRpm: number;
  rpm: number;
  clutchStatus: string;
  clutchSlipPct: number;
  currentGear: number | string;
  currentGearRatio: number;
  slipPct: number;
  drivetrainType: string;
  accelerationG: number;
  throttle: number;
  engineId: string;
  engineName: string;
  redlineRpm: number;
  gearRatios: number[];
  finalDriveRatio: number;
  transmissionName: string;
  tireWidthMm: number;
  tireAspectRatio: number;
  wheelDiameterIn: number;
  speedMph: number;
  topSpeedMode: boolean;
  quarterMileLaunched: boolean;
  quarterMileActive: boolean;
  distanceFt: number;
}

// Module-level store — always mutable, always current
const _drivetrainStore: PropsStore = {
  tireRpm: 0, rpm: 800, clutchStatus: 'engaged', clutchSlipPct: 0,
  currentGear: 0, currentGearRatio: 0, slipPct: 0, drivetrainType: 'FWD',
  accelerationG: 0, throttle: 0, engineId: 'b16a2', engineName: 'B16A2',
  redlineRpm: 8200, gearRatios: [3.23, 2.105, 1.458, 1.107, 0.848],
  finalDriveRatio: 4.40, transmissionName: 'S4C', tireWidthMm: 195,
  tireAspectRatio: 55, wheelDiameterIn: 15,
  speedMph: 0, topSpeedMode: false, quarterMileLaunched: false,
  quarterMileActive: false, distanceFt: 0,
};

// Stable ref wrapper so existing context consumers still work
const _drivetrainStoreRef = { current: _drivetrainStore };
const PropsStoreCtx = createContext<React.MutableRefObject<PropsStore>>(_drivetrainStoreRef);

/**
 * Call this from the simulation tick loop (dashboard) to push live data
 * into the 3D view.  It writes directly to a module-level object so
 * memo(() => true) on the component is irrelevant — data always arrives.
 */
export function syncDrivetrainStore(p: DrivetrainView3DProps): void {
  const s = _drivetrainStore;
  s.tireRpm = p.tireRpm;
  s.rpm = p.rpm;
  s.clutchStatus = p.clutchStatus;
  s.clutchSlipPct = p.clutchSlipPct;
  s.currentGear = p.currentGear;
  s.currentGearRatio = p.currentGearRatio;
  s.slipPct = p.slipPct;
  s.drivetrainType = p.drivetrainType;
  s.accelerationG = p.accelerationG ?? 0;
  s.throttle = p.throttle ?? 0;
  s.engineId = p.engineId || 'b16a2';
  s.redlineRpm = p.redlineRpm ?? 8200;
  if (p.gearRatios) s.gearRatios = p.gearRatios;
  s.finalDriveRatio = p.finalDriveRatio ?? 4.40;
  s.tireWidthMm = p.tireWidthMm ?? 195;
  s.tireAspectRatio = p.tireAspectRatio ?? 55;
  s.wheelDiameterIn = p.wheelDiameterIn ?? 15;
  s.speedMph = p.speedMph ?? 0;
  s.topSpeedMode = p.topSpeedMode ?? false;
  s.quarterMileLaunched = p.quarterMileLaunched ?? false;
  s.quarterMileActive = p.quarterMileActive ?? false;
  s.distanceFt = p.distanceFt ?? 0;
}

// ── Engine geometry context (computed from active engine preset) ──────
const EngineGeometryCtx = createContext<React.MutableRefObject<EngineGeometry>>(null!);

// ── Animation refs context (shared rotation angles updated each frame) ────
interface AnimationRefs {
  fwRot: React.MutableRefObject<number>;     // flywheel/crankshaft rotation (radians)
  tireRot: React.MutableRefObject<number>;   // tire/wheel rotation (radians)
}
const AnimationRefsCtx = createContext<AnimationRefs>(null!);

// ── View mode context (written from UI, read by scene) ────────────────
interface ViewSettings {
  viewMode: ViewMode;
  selectedPart: string | null;
}
const ViewSettingsCtx = createContext<React.MutableRefObject<ViewSettings>>(null!);

// ── WebGL error boundary ─────────────────────────────────────────────
// Catches WebGL context creation failures so rest of dashboard survives
function WebGLErrorFallback({ error, height }: { error: Error; height: number }) {
  const t = useTheme();
  return (
    <div style={{
      width: '100%', height, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: t.cardBg, borderRadius: 12,
      border: `1px solid ${t.border}`, color: t.textMuted, fontFamily: 'monospace', fontSize: 12, gap: 8,
    }}>
      <span style={{ color: '#ff6b6b', fontSize: 14 }}>⚠ WebGL unavailable</span>
      <span>3D drivetrain view requires a browser with WebGL support.</span>
      <span style={{ opacity: 0.5 }}>{error.message}</span>
    </div>
  );
}

class WebGLErrorBoundary extends Component<{ children: ReactNode; height: number }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(err: Error, info: ErrorInfo) {
    log.error('DrivetrainView3D', 'WebGL error caught', { message: err.message, stack: info.componentStack });
  }
  render() {
    if (this.state.error) {
      return <WebGLErrorFallback error={this.state.error} height={this.props.height} />;
    }
    return this.props.children;
  }
}

function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════════════════
// REAL-WORLD DIMENSIONS  (Honda Civic EK / EM1 — B16A2 + S4C)
// All dimensions in scene-units where 1 unit = 10 mm
// ═══════════════════════════════════════════════════════════════════════════
const S = 0.01; // mm → scene-units  (195 mm → 1.95 units)

// 195/55R15 tire
const TIRE_SECTION_W   = 195 * S;                       // 1.95  (tread width)
const SIDEWALL_H       = 195 * 0.55 * S;                // 1.0725
const RIM_DIA          = 15 * 25.4 * S;                 // 3.81
const TIRE_OD          = RIM_DIA + 2 * SIDEWALL_H;      // 5.955
const TIRE_OR          = TIRE_OD / 2;                    // 2.9775
const RIM_R            = RIM_DIA / 2;                    // 1.905
const TIRE_TUBE_R      = SIDEWALL_H * 0.82;             // tube radius for torus
const TIRE_TORUS_R     = TIRE_OR - TIRE_TUBE_R;         // center-line radius

// CV axle — B16A2/S4C has unequal half-shafts:
// Driver (left) side: short ~530mm total length
// Passenger (right) side: long ~870mm (includes intermediate shaft ~340mm)
const AXLE_R           = 12.5 * S;   // 0.125 (shaft OD ~25mm / 2)
const DRIVER_AXLE_LEN  = 530 * S;    // 5.30  (driver side total)
const PASS_AXLE_LEN    = 870 * S;    // 8.70  (passenger side total with intermediate)
const CV_R             = 38 * S;     // 0.38  (outer CV joint OD ~76mm / 2)
const CV_LEN           = 76 * S;     // 0.76
const BOOT_LEN         = 80 * S;     // 0.80

// Transmission case (S4C 5-speed) — Honda B-series hydro
const TRANS_L          = 380 * S;    // 3.80  (case length bell housing to tail)
const TRANS_H          = 350 * S;    // 3.50  (case height)
const TRANS_D          = 370 * S;    // 3.70  (case width at diff housing)
const DIFF_R           = 92.5 * S;   // 0.925 (~185mm ring gear diameter / 2)

// Flywheel & clutch — B16A2 stock specs
const FW_R             = 135 * S;    // 1.35  (~270mm diameter / 2)
const FW_THICK         = 22 * S;     // 0.22  (stock flywheel ~22mm thick)
const CLUTCH_R         = 106 * S;    // 1.06  (212mm clutch disc / 2)
const CLUTCH_THICK     = 10 * S;     // 0.10  (clutch disc thickness)
const PP_THICK         = 14 * S;     // 0.14  pressure plate
const PP_R             = 115 * S;    // 1.15  (~230mm pressure plate OD / 2)

// Brake rotor — B16A2 EM1: 262mm front ventilated, 21mm thick
const ROTOR_R          = 131 * S;    // 1.31  (262mm / 2)
const ROTOR_THICK      = 21 * S;     // 0.21  (new rotor thickness)

// ── Hub / Knuckle (Honda Civic EK — McPherson front) ──
const HUB_OR           = 40 * S;      // 0.40  hub flange outer radius (~80 mm OD)
const HUB_W            = 50 * S;      // 0.50  hub flange width
const KNUCKLE_R        = 25 * S;      // 0.25  knuckle body approx. radius (~50 mm OD)
const KNUCKLE_H        = 220 * S;     // 2.20  knuckle height ball-joint → strut ear

// ── Spring / strut (McPherson front, Civic EK OEM) ──
const SPRING_OR        = 65 * S;      // 0.65  coil spring outer radius (~130 mm OD)
const SPRING_IR        = 48 * S;      // 0.48  coil spring inner radius (~96 mm ID)
const SPRING_H         = 280 * S;     // 2.80  installed compressed height
const STRUT_R          = 23 * S;      // 0.23  strut monotube radius (~46 mm OD)
const STRUT_H          = 350 * S;     // 3.50  strut tube visible length

// ── Lower control arm (stamped steel A-arm) ──
const LCA_LEN          = 350 * S;     // 3.50  pivot-to-ball-joint
const LCA_W            = 55 * S;      // 0.55  arm width (Z direction)
const LCA_THICK        = 12 * S;      // 0.12  arm thickness (Y direction)

// ── Front / rear layout geometry (Honda Civic EK) ──
const HALF_TRACK_F     = 740 * S;     // 7.40  front half-track (1 480 mm total)
const HALF_TRACK_R     = 730 * S;     // 7.30  rear  half-track (1 460 mm total)
const WHEEL_ET         = 45 * S;      // 0.45  wheel offset ET45 (hub face → wheel center)
const HUB_INBOARD_TO_CV = 40 * S;    // 0.40  hub bearing center → outer CV joint center
const INNER_CV_GAP     = 25 * S;      // 0.25  inner CV housing → trans output flange
const VISUAL_GAP       = 15 * S;      // 0.15  cosmetic separation between drivetrain parts

// ── B16A2 DOHC VTEC Engine Block ─────────────────────────────────────
// Honda B16A2: 1.6L inline-4, bore 81mm, stroke 77.4mm, 10.2:1 CR
const BORE             = 81 * S;         // 0.81  cylinder bore diameter
const STROKE           = 77.4 * S;       // 0.774 piston stroke
const BORE_SPACING     = 87 * S;         // 0.87  center-to-center bore spacing
const CON_ROD_L        = 134 * S;        // 1.34  connecting rod length (c-to-c)
const CRANK_THROW      = STROKE / 2;     // 0.387 crank throw radius
const PISTON_H         = 30 * S;         // 0.30  piston height
const BLOCK_L          = 450 * S;        // 4.50  block length along crankshaft (X)
const BLOCK_DECK_H     = 203.9 * S;     // 2.039 deck height (crank center → deck) — Honda FSM B16 block
const BLOCK_SUMP_H     = 95 * S;         // 0.95  below crank center to sump rail (oil pan depth ~95mm)
const BLOCK_D          = 200 * S;        // 2.00  block depth front-to-back (Z)
const HEAD_H           = 123 * S;        // 1.23  cylinder head height (gasket face → cam cap surface)
const VALVE_COVER_H    = 67 * S;         // 0.67  valve cover above head surface
const HEAD_TOTAL_H     = HEAD_H + VALVE_COVER_H; // 1.90 total head assembly height (head + cover)
const CRANK_MAIN_R     = 25 * S;         // 0.25  main journal radius
const CRANK_PIN_R      = 21 * S;         // 0.21  crank pin (rod journal) radius
const CW_R             = 55 * S;         // 0.55  counterweight outer radius
const CW_THICK         = 12 * S;         // 0.12  counterweight thickness
// Crank pin angular offsets (inline-4, 180° crank, firing order 1-3-4-2)
const CRANK_OFFSETS    = [0, Math.PI, Math.PI, 0]; // Cyl 1,2,3,4

// ── Valve dimensions (B16A2) ─────────────────────────────────────────
const INTAKE_VALVE_DIA = 33 * S;   // 0.33  intake valve head diameter
const EXHAUST_VALVE_DIA = 29 * S;  // 0.29  exhaust valve head diameter (28-29mm)
const VALVE_STEM_DIA   = 5.5 * S;  // 0.055  valve stem diameter
const VALVE_STEM_LEN   = 100 * S;  // 1.00  valve stem length
const VALVE_HEAD_THICK  = 2 * S;   // 0.02  valve head thickness
const VALVE_SPRING_OR  = 16 * S;   // 0.16  valve spring outer radius
const VALVE_SPRING_IR  = 12 * S;   // 0.12  valve spring inner radius
const VALVE_MAX_LIFT   = 10.6 * S; // 0.106  max valve lift (VTEC)
const VALVE_ANGLE      = 23 * (Math.PI / 180);  // 23° included angle / 2 for each bank
const INTAKE_VALVE_Z_OFFSET  = 0.20;  // intake valves toward front (z+)
const EXHAUST_VALVE_Z_OFFSET = -0.20; // exhaust valves toward rear (z-)

// Timing belt path constants
const CRANK_SPROCKET_R = 0.35;  // crank timing sprocket radius (as rendered)
const CAM_SPROCKET_R   = 0.55;  // cam timing sprocket radius (2:1 ratio → larger)
const TENSIONER_R      = 0.12;  // tensioner pulley radius

// Throttle butterfly
const TB_DIA           = 62 * S;   // 0.62  throttle body bore ~62mm

// ── Valve lift helper (inline — mirrors engineSim.ts) ────────────────
function getValveLift3D(crankAngleDeg: number, isIntake: boolean): number {
  const n = ((crankAngleDeg % 720) + 720) % 720;
  const maxLift = isIntake ? 10.6 : 9.4;
  if (isIntake) {
    if (n >= 350 || n < 190) {
      const pos = n >= 350 ? n - 350 : n + 10;
      const dist = Math.abs(pos - 100) / 100;
      return maxLift * Math.max(0, 1 - dist * dist);
    }
    return 0;
  } else {
    if (n >= 490 && n < 730) {
      const pos = n - 490;
      const dist = Math.abs(pos - 120) / 120;
      return maxLift * Math.max(0, 1 - dist * dist);
    }
    return 0;
  }
}

// ── Stroke phase helper ──────────────────────────────────────────────
function getStrokePhase3D(crankAngleDeg: number): number {
  // Returns 0=INTAKE, 1=COMPRESSION, 2=POWER, 3=EXHAUST
  const n = ((crankAngleDeg % 720) + 720) % 720;
  if (n < 180) return 0;
  if (n < 360) return 1;
  if (n < 540) return 2;
  return 3;
}

// ── Cylinder pressure helper (simplified) ────────────────────────────
function getCylPressure3D(crankAngleDeg: number, throttle: number): number {
  const n = ((crankAngleDeg % 720) + 720) % 720;
  const load = 0.3 + throttle * 0.007;
  if (n < 180) return 0.0;  // intake — low
  if (n < 360) return (n - 180) / 180 * 0.7 * load;  // compression 0→0.7
  if (n < 540) {
    const p = (n - 360) / 180;
    if (p < 0.05) return 1.0 * load;  // peak combustion
    return Math.max(0, 1.0 * load * Math.exp(-3 * p));  // expansion
  }
  return 0.05;  // exhaust
}

// View mode types
type ViewMode = 'normal' | 'xray' | 'cutaway' | 'exploded' | 'powerflow';

// ── Part spec database for info panel ────────────────────────────────
const PART_SPECS: Record<string, { name: string; specs: string[]; description: string }> = {
  'engine-block':    { name: 'B16A2 Engine Block', specs: ['81mm × 77.4mm bore × stroke', '1595cc displacement', 'Aluminum open-deck', '10.2:1 compression ratio'], description: 'DOHC VTEC inline-4 from the 1999-2000 Honda Civic Si (EM1). Redline 8200 RPM.' },
  'cylinder-head':   { name: 'B16A2 Cylinder Head', specs: ['DOHC 16-valve', '33mm intake / 29mm exhaust valves', 'VTEC engagement ~5800 RPM', 'Pentroof combustion chamber'], description: 'Crossflow head with roller rocker VTEC system switching between low and high cam profiles.' },
  'crankshaft':      { name: 'Forged Steel Crankshaft', specs: ['5 main bearings', '42mm main journal dia', '45mm rod journal dia', '180° flat-plane crank'], description: 'Firing order 1-3-4-2. Counterweighted for balance.' },
  'camshaft-intake': { name: 'Intake Camshaft', specs: ['Duration: 185°/240° (lo/hi)', 'Lift: 6.7mm/10.6mm', 'VTEC lobe switching', 'Roller rocker followers'], description: 'VTEC hi-cam profile activates above 5800 RPM for peak power.' },
  'camshaft-exhaust':{ name: 'Exhaust Camshaft', specs: ['Duration: 185°/225° (lo/hi)', 'Lift: 6.0mm/9.4mm', 'VTEC lobe switching', 'Roller rocker followers'], description: 'Exhaust cam optimized for efficient scavenging at high RPM.' },
  'piston':          { name: 'Cast Hypereutectic Piston', specs: ['81mm diameter', '30mm pin height', 'Dome-top (high CR)', '3 ring pack (2 comp + 1 oil)'], description: 'Lightweight piston for high-RPM operation.' },
  'con-rod':         { name: 'Forged Connecting Rod', specs: ['134mm center-to-center', 'I-beam profile', '20mm piston pin', '45mm big end bore'], description: 'Fracture-split forged steel rod for precise fitment.' },
  'flywheel':        { name: 'Clutch & Flywheel', specs: ['200mm friction disc', '5.9 kg flywheel mass', 'Dual-mass or solid', 'Ceramic or organic'], description: 'Connects engine output to S4C transmission input shaft.' },
  'transmission':    { name: 'S4C 5-Speed Manual', specs: ['Gear ratios: 3.23 / 2.11 / 1.58 / 1.19 / 0.93', 'Final drive: 4.40', 'Cable-shifted synchromesh', 'Helical LSD optional'], description: 'Close-ratio gearbox from the 99 Civic Si. Hydraulic clutch actuation.' },
  'cv-axle':         { name: 'CV Axle Assembly', specs: ['Outer: Rzeppa (6-ball)', 'Inner: Tripod (3-roller)', 'Circle clip retention', '27-spline hub end'], description: 'Constant-velocity joints allow power transfer through suspension articulation.' },
  'tire':            { name: '195/55R15 Tire', specs: ['195mm section width', '55% aspect ratio', '15″ rim diameter', '590mm overall diameter'], description: 'OEM tire size for 1999 Civic Si EM1. 2659 lb curb weight.' },
  'brake':           { name: 'Front Disc Brake', specs: ['262mm rotor diameter', 'Single-piston caliper', 'Semi-metallic pads', 'Vented rotor'], description: 'Factory front brakes. Upgradeable to larger rotors and multi-piston calipers.' },
  'intake-manifold': { name: 'Intake Manifold', specs: ['4 runners ~38-40mm ID', '300-320mm runner length', '2.5-3.0L plenum volume', 'Tuned for mid-high RPM'], description: 'Aluminum intake manifold with individual throttle response per cylinder.' },
  'exhaust-header':  { name: '4-2-1 Exhaust Header', specs: ['38mm primary tubes', '51-57mm collector', '4-into-2-into-1 merge', 'Stainless steel'], description: 'Long-tube 4-2-1 header for broad powerband. Tuned to scavenge exhaust pulses.' },
  'throttle-body':   { name: 'Throttle Body', specs: ['62mm bore diameter', 'Cable-actuated butterfly', 'TPS sensor', 'IAC motor'], description: 'Controls airflow into the intake manifold based on accelerator input.' },
  'timing-belt':     { name: 'Timing Belt System', specs: ['Round-tooth belt', '2:1 crank-to-cam ratio', 'Hydraulic tensioner', '60K mile service interval'], description: 'Synchronizes camshaft rotation to crankshaft. Interference engine — belt failure = valve contact.' },
};

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE PRESET LIBRARY — Famous engines with key specs (Trans4motor-style)
// ═══════════════════════════════════════════════════════════════════════════
export interface EnginePreset {
  id: string;
  name: string;
  shortName: string;       // abbreviation for button
  make: string;
  layout: 'I4' | 'I6' | 'V6' | 'V8' | 'V10' | 'V12' | 'F4' | 'F6' | 'W16' | 'I3' | 'R2';
  cylinders: number;
  displacement: number;    // cc
  bore: number;            // mm
  stroke: number;          // mm
  compression: number;     // :1
  valvetrain: string;
  maxHp: number;
  maxHpRpm: number;
  maxTq: number;           // lb-ft
  maxTqRpm: number;
  redline: number;
  forced: string;          // 'NA' | 'Turbo' | 'Twin-Turbo' | 'Supercharged'
  description: string;
}

export const ENGINE_PRESETS: EnginePreset[] = [
  {
    id: 'b16a2', name: 'Honda B16A2', shortName: 'B16A2', make: 'Honda',
    layout: 'I4', cylinders: 4, displacement: 1595, bore: 81, stroke: 77.4,
    compression: 10.2, valvetrain: 'DOHC 16V VTEC',
    maxHp: 160, maxHpRpm: 7600, maxTq: 111, maxTqRpm: 7000, redline: 8200,
    forced: 'NA', description: 'High-revving VTEC powerplant from the 1999-2000 Honda Civic Si (EM1).',
  },
  {
    id: '2jz-gte', name: 'Toyota 2JZ-GTE', shortName: '2JZ', make: 'Toyota',
    layout: 'I6', cylinders: 6, displacement: 2997, bore: 86, stroke: 86,
    compression: 8.5, valvetrain: 'DOHC 24V',
    maxHp: 320, maxHpRpm: 5600, maxTq: 315, maxTqRpm: 4000, redline: 6800,
    forced: 'Twin-Turbo', description: 'Legendary iron-block inline-6 from the MK4 Toyota Supra. Known for extreme tuning potential (1500+ HP).',
  },
  {
    id: 'rb26dett', name: 'Nissan RB26DETT', shortName: 'RB26', make: 'Nissan',
    layout: 'I6', cylinders: 6, displacement: 2568, bore: 86, stroke: 73.7,
    compression: 8.5, valvetrain: 'DOHC 24V',
    maxHp: 276, maxHpRpm: 6800, maxTq: 260, maxTqRpm: 4400, redline: 8000,
    forced: 'Twin-Turbo', description: 'Heart of the Nissan Skyline GT-R (R32/R33/R34). Individual throttle bodies, N1 block rated to 800+ HP.',
  },
  {
    id: 'ls3', name: 'GM LS3 6.2L', shortName: 'LS3', make: 'GM',
    layout: 'V8', cylinders: 8, displacement: 6162, bore: 103.25, stroke: 92,
    compression: 10.7, valvetrain: 'OHV 16V (pushrod)',
    maxHp: 430, maxHpRpm: 5900, maxTq: 424, maxTqRpm: 4600, redline: 6600,
    forced: 'NA', description: 'Aluminum small-block V8 from the C6 Corvette. Compact, lightweight, massive aftermarket support.',
  },
  {
    id: 'ej257', name: 'Subaru EJ257', shortName: 'EJ257', make: 'Subaru',
    layout: 'F4', cylinders: 4, displacement: 2457, bore: 99.5, stroke: 79,
    compression: 8.2, valvetrain: 'DOHC 16V',
    maxHp: 305, maxHpRpm: 6000, maxTq: 290, maxTqRpm: 4000, redline: 7000,
    forced: 'Turbo', description: 'Horizontally-opposed (boxer) turbo from the Subaru WRX STI. Distinctive rumble from unequal-length headers.',
  },
  {
    id: '4g63t', name: 'Mitsubishi 4G63T', shortName: '4G63T', make: 'Mitsubishi',
    layout: 'I4', cylinders: 4, displacement: 1997, bore: 85, stroke: 88,
    compression: 8.8, valvetrain: 'DOHC 16V',
    maxHp: 276, maxHpRpm: 6500, maxTq: 275, maxTqRpm: 3500, redline: 7500,
    forced: 'Turbo', description: 'Iron-block turbo-4 from the Lancer Evolution series. Proven platform for 600+ HP builds.',
  },
  {
    id: 'k20a', name: 'Honda K20A', shortName: 'K20A', make: 'Honda',
    layout: 'I4', cylinders: 4, displacement: 1998, bore: 86, stroke: 86,
    compression: 11.5, valvetrain: 'DOHC 16V i-VTEC',
    maxHp: 220, maxHpRpm: 8000, maxTq: 152, maxTqRpm: 6000, redline: 8600,
    forced: 'NA', description: 'Honda\'s masterpiece from the Civic Type R (EP3/FD2). Chain-driven, rev-happy, i-VTEC with VTC.',
  },
  {
    id: '13b-rew', name: 'Mazda 13B-REW', shortName: '13B', make: 'Mazda',
    layout: 'R2', cylinders: 2, displacement: 1308, bore: 0, stroke: 0,
    compression: 9.0, valvetrain: 'Rotary (twin-rotor)',
    maxHp: 255, maxHpRpm: 6500, maxTq: 217, maxTqRpm: 5000, redline: 8500,
    forced: 'Twin-Turbo', description: 'Sequential twin-turbo Wankel rotary from the RX-7 FD. Compact, smooth, and screams to redline.',
  },
  {
    id: 'sr20det', name: 'Nissan SR20DET', shortName: 'SR20', make: 'Nissan',
    layout: 'I4', cylinders: 4, displacement: 1998, bore: 86, stroke: 86,
    compression: 8.5, valvetrain: 'DOHC 16V',
    maxHp: 250, maxHpRpm: 6400, maxTq: 217, maxTqRpm: 4800, redline: 7500,
    forced: 'Turbo', description: 'Turbo 4-cylinder from the Nissan 200SX/Silvia S13/S14/S15. The drift king\'s engine of choice.',
  },
  {
    id: 'f20c', name: 'Honda F20C', shortName: 'F20C', make: 'Honda',
    layout: 'I4', cylinders: 4, displacement: 1997, bore: 87, stroke: 84,
    compression: 11.7, valvetrain: 'DOHC 16V VTEC',
    maxHp: 240, maxHpRpm: 8300, maxTq: 153, maxTqRpm: 7500, redline: 9000,
    forced: 'NA', description: 'Highest specific output NA production engine ever (120 HP/L) from the Honda S2000 AP1. 9000 RPM redline.',
  },
  {
    id: 'vr38dett', name: 'Nissan VR38DETT', shortName: 'VR38', make: 'Nissan',
    layout: 'V6', cylinders: 6, displacement: 3799, bore: 95.5, stroke: 88.4,
    compression: 9.0, valvetrain: 'DOHC 24V',
    maxHp: 565, maxHpRpm: 6800, maxTq: 467, maxTqRpm: 3300, redline: 7100,
    forced: 'Twin-Turbo', description: 'Hand-built V6 from the Nissan GT-R R35. Each engine assembled by one "Takumi" craftsman. Massive tuning headroom.',
  },
  {
    id: 'fa20', name: 'Toyota/Subaru FA20', shortName: 'FA20', make: 'Toyota/Subaru',
    layout: 'F4', cylinders: 4, displacement: 1998, bore: 86, stroke: 86,
    compression: 12.5, valvetrain: 'DOHC 16V D-4S',
    maxHp: 200, maxHpRpm: 7000, maxTq: 151, maxTqRpm: 6400, redline: 7400,
    forced: 'NA', description: 'Flat-4 from the Toyota 86 / Subaru BRZ. Low center of gravity, direct + port injection, 86mm square bore.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REAR DIFFERENTIAL PRESETS — Real-world rear end housings with specs
// ═══════════════════════════════════════════════════════════════════════════
export interface RearDiffPreset {
  id: string;
  name: string;
  shortName: string;
  make: string;
  widthMm: number;          // Housing width (flange to flange)
  ringGearDia: number;      // Ring gear diameter in inches
  splineCount: number;      // Axle spline count
  typicalRatios: number[];  // Common gear ratios available
  maxTorqueNm: number;      // Max torque capacity
  weightKg: number;         // Approximate weight
  description: string;
}

export const REAR_DIFF_PRESETS: RearDiffPreset[] = [
  {
    id: 'stock_fwd', name: 'Stock FWD (None)', shortName: 'FWD', make: 'N/A',
    widthMm: 0, ringGearDia: 0, splineCount: 0, typicalRatios: [],
    maxTorqueNm: 0, weightKg: 0,
    description: 'Front-wheel drive — no rear differential required.',
  },
  {
    id: 'ford_9in', name: 'Ford 9" Third Member', shortName: 'Ford 9"', make: 'Ford',
    widthMm: 1245, ringGearDia: 9.0, splineCount: 31,
    typicalRatios: [3.00, 3.25, 3.50, 3.70, 3.89, 4.10, 4.30, 4.56, 4.86],
    maxTorqueNm: 5500, weightKg: 68,
    description: 'Legendary removable carrier diff. 49" housing width. Bulletproof strength, easy ratio changes, massive aftermarket.',
  },
  {
    id: 'ford_9in_narrow', name: 'Ford 9" Narrowed', shortName: 'F9-N', make: 'Ford',
    widthMm: 1422, ringGearDia: 9.0, splineCount: 31,
    typicalRatios: [3.00, 3.25, 3.50, 3.70, 3.89, 4.10, 4.30, 4.56, 4.86],
    maxTorqueNm: 5500, weightKg: 63,
    description: 'Ford 9" narrowed to 56" housing width. Popular for import RWD swaps.',
  },
  {
    id: 'dana60', name: 'Dana 60', shortName: 'Dana60', make: 'Dana/Spicer',
    widthMm: 1626, ringGearDia: 9.75, splineCount: 35,
    typicalRatios: [3.54, 3.73, 4.10, 4.30, 4.56, 4.88, 5.13, 5.38],
    maxTorqueNm: 7500, weightKg: 91,
    description: 'Heavy-duty full-floating axle. 64" housing width. Used in 3/4 ton trucks, Jeeps, and high-power drag applications.',
  },
  {
    id: 'gm_12bolt', name: 'GM 12-Bolt', shortName: '12-Bolt', make: 'GM',
    widthMm: 1473, ringGearDia: 8.875, splineCount: 30,
    typicalRatios: [3.07, 3.31, 3.42, 3.55, 3.73, 4.10, 4.56, 4.88],
    maxTorqueNm: 4500, weightKg: 54,
    description: 'GM passenger car axle (Camaro, Chevelle). 58" housing width. Strong C-clip design, good ratio selection.',
  },
  {
    id: 'gm_10bolt', name: 'GM 10-Bolt (8.5")', shortName: '10-Bolt', make: 'GM',
    widthMm: 1473, ringGearDia: 8.5, splineCount: 28,
    typicalRatios: [3.08, 3.23, 3.42, 3.73, 4.10, 4.56],
    maxTorqueNm: 3500, weightKg: 45,
    description: 'Common GM axle from 82-02 Camaro/Firebird. 58" housing width. Fine for 400-500 HP street cars.',
  },
  {
    id: 'ford_88', name: 'Ford 8.8"', shortName: 'Ford8.8', make: 'Ford',
    widthMm: 1524, ringGearDia: 8.8, splineCount: 31,
    typicalRatios: [2.73, 3.08, 3.27, 3.55, 3.73, 4.10, 4.56],
    maxTorqueNm: 4000, weightKg: 55,
    description: 'Ford Mustang axle (79-04). 60" housing width. Great strength-to-weight, popular swap for imports.',
  },
  {
    id: 'toyota_v160', name: 'Toyota V160 (Supra)', shortName: 'V160', make: 'Toyota',
    widthMm: 1450, ringGearDia: 8.0, splineCount: 30,
    typicalRatios: [3.13, 3.27, 3.58, 4.08, 4.30],
    maxTorqueNm: 3800, weightKg: 42,
    description: 'JZA80 Supra Getrag diff. 57" housing width. Compact, relatively light, good for 500-600 HP.',
  },
  {
    id: 'nissan_r200', name: 'Nissan R200', shortName: 'R200', make: 'Nissan',
    widthMm: 1410, ringGearDia: 7.9, splineCount: 30,
    typicalRatios: [3.54, 3.69, 3.90, 4.08, 4.36, 4.63],
    maxTorqueNm: 3500, weightKg: 40,
    description: 'Nissan 300ZX/S-chassis/Skyline diff. 55.5" housing width. Common JDM swap, VLSD available.',
  },
  {
    id: 'bmw_m3_diff', name: 'BMW M3 (E46/E9x)', shortName: 'BMW-M', make: 'BMW',
    widthMm: 1460, ringGearDia: 7.5, splineCount: 28,
    typicalRatios: [3.15, 3.23, 3.38, 3.46, 3.62, 3.85],
    maxTorqueNm: 3200, weightKg: 38,
    description: 'BMW M3 variable-lock diff. 57.5" housing width. Compact, proven in high-HP drift builds.',
  },
  {
    id: 'quick_change', name: 'Winters/Strange Quickchange', shortName: 'Q/C', make: 'Winters',
    widthMm: 1168, ringGearDia: 10.0, splineCount: 40,
    typicalRatios: [2.76, 3.00, 3.20, 3.42, 3.70, 4.11, 4.57, 5.00, 5.67, 6.17],
    maxTorqueNm: 8000, weightKg: 75,
    description: 'Sprint car / Pro Mod quickchange. 46" minimum width. Tool-free ratio swaps in minutes.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// TRANSMISSION PRESETS — Real-world manual transmissions with specs
// ═══════════════════════════════════════════════════════════════════════════
export interface TransmissionPreset {
  id: string;
  name: string;
  shortName: string;
  make: string;
  speeds: number;           // Number of forward gears
  defaultRatios: number[];  // Default gear ratios [1st, 2nd, 3rd, ...]
  maxTorqueNm: number;      // Max input torque capacity
  weightKg: number;         // Approximate weight
  bellhousingPattern: string; // Input pattern (e.g. 'Honda B', 'GM T56', 'Toyota R154')
  outputFlange: string;     // Output type (e.g. 'slip_yoke', 'flange')
  lengthMm: number;         // Overall length
  description: string;
}

export const TRANS_PRESETS: TransmissionPreset[] = [
  {
    id: 'honda_s4c', name: 'Honda S4C (Cable)', shortName: 'S4C', make: 'Honda',
    speeds: 5, defaultRatios: [3.230, 2.105, 1.458, 1.107, 0.848],
    maxTorqueNm: 260, weightKg: 35,
    bellhousingPattern: 'Honda B/D', outputFlange: 'cv_flange', lengthMm: 380,
    description: 'Stock Honda Civic Si (EM1) cable-shifted 5-speed. Helical LSD option. Short throws with aftermarket shifter.',
  },
  {
    id: 'honda_k_series', name: 'Honda K-Series 6MT', shortName: 'K6MT', make: 'Honda',
    speeds: 6, defaultRatios: [3.266, 2.130, 1.517, 1.147, 0.921, 0.738],
    maxTorqueNm: 350, weightKg: 41,
    bellhousingPattern: 'Honda K', outputFlange: 'cv_flange', lengthMm: 420,
    description: 'Honda Civic Type R / RSX Type-S 6-speed. Cable-shifted, close-ratio, good for 350+ WHP.',
  },
  {
    id: 'toyota_r154', name: 'Toyota R154', shortName: 'R154', make: 'Toyota',
    speeds: 5, defaultRatios: [3.250, 1.955, 1.310, 1.000, 0.753],
    maxTorqueNm: 550, weightKg: 45,
    bellhousingPattern: 'Toyota 1JZ/2JZ', outputFlange: 'slip_yoke', lengthMm: 545,
    description: 'Toyota Supra MK3 Turbo 5-speed. Strong synchros, handles 500+ WHP reliably. Popular JDM swap.',
  },
  {
    id: 'toyota_w58', name: 'Toyota W58', shortName: 'W58', make: 'Toyota',
    speeds: 5, defaultRatios: [3.285, 1.894, 1.275, 1.000, 0.783],
    maxTorqueNm: 380, weightKg: 32,
    bellhousingPattern: 'Toyota 1JZ/2JZ', outputFlange: 'slip_yoke', lengthMm: 505,
    description: 'Supra NA / Lexus SC300 5-speed. Lighter than R154, good for NA builds up to 350 WHP.',
  },
  {
    id: 'getrag_v160', name: 'Getrag V160/V161', shortName: 'V160', make: 'Getrag',
    speeds: 6, defaultRatios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793],
    maxTorqueNm: 750, weightKg: 58,
    bellhousingPattern: 'Toyota 2JZ', outputFlange: 'flange', lengthMm: 595,
    description: 'Supra MK4 Turbo 6-speed. Getrag-built, handles 700+ WHP. Direct bolt-on to 2JZ.',
  },
  {
    id: 'tremec_t56', name: 'Tremec T56', shortName: 'T56', make: 'Tremec',
    speeds: 6, defaultRatios: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50],
    maxTorqueNm: 650, weightKg: 58,
    bellhousingPattern: 'GM LS', outputFlange: 'slip_yoke', lengthMm: 680,
    description: 'GM F-body / Corvette / Viper 6-speed. Proven for 600+ HP, tons of aftermarket support.',
  },
  {
    id: 'tremec_t56_magnum', name: 'Tremec T56 Magnum', shortName: 'Magnum', make: 'Tremec',
    speeds: 6, defaultRatios: [2.66, 1.78, 1.30, 1.00, 0.80, 0.63],
    maxTorqueNm: 880, weightKg: 62,
    bellhousingPattern: 'GM LS', outputFlange: 'slip_yoke', lengthMm: 696,
    description: 'Upgraded T56 with improved synchros and higher torque capacity. 700+ WHP capable.',
  },
  {
    id: 'cd009', name: 'Nissan CD009', shortName: 'CD009', make: 'Nissan',
    speeds: 6, defaultRatios: [3.794, 2.324, 1.624, 1.271, 1.000, 0.794],
    maxTorqueNm: 600, weightKg: 48,
    bellhousingPattern: 'Nissan VQ', outputFlange: 'flange', lengthMm: 550,
    description: 'Nissan 350Z/370Z 6-speed. Strong, relatively compact. Popular for RB/SR swaps with adapter.',
  },
  {
    id: 'nissan_fs5w71c', name: 'Nissan FS5W71C', shortName: 'FS5W', make: 'Nissan',
    speeds: 5, defaultRatios: [3.321, 1.902, 1.308, 1.000, 0.838],
    maxTorqueNm: 350, weightKg: 35,
    bellhousingPattern: 'Nissan SR/KA', outputFlange: 'slip_yoke', lengthMm: 520,
    description: 'S13/S14 240SX 5-speed. Light, direct bolt-on for SR/KA. Good for 300-350 WHP.',
  },
  {
    id: 'bmw_getrag_420g', name: 'BMW Getrag 420G', shortName: '420G', make: 'Getrag',
    speeds: 6, defaultRatios: [4.23, 2.53, 1.67, 1.23, 1.00, 0.83],
    maxTorqueNm: 500, weightKg: 45,
    bellhousingPattern: 'BMW M50/S50', outputFlange: 'flange', lengthMm: 520,
    description: 'BMW E36 M3 6-speed. Close-ratio, smooth shifts. Good for 400 WHP with upgraded synchros.',
  },
  {
    id: 'subaru_ty75', name: 'Subaru TY75', shortName: 'TY75', make: 'Subaru',
    speeds: 5, defaultRatios: [3.454, 1.947, 1.366, 0.972, 0.738],
    maxTorqueNm: 400, weightKg: 40,
    bellhousingPattern: 'Subaru EJ', outputFlange: 'flange', lengthMm: 450,
    description: 'Subaru WRX STI 5-speed. Pull-type clutch, DCCD center diff. Handles 400 WHP.',
  },
  {
    id: 'subaru_ty856', name: 'Subaru TY856 (6MT)', shortName: 'TY856', make: 'Subaru',
    speeds: 6, defaultRatios: [3.636, 2.235, 1.521, 1.137, 0.971, 0.756],
    maxTorqueNm: 500, weightKg: 46,
    bellhousingPattern: 'Subaru EJ', outputFlange: 'flange', lengthMm: 480,
    description: 'Subaru STI 6-speed. DCCD center diff, stronger than TY75. Good for 500+ WHP.',
  },
  {
    id: 'aisin_ar5', name: 'Aisin AR5 (Solstice)', shortName: 'AR5', make: 'Aisin',
    speeds: 5, defaultRatios: [3.38, 2.05, 1.43, 1.03, 0.84],
    maxTorqueNm: 380, weightKg: 42,
    bellhousingPattern: 'GM Ecotec', outputFlange: 'slip_yoke', lengthMm: 540,
    description: 'Pontiac Solstice/Sky 5-speed. GM LS adapter kits available. Budget-friendly option.',
  },
  {
    id: 'nv4500', name: 'NV4500 (HD Truck)', shortName: 'NV4500', make: 'New Venture',
    speeds: 5, defaultRatios: [5.61, 3.04, 1.67, 1.00, 0.75],
    maxTorqueNm: 1100, weightKg: 68,
    bellhousingPattern: 'GM/Dodge HD', outputFlange: 'slip_yoke', lengthMm: 710,
    description: 'GM/Dodge 3/4-ton truck trans. Massive torque capacity, ultra-low 1st gear. Popular for diesels.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETRIC ENGINE GEOMETRY — Computes 3D dimensions from engine specs
// ═══════════════════════════════════════════════════════════════════════════
export interface EngineGeometry {
  // Scale factor
  S: number;
  // Core engine dimensions (in scene units)
  bore: number;
  stroke: number;
  boreSpacing: number;
  conRodLen: number;
  crankThrow: number;
  pistonH: number;
  // Block dimensions
  blockL: number;           // Length along crankshaft (X)
  blockDeckH: number;       // Crank center to deck height
  blockSumpH: number;       // Below crank center to oil pan
  blockD: number;           // Front-to-back depth
  blockW: number;           // Total block width (for V/flat engines)
  // Head dimensions
  headH: number;
  valveCoverH: number;
  headTotalH: number;
  // Crank/internals
  crankMainR: number;
  crankPinR: number;
  cwR: number;
  cwThick: number;
  crankOffsets: number[];   // Angular offsets for each cylinder
  // Valves
  intakeValveDia: number;
  exhaustValveDia: number;
  valveStemDia: number;
  valveStemLen: number;
  valveHeadThick: number;
  valveSpringOR: number;
  valveSpringIR: number;
  valveMaxLift: number;
  valveAngle: number;
  // Timing
  crankSprocketR: number;
  camSprocketR: number;
  tensionerR: number;
  // Throttle
  tbDia: number;
  // Flywheel/clutch
  fwR: number;
  fwThick: number;
  clutchR: number;
  clutchThick: number;
  ppThick: number;
  ppR: number;
  // Transmission case dimensions
  transL: number;
  transH: number;
  transD: number;
  diffR: number;
  // Layout info
  cylinders: number;
  layout: string;
  bankAngle: number;        // V-angle in radians (0 for inline, π for flat)
  firingOrder: number[];
  // Cylinder positions (relative to block center)
  cylinderXOffsets: number[];
  // For V/flat: bank assignments (0=left, 1=right)
  cylinderBanks: number[];
}

/**
 * Compute engine geometry from an EnginePreset
 * Converts bore/stroke/cylinders/layout into all 3D dimensions needed for rendering
 */
export function computeEngineGeometry(preset: EnginePreset): EngineGeometry {
  const S = 0.01;  // mm → scene units
  
  // Core dimensions from preset
  const bore = preset.bore * S;
  const stroke = preset.stroke * S;
  
  // Bore spacing: typically bore + 6-8mm for siamesed bores
  // More for larger bores, less for small displacement engines
  const boreSpacing = (preset.bore + Math.max(6, preset.bore * 0.08)) * S;
  
  // Con rod length: typically 1.6-1.8x stroke for street engines
  // Shorter rod ratio for high-RPM engines
  const conRodLen = stroke * 1.73;  // ~134mm for B16A2 (77.4 stroke)
  
  const crankThrow = stroke / 2;
  const pistonH = bore * 0.37;  // Piston height ~37% of bore
  
  // Block dimensions based on layout
  let blockL: number;
  let blockW: number;
  let blockDeckH: number;
  let bankAngle = 0;
  
  const cylCount = preset.cylinders;
  const layout = preset.layout;
  
  // Calculate block length based on cylinder count and layout
  if (layout.startsWith('I')) {
    // Inline engines: length = (cylinders-1) * spacing + bore + end clearance
    blockL = (cylCount - 1) * boreSpacing + bore + 150 * S;
    blockW = bore + 120 * S;  // Single bank width
    bankAngle = 0;
  } else if (layout === 'V6') {
    // V6: 2 banks of 3, ~60° angle
    blockL = 2 * boreSpacing + bore + 100 * S;
    blockW = bore * 2 + 180 * S;
    bankAngle = 60 * (Math.PI / 180);
  } else if (layout === 'V8') {
    // V8: 2 banks of 4, ~90° angle
    blockL = 3 * boreSpacing + bore + 100 * S;
    blockW = bore * 2 + 200 * S;
    bankAngle = 90 * (Math.PI / 180);
  } else if (layout === 'V10') {
    // V10: 2 banks of 5, ~90° angle
    blockL = 4 * boreSpacing + bore + 100 * S;
    blockW = bore * 2 + 200 * S;
    bankAngle = 90 * (Math.PI / 180);
  } else if (layout === 'V12') {
    // V12: 2 banks of 6, ~60° angle
    blockL = 5 * boreSpacing + bore + 100 * S;
    blockW = bore * 2 + 200 * S;
    bankAngle = 60 * (Math.PI / 180);
  } else if (layout === 'F4' || layout === 'F6') {
    // Flat/boxer: 180° angle (horizontally opposed)
    const cylPerBank = cylCount / 2;
    blockL = (cylPerBank - 1) * boreSpacing + bore + 100 * S;
    blockW = bore * 2 + 250 * S;  // Wide due to horizontal layout
    bankAngle = Math.PI;  // 180°
  } else if (layout === 'R2') {
    // Rotary: special case
    blockL = 300 * S;     // Compact
    blockW = 250 * S;
    bankAngle = 0;
  } else if (layout === 'W16') {
    // W16: like 2 narrow-angle V8s in a W
    blockL = 3 * boreSpacing + bore + 100 * S;
    blockW = bore * 2 + 250 * S;
    bankAngle = 15 * (Math.PI / 180);  // Narrow VR angle
  } else {
    // Default to inline-like
    blockL = (cylCount - 1) * boreSpacing + bore + 150 * S;
    blockW = bore + 120 * S;
  }
  
  // Deck height scales with stroke
  blockDeckH = stroke * 1.25 + bore * 0.6 + 80 * S;  // ~204mm for B16A2
  const blockSumpH = stroke + 20 * S;  // Oil pan depth
  const blockD = bore + 120 * S;  // Front-to-back depth
  
  // Head dimensions (DOHC typical)
  const headH = bore * 1.5;  // ~123mm for 81mm bore
  const valveCoverH = bore * 0.83;  // ~67mm
  const headTotalH = headH + valveCoverH;
  
  // Crank dimensions
  const crankMainR = bore * 0.31;  // Main journal ~1/3 bore
  const crankPinR = bore * 0.26;   // Rod journal slightly smaller
  const cwR = stroke * 0.71;       // Counterweight radius
  const cwThick = bore * 0.15;     // CW thickness
  
  // Calculate crank offsets based on layout and cylinder count
  let crankOffsets: number[] = [];
  let firingOrder: number[] = [];
  let cylinderBanks: number[] = [];
  
  if (layout === 'I4') {
    // Inline-4: 180° flat-plane crank, firing 1-3-4-2
    crankOffsets = [0, Math.PI, Math.PI, 0];
    firingOrder = [1, 3, 4, 2];
    cylinderBanks = [0, 0, 0, 0];
  } else if (layout === 'I3') {
    // Inline-3: 120° crank throws
    crankOffsets = [0, 2*Math.PI/3, 4*Math.PI/3];
    firingOrder = [1, 2, 3];
    cylinderBanks = [0, 0, 0];
  } else if (layout === 'I6') {
    // Inline-6: 120° spacing, firing 1-5-3-6-2-4
    crankOffsets = [0, 4*Math.PI/3, 2*Math.PI/3, 2*Math.PI/3, 4*Math.PI/3, 0];
    firingOrder = [1, 5, 3, 6, 2, 4];
    cylinderBanks = [0, 0, 0, 0, 0, 0];
  } else if (layout === 'V6') {
    // V6: 60° bank angle, various firing orders
    crankOffsets = [0, 2*Math.PI/3, 4*Math.PI/3, Math.PI/3, Math.PI, 5*Math.PI/3];
    firingOrder = [1, 4, 2, 5, 3, 6];
    cylinderBanks = [0, 1, 0, 1, 0, 1];  // Alternating banks
  } else if (layout === 'V8') {
    // V8 cross-plane: 90° crank throws
    crankOffsets = [0, Math.PI/2, Math.PI*3/2, Math.PI, Math.PI, Math.PI*3/2, Math.PI/2, 0];
    firingOrder = [1, 8, 4, 3, 6, 5, 7, 2];  // LS firing order
    cylinderBanks = [0, 1, 0, 1, 0, 1, 0, 1];
  } else if (layout === 'F4') {
    // Flat-4 boxer: opposing pistons move together
    crankOffsets = [0, Math.PI, Math.PI, 0];
    firingOrder = [1, 3, 2, 4];
    cylinderBanks = [0, 1, 0, 1];  // Left, right alternating
  } else if (layout === 'F6') {
    // Flat-6 boxer
    crankOffsets = [0, Math.PI, 2*Math.PI/3, 5*Math.PI/3, 4*Math.PI/3, Math.PI/3];
    firingOrder = [1, 6, 2, 4, 3, 5];
    cylinderBanks = [0, 1, 0, 1, 0, 1];
  } else if (layout === 'R2') {
    // Rotary: 2 rotors, 180° apart (3 faces each = fires 3x per rotor rev)
    crankOffsets = [0, Math.PI];
    firingOrder = [1, 2];
    cylinderBanks = [0, 0];
  } else {
    // Default for unknown layouts
    crankOffsets = Array(cylCount).fill(0).map((_, i) => (i * 2 * Math.PI) / cylCount);
    firingOrder = Array(cylCount).fill(0).map((_, i) => i + 1);
    cylinderBanks = Array(cylCount).fill(0);
  }
  
  // Calculate cylinder X-axis positions relative to block center
  const cylinderXOffsets: number[] = [];
  if (layout.startsWith('I') || layout === 'R2') {
    // Inline: evenly spaced along X
    const startX = -((cylCount - 1) * boreSpacing) / 2;
    for (let i = 0; i < cylCount; i++) {
      cylinderXOffsets.push(startX + i * boreSpacing);
    }
  } else if (layout.startsWith('V') || layout.startsWith('F')) {
    // V/flat: banks are interleaved
    const cylPerBank = cylCount / 2;
    const startX = -((cylPerBank - 1) * boreSpacing) / 2;
    for (let i = 0; i < cylCount; i++) {
      const bankIdx = i % 2;  // 0 or 1
      const posInBank = Math.floor(i / 2);
      cylinderXOffsets.push(startX + posInBank * boreSpacing + bankIdx * (boreSpacing * 0.5));
    }
  } else {
    // Default
    const startX = -((cylCount - 1) * boreSpacing) / 2;
    for (let i = 0; i < cylCount; i++) {
      cylinderXOffsets.push(startX + i * boreSpacing);
    }
  }
  
  // Valve dimensions (scale with bore)
  const intakeValveDia = bore * 0.407;   // ~33mm for 81mm bore
  const exhaustValveDia = bore * 0.358;  // ~29mm
  const valveStemDia = bore * 0.068;     // ~5.5mm
  const valveStemLen = bore * 1.235;     // ~100mm
  const valveHeadThick = bore * 0.025;   // ~2mm
  const valveSpringOR = bore * 0.198;    // ~16mm
  const valveSpringIR = bore * 0.148;    // ~12mm
  const valveMaxLift = stroke * 0.137;   // ~10.6mm for B16A2 VTEC
  const valveAngle = 23 * (Math.PI / 180);  // Typical DOHC included angle
  
  // Timing
  const crankSprocketR = bore * 0.43;   // ~35mm
  const camSprocketR = bore * 0.68;     // ~55mm (2:1 ratio)
  const tensionerR = bore * 0.15;       // ~12mm
  
  // Throttle body (scales with displacement)
  const dispCC = preset.displacement;
  const tbDia = Math.sqrt(dispCC / 1000) * 45 * S;  // Roughly 62mm for 1.6L
  
  // Flywheel/clutch (scales with torque potential)
  const torqueFactor = Math.sqrt(preset.maxTq / 111);  // Normalized to B16A2
  const fwR = 135 * S * Math.max(1, torqueFactor * 0.8);
  const fwThick = 22 * S * Math.max(1, torqueFactor * 0.6);
  const clutchR = fwR * 0.78;
  const clutchThick = 10 * S;
  const ppThick = 14 * S;
  const ppR = fwR * 0.85;
  
  return {
    S,
    bore,
    stroke,
    boreSpacing,
    conRodLen,
    crankThrow,
    pistonH,
    blockL,
    blockDeckH,
    blockSumpH,
    blockD,
    blockW,
    headH,
    valveCoverH,
    headTotalH,
    crankMainR,
    crankPinR,
    cwR,
    cwThick,
    crankOffsets,
    intakeValveDia,
    exhaustValveDia,
    valveStemDia,
    valveStemLen,
    valveHeadThick,
    valveSpringOR,
    valveSpringIR,
    valveMaxLift,
    valveAngle,
    crankSprocketR,
    camSprocketR,
    tensionerR,
    tbDia,
    fwR,
    fwThick,
    clutchR,
    clutchThick,
    ppThick,
    ppR,
    // Transmission case — scale with engine torque capacity
    transL: preset.layout.startsWith('V') || preset.layout === 'W16' ? 420 * S : preset.layout === 'I6' ? 400 * S : 380 * S,
    transH: (preset.layout.startsWith('V') || preset.layout === 'W16') ? 380 * S : 350 * S,
    transD: (preset.layout.startsWith('V') || preset.layout === 'W16') ? 400 * S : 370 * S,
    diffR: preset.displacement > 4000 ? 105 * S : preset.displacement > 2500 ? 97 * S : 92.5 * S,
    cylinders: cylCount,
    layout: preset.layout,
    bankAngle,
    firingOrder,
    cylinderXOffsets,
    cylinderBanks,
  };
}

// Default engine geometry (B16A2)
export const DEFAULT_ENGINE_GEOMETRY = computeEngineGeometry(ENGINE_PRESETS[0]);

// ═══════════════════════════════════════════════════════════════════════════
// PROP TYPES
// ═══════════════════════════════════════════════════════════════════════════
export interface DrivetrainView3DProps {
  tireRpm: number;
  rpm: number;
  clutchStatus: string;
  clutchSlipPct: number;
  currentGear: number | string;
  currentGearRatio: number;
  slipPct: number;
  drivetrainType: string;  // 'FWD' | 'RWD' | 'AWD'
  accelerationG?: number;  // longitudinal accel in G (positive = accel, negative = braking)
  throttle?: number;       // 0-100 throttle position
  // ── Sim-synced configuration ──
  engineId?: string;           // active engine preset id (e.g. 'ls3', '2jz-gte')
  numCylinders?: number;       // override cylinder count (from ECU config)
  redlineRpm?: number;         // engine redline
  gearRatios?: number[];       // current gear ratios array
  finalDriveRatio?: number;    // final drive ratio
  transmissionModel?: string;  // transmission preset id
  tireWidthMm?: number;        // tire section width mm
  tireAspectRatio?: number;    // tire aspect ratio %
  wheelDiameterIn?: number;    // wheel diameter inches
  speedMph?: number;           // current speed in mph
  topSpeedMode?: boolean;      // whether top-speed run is active
  quarterMileLaunched?: boolean; // whether the car has launched
  quarterMileActive?: boolean;   // whether QM mode is active (staging or running)
  distanceFt?: number;           // distance traveled in feet
}

// safe-number helper — any NaN / Infinity → fallback
function sn(v: number, fb = 0): number {
  return Number.isFinite(v) ? v : fb;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIRE + WHEEL ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════════
// The axle runs along +X.  The tire spins around +X (rotation.x).
// LatheGeometry revolves a 2D cross-section profile around Y, then rotated
// so the tire axis = X.  This produces a proper tire shape with flat tread,
// rounded shoulders, and convex sidewall — not a circular torus cross-section.
// ═══════════════════════════════════════════════════════════════════════════
function TireAndWheel({ rotationAngle: _unused }: { rotationAngle: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const store = useContext(PropsStoreCtx);
  const animRefs = useContext(AnimationRefsCtx);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.x = animRefs?.tireRot?.current ?? 0;
    }
  });

  // Compute tire dimensions from store (falls back to 195/55R15 defaults)
  const tw = store.current.tireWidthMm || 195;
  const ar = store.current.tireAspectRatio || 55;
  const wd = store.current.wheelDiameterIn || 15;

  const tireSectionW = tw * S;
  const sidewallH = tw * (ar / 100) * S;
  const rimDia = wd * 25.4 * S;
  const rimR = rimDia / 2;
  const tireOD = rimDia + 2 * sidewallH;
  const tireOR = tireOD / 2;

  const tireGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const halfW = tireSectionW / 2;

    pts.push(new THREE.Vector2(rimR + 0.015, -halfW * 0.82));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.06, -halfW * 0.86));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.18, -halfW * 0.91));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.32, -halfW * 0.95));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.48, -halfW * 0.97));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.62, -halfW * 0.96));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.76, -halfW * 0.92));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.86, -halfW * 0.85));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.94, -halfW * 0.76));
    pts.push(new THREE.Vector2(tireOR - 0.008, -halfW * 0.66));
    pts.push(new THREE.Vector2(tireOR, -halfW * 0.54));
    pts.push(new THREE.Vector2(tireOR + 0.003, -halfW * 0.28));
    pts.push(new THREE.Vector2(tireOR + 0.004, 0));
    pts.push(new THREE.Vector2(tireOR + 0.003, halfW * 0.28));
    pts.push(new THREE.Vector2(tireOR, halfW * 0.54));
    pts.push(new THREE.Vector2(tireOR - 0.008, halfW * 0.66));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.94, halfW * 0.76));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.86, halfW * 0.85));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.76, halfW * 0.92));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.62, halfW * 0.96));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.48, halfW * 0.97));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.32, halfW * 0.95));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.18, halfW * 0.91));
    pts.push(new THREE.Vector2(rimR + sidewallH * 0.06, halfW * 0.86));
    pts.push(new THREE.Vector2(rimR + 0.015, halfW * 0.82));

    return new THREE.LatheGeometry(pts, 64);
  }, [tireSectionW, sidewallH, rimR, tireOR]);

  const barrelW = tireSectionW * 0.65;
  const barrelGeo = useMemo(
    () => new THREE.CylinderGeometry(rimR, rimR, barrelW, 40, 1, true),
    [rimR, barrelW],
  );

  const SPOKE_COUNT = 5;
  const spokeAngles = useMemo(
    () => Array.from({ length: SPOKE_COUNT }, (_, i) => (i / SPOKE_COUNT) * Math.PI * 2),
    [],
  );

  const windowR = (HUB_OR + rimR * 0.90) / 2;
  const windowLen = rimR * 0.48;

  // ── Rim face position (outboard) ──
  const faceX = barrelW / 2 - 0.03;  // just inside the outboard lip

  return (
    <group ref={groupRef}>
      {/* ═══ TIRE BODY ═══ */}
      {/* LatheGeometry axis = Y → rotate π/2 around Z so axis = X */}
      <mesh geometry={tireGeo} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="#1a1a1a" roughness={0.92} metalness={0.02} side={THREE.DoubleSide} />
      </mesh>

      {/* ═══ CIRCUMFERENTIAL TREAD GROOVES ═══ */}
      {/* 4 grooves spaced across the tread width — dark rings at the tread surface */}
      {[-0.30, -0.10, 0.10, 0.30].map((frac, i) => (
        <mesh key={`groove-${i}`} rotation={[0, Math.PI / 2, 0]} position={[frac * tireSectionW, 0, 0]}>
          <torusGeometry args={[tireOR + 0.001, 0.008, 6, 64]} />
          <meshStandardMaterial color="#0e0e0e" roughness={1} metalness={0} />
        </mesh>
      ))}

      {/* ═══ LATERAL TREAD SIPES ═══ */}
      {/* Small cross-cuts across the tread blocks */}
      {Array.from({ length: 48 }, (_, i) => {
        const angle = (i / 48) * Math.PI * 2;
        const cy = Math.cos(angle) * (tireOR + 0.002);
        const cz = Math.sin(angle) * (tireOR + 0.002);
        return (
          <mesh key={`sipe-${i}`} position={[0, cy, cz]} rotation={[angle, 0, 0]}>
            <boxGeometry args={[tireSectionW * 0.48, 0.005, 0.018]} />
            <meshStandardMaterial color="#0d0d0d" roughness={1} />
          </mesh>
        );
      })}

      {/* ═══ SIDEWALL LETTERING (raised text effect) ═══ */}
      {[1, -1].map((side) => {
        const swMidR = rimR + sidewallH * 0.48;
        return Array.from({ length: 16 }, (_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          const sy = Math.cos(angle) * swMidR;
          const sz = Math.sin(angle) * swMidR;
          return (
            <mesh key={`swt${side}_${i}`} position={[side * tireSectionW * 0.38, sy, sz]} rotation={[angle, 0, 0]}>
              <boxGeometry args={[0.015, 0.06, sidewallH * 0.18]} />
              <meshStandardMaterial color="#222" roughness={0.88} metalness={0.05} />
            </mesh>
          );
        });
      })}

      {/* ═══ RIM BARREL ═══ */}
      <mesh geometry={barrelGeo} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="#888" metalness={0.85} roughness={0.18} />
      </mesh>

      {/* ═══ RIM FLANGES (bead-seat lips) ═══ */}
      {[1, -1].map((side) => (
        <mesh key={`flange${side}`} rotation={[0, Math.PI / 2, 0]} position={[side * barrelW / 2, 0, 0]}>
          <torusGeometry args={[rimR, 0.04, 10, 40]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.92} roughness={0.06} />
        </mesh>
      ))}

      {/* ═══ RIM FACE DISC (outboard) ═══ */}
      {/* Solid ring behind the spokes — visible through spoke windows */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[faceX - 0.05, 0, 0]}>
        <ringGeometry args={[HUB_OR * 0.75, rimR * 0.94, 40]} />
        <meshStandardMaterial color="#555" metalness={0.6} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* ═══ SPOKE WINDOWS (dark openings) ═══ */}
      {spokeAngles.map((angle, i) => {
        const midAngle = angle + Math.PI / SPOKE_COUNT; // between two spokes
        const wy = Math.cos(midAngle) * windowR;
        const wz = Math.sin(midAngle) * windowR;
        return (
          <mesh key={`win${i}`} position={[faceX - 0.02, wy, wz]} rotation={[midAngle, 0, 0]}>
            <boxGeometry args={[0.06, windowLen, rimR * 0.32]} />
            <meshStandardMaterial color="#222" metalness={0.3} roughness={0.7} />
          </mesh>
        );
      })}

      {/* ═══ 5 SPOKES — tapered from hub to rim ═══ */}
      {spokeAngles.map((angle, i) => {
        const hubEnd = HUB_OR + 0.02;
        const rimEnd = rimR * 0.88;
        const spokeLen = rimEnd - hubEnd;
        const spokeMidR = (hubEnd + rimEnd) / 2;
        const cy = Math.cos(angle) * spokeMidR;
        const cz = Math.sin(angle) * spokeMidR;

        // Spoke widens from hub (~0.06) to rim (~0.12)
        const spokeWHub = 0.07;
        const spokeWRim = 0.14;
        const spokeDepth = 0.06;

        // Hub-end attachment point
        const h1y = Math.cos(angle) * hubEnd;
        const h1z = Math.sin(angle) * hubEnd;
        // Rim-end attachment point
        const r1y = Math.cos(angle) * rimEnd;
        const r1z = Math.sin(angle) * rimEnd;

        return (
          <group key={`sp${i}`}>
            {/* Main spoke body — tapered box approximation */}
            <mesh position={[faceX, cy, cz]} rotation={[angle, 0, 0]}>
              <boxGeometry args={[spokeDepth, spokeLen, (spokeWHub + spokeWRim) / 2]} />
              <meshStandardMaterial color="#d0d0d0" metalness={0.88} roughness={0.10} />
            </mesh>
            {/* Spoke highlight — machined face strip */}
            <mesh position={[faceX + spokeDepth / 2 + 0.002, cy, cz]} rotation={[angle, 0, 0]}>
              <boxGeometry args={[0.005, spokeLen * 0.85, (spokeWHub + spokeWRim) / 2 * 0.7]} />
              <meshStandardMaterial color="#eee" metalness={0.8} roughness={0.15} />
            </mesh>
          </group>
        );
      })}

      {/* ═══ CENTER HUB ═══ */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[faceX, 0, 0]}>
        <cylinderGeometry args={[HUB_OR * 0.7, HUB_OR * 0.75, 0.12, 24]} />
        <meshStandardMaterial color="#555" metalness={0.75} roughness={0.25} />
      </mesh>

      {/* Honda "H" center cap */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[faceX + 0.065, 0, 0]}>
        <circleGeometry args={[HUB_OR * 0.55, 24]} />
        <meshStandardMaterial color="#666" metalness={0.7} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[faceX + 0.068, 0, 0]}>
        <ringGeometry args={[HUB_OR * 0.28, HUB_OR * 0.42, 24]} />
        <meshStandardMaterial color="#999" metalness={0.8} roughness={0.2} side={THREE.DoubleSide} />
      </mesh>

      {/* ═══ LUG NUTS (4×100 PCD — Honda pattern) ═══ */}
      {Array.from({ length: 4 }, (_, i) => {
        const nutAngle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const lugPCD = HUB_OR * 0.78;
        const ly = Math.cos(nutAngle) * lugPCD;
        const lz = Math.sin(nutAngle) * lugPCD;
        return (
          <mesh key={`lug${i}`} position={[faceX + 0.04, ly, lz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.042, 0.042, 0.06, 6]} />
            <meshStandardMaterial color="#888" metalness={0.95} roughness={0.05} />
          </mesh>
        );
      })}

      {/* ═══ VALVE STEM ═══ */}
      {/* Positioned on the inboard sidewall, protruding radially outward */}
      <mesh position={[-barrelW * 0.25, -(rimR + sidewallH * 0.08), 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.13, 8]} />
        <meshStandardMaterial color="#333" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[-barrelW * 0.25, -(rimR + sidewallH * 0.08) - 0.075, 0]}>
        <cylinderGeometry args={[0.022, 0.015, 0.025, 8]} />
        <meshStandardMaterial color="#555" metalness={0.6} roughness={0.4} />
      </mesh>

    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BRAKE ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════════
function BrakeAssembly({ rotationAngle: _unused }: { rotationAngle: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const animRefs = useContext(AnimationRefsCtx);
  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.x = animRefs?.tireRot?.current ?? 0;
  });

  // Vented disc slots
  const slotAngles = useMemo(() => {
    const s: number[] = [];
    for (let i = 0; i < 36; i++) s.push((i / 36) * Math.PI * 2);
    return s;
  }, []);

  return (
    <group>
      {/* Rotor — rotates with wheel */}
      <group ref={groupRef}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[ROTOR_R, ROTOR_R, ROTOR_THICK, 48]} />
          <meshStandardMaterial color="#8a8a8a" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Rotor hat (center) */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[HUB_OR * 0.8, HUB_OR * 0.7, ROTOR_THICK * 2, 24]} />
          <meshStandardMaterial color="#777" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Vent slots */}
        {slotAngles.map((a, i) => {
          const r = (ROTOR_R + HUB_OR * 0.7) / 2;
          return (
            <mesh
              key={`slot${i}`}
              position={[0, Math.cos(a) * r, Math.sin(a) * r]}
              rotation={[a, 0, 0]}
            >
              <boxGeometry args={[ROTOR_THICK * 1.5, 0.02, (ROTOR_R - HUB_OR * 0.7) * 0.7]} />
              <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
            </mesh>
          );
        })}
      </group>

      {/* Caliper — does NOT rotate */}
      <group position={[0, ROTOR_R * 0.55, 0]}>
        {/* Caliper body */}
        <mesh>
          <boxGeometry args={[0.35, 0.35, 0.55]} />
          <meshStandardMaterial color="#cc2200" metalness={0.35} roughness={0.55} />
        </mesh>
        {/* Caliper face */}
        <mesh position={[0.18, 0, 0]}>
          <boxGeometry args={[0.02, 0.28, 0.48]} />
          <meshStandardMaterial color="#dd3311" metalness={0.3} roughness={0.6} />
        </mesh>
        {/* Brake pads */}
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[ROTOR_THICK * 1.2, 0.18, 0.42]} />
          <meshStandardMaterial color="#3a3a2a" roughness={0.95} />
        </mesh>
        {/* Bleed nipple */}
        <mesh position={[0.15, 0.15, 0.2]} rotation={[0, 0, Math.PI / 4]}>
          <cylinderGeometry args={[0.015, 0.015, 0.08, 6]} />
          <meshStandardMaterial color="#777" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Brake line fitting */}
        <mesh position={[-0.15, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
          <meshStandardMaterial color="#333" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HUB / KNUCKLE / SUSPENSION
// ═══════════════════════════════════════════════════════════════════════════
function HubKnuckleSuspension({ position, compression = 0 }: { position: [number, number, number]; compression?: number }) {
  // compression: 0 = neutral, negative = compressed (dive/squat), positive = extended
  const compressedH = SPRING_H + compression;  // shorter when compressed (compression is negative)
  const strutOffset = compression * 0.5;        // strut rod extends/retracts with compression
  return (
    <group position={position}>
      {/* ── STEERING KNUCKLE ── */}
      <mesh>
        <cylinderGeometry args={[KNUCKLE_R, KNUCKLE_R * 0.9, KNUCKLE_H, 12]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Knuckle boss (wheel bearing area) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
        <cylinderGeometry args={[HUB_OR, HUB_OR, HUB_W * 0.6, 24]} />
        <meshStandardMaterial color="#555" metalness={0.65} roughness={0.35} />
      </mesh>

      {/* ── WHEEL BEARING (visible lip) ── */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[HUB_W * 0.35, 0, 0]}>
        <torusGeometry args={[HUB_OR * 0.85, 0.03, 8, 24]} />
        <meshStandardMaterial color="#777" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* ── McPHERSON STRUT ── */}
      {/* Strut mounts directly above the knuckle pinch-clamp, ~15 mm forward
          of knuckle center in Z — matching real Civic EK geometry.  No large
          Z-offset needed because the track-width layout already keeps the
          suspension outboard of the engine block. */}
      <group position={[0, KNUCKLE_H * 0.35, 15 * S]}>
        {/* Strut body */}
        <mesh>
          <cylinderGeometry args={[STRUT_R, STRUT_R * 0.9, STRUT_H, 16]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Strut rod (chrome) — slides with compression */}
        <mesh position={[0, STRUT_H * 0.45 + strutOffset, 0]}>
          <cylinderGeometry args={[STRUT_R * 0.35, STRUT_R * 0.35, STRUT_H * 0.3, 8]} />
          <meshStandardMaterial color="#bbb" metalness={0.95} roughness={0.05} />
        </mesh>
        {/* Strut mount (top hat) */}
        <mesh position={[0, STRUT_H * 0.55, 0]}>
          <cylinderGeometry args={[STRUT_R * 1.5, STRUT_R * 1.3, 0.2, 16]} />
          <meshStandardMaterial color="#333" roughness={0.8} />
        </mesh>

        {/* ── COIL SPRING (height varies with compression) ── */}
        <CoilSpring
          innerR={SPRING_IR}
          outerR={SPRING_OR}
          height={compressedH}
          coils={7}
          wireR={0.04}
        />
      </group>

      {/* ── LOWER CONTROL ARM (A-arm) ── */}
      {/* Ball-joint end aligns with knuckle center; arm extends inboard.
          No Z-offset — LCA is in the same transverse plane as the wheel. */}
      <group position={[-LCA_LEN * 0.48, -KNUCKLE_H * 0.45, 0]}>
        <mesh rotation={[0, 0, Math.PI / 12]}>
          <boxGeometry args={[LCA_LEN, LCA_THICK, LCA_W]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Ball joint */}
        <mesh position={[LCA_LEN * 0.48, 0.08, 0]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Ball joint boot */}
        <mesh position={[LCA_LEN * 0.48, 0.04, 0]}>
          <cylinderGeometry args={[0.06, 0.10, 0.1, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
        </mesh>
        {/* Front bushing */}
        <mesh position={[-LCA_LEN * 0.48, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, LCA_W * 1.1, 12]} />
          <meshStandardMaterial color="#222" roughness={0.9} />
        </mesh>
        {/* Rear bushing */}
        <mesh position={[-LCA_LEN * 0.2, 0, LCA_W * 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.15, 12]} />
          <meshStandardMaterial color="#222" roughness={0.9} />
        </mesh>
      </group>

      {/* ── TIE ROD ── */}
      <group position={[0.3, -KNUCKLE_H * 0.2, 0.35]}>
        <mesh rotation={[0, Math.PI / 6, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 2.5, 8]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color="#444" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.035, 0.055, 0.08, 10]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
        </mesh>
      </group>

      {/* ── SWAY BAR END LINK ── */}
      <group position={[0.2, -0.3, -0.25]}>
        <mesh rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 1.2, 6]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Sway bar bushing (top) */}
        <mesh position={[0, 0.55, -0.2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.1, 8]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
        </mesh>
        {/* Sway bar bushing (bottom) */}
        <mesh position={[0, -0.55, 0.2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.1, 8]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
        </mesh>
      </group>

      {/* ── ABS SENSOR WIRE ── */}
      <mesh position={[0.15, -0.2, 0.1]} rotation={[0.3, 0, 0.5]}>
        <cylinderGeometry args={[0.008, 0.008, 1.0, 6]} />
        <meshStandardMaterial color="#111" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COIL SPRING  (parametric helix using TubeGeometry)
// ═══════════════════════════════════════════════════════════════════════════
function CoilSpring({
  innerR, outerR, height, coils, wireR,
}: {
  innerR: number; outerR: number; height: number; coils: number; wireR: number;
}) {
  const geo = useMemo(() => {
    const avgR = (innerR + outerR) / 2;
    const points: THREE.Vector3[] = [];
    const segments = coils * 32;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const theta = t * coils * Math.PI * 2;
      const x = Math.cos(theta) * avgR;
      const z = Math.sin(theta) * avgR;
      const y = (t - 0.5) * height;
      points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, segments, wireR, 8, false);
  }, [innerR, outerR, height, coils, wireR]);

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#2a6a2a" metalness={0.7} roughness={0.35} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CV BOOT  (accordion profile via LatheGeometry — axis along X)
// ═══════════════════════════════════════════════════════════════════════════
function CVBoot({
  length, innerR, outerR, position, flipDirection,
}: {
  length: number; innerR: number; outerR: number;
  position: [number, number, number]; flipDirection?: boolean;
}) {
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const folds = 6;
    const steps = folds * 6 + 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const baseR = flipDirection
        ? innerR + (outerR - innerR) * t
        : outerR + (innerR - outerR) * t;
      const accordion = Math.sin(t * folds * Math.PI * 2) * 0.015 * (1 + t);
      pts.push(new THREE.Vector2(Math.max(baseR + accordion, 0.01), t * length));
    }
    return new THREE.LatheGeometry(pts, 20);
  }, [length, innerR, outerR, flipDirection]);

  return (
    <mesh geometry={geo} position={position} rotation={[0, 0, Math.PI / 2]}>
      <meshStandardMaterial color="#151515" roughness={0.95} metalness={0.04} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CV JOINT  — rotates around +X axis (same as tire)
// ═══════════════════════════════════════════════════════════════════════════
function CVJoint({
  position, rotationAngle: _unused, type,
}: {
  position: [number, number, number]; rotationAngle: number;
  type: "tripod" | "rzeppa";
}) {
  const ref = useRef<THREE.Group>(null!);
  const animRefs = useContext(AnimationRefsCtx);
  useFrame(() => {
    // CV joint internals rotate around the axle axis (+X)
    if (ref.current) ref.current.rotation.x = animRefs?.tireRot?.current ?? 0;
  });

  const ballCount = type === "rzeppa" ? 6 : 3;
  const ballR = type === "rzeppa" ? 0.08 : 0.11;

  return (
    <group position={position}>
      {/* Outer race / housing — stationary appearance, aligned along X */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[CV_R, CV_R, CV_LEN, 28]} />
        <meshStandardMaterial color="#7a7a7a" metalness={0.78} roughness={0.22} />
      </mesh>
      {/* Inner cage ring */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[CV_R * 0.55, 0.02, 8, 24]} />
        <meshStandardMaterial color="#aaa" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Rotating internals (balls / rollers) */}
      <group ref={ref}>
        {Array.from({ length: ballCount }, (_, i) => {
          const angle = (i / ballCount) * Math.PI * 2;
          const r = CV_R * 0.55;
          return (
            <group key={i}>
              {/* Ball / roller */}
              <mesh position={[0, Math.cos(angle) * r, Math.sin(angle) * r]}>
                <sphereGeometry args={[ballR, 14, 14]} />
                <meshStandardMaterial color="#e0e0e0" metalness={0.95} roughness={0.05} />
              </mesh>
              {/* Cage window */}
              {type === "rzeppa" && (
                <mesh
                  position={[0, Math.cos(angle) * r * 0.95, Math.sin(angle) * r * 0.95]}
                  rotation={[angle, 0, 0]}
                >
                  <torusGeometry args={[ballR * 1.15, 0.008, 4, 12]} />
                  <meshStandardMaterial color="#999" metalness={0.85} roughness={0.15} />
                </mesh>
              )}
              {/* Tripod roller */}
              {type === "tripod" && (
                <mesh
                  position={[0, Math.cos(angle) * r, Math.sin(angle) * r]}
                  rotation={[angle, 0, 0]}
                >
                  <cylinderGeometry args={[ballR * 0.6, ballR * 0.6, CV_LEN * 0.5, 12]} />
                  <meshStandardMaterial color="#ccc" metalness={0.9} roughness={0.1} />
                </mesh>
              )}
            </group>
          );
        })}
        {/* Inner splined hub */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[AXLE_R * 1.3, AXLE_R * 1.3, CV_LEN * 0.6, 16]} />
          <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AXLE SHAFT  (splined, runs along +X)
// ═══════════════════════════════════════════════════════════════════════════
function AxleShaft({ position, length }: { position: [number, number, number]; length: number }) {
  return (
    <group position={position}>
      {/* Main shaft */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[AXLE_R, AXLE_R, length, 20]} />
        <meshStandardMaterial color="#b0b0b0" metalness={0.88} roughness={0.12} />
      </mesh>
      {/* Spline detail overlay */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[AXLE_R * 1.03, AXLE_R * 1.03, length * 0.15, 24]} />
        <meshStandardMaterial color="#aaa" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FLYWHEEL  — rotates around axle axis (+X), same direction as tire
// ═══════════════════════════════════════════════════════════════════════════
function Flywheel({ position, rotationAngle: _unused }: {
  position: [number, number, number]; rotationAngle: number;
}) {
  const ref = useRef<THREE.Group>(null!);
  const geo = useContext(EngineGeometryCtx).current;
  const fwR = geo.fwR;
  const fwThick = geo.fwThick;
  const animRefs = useContext(AnimationRefsCtx);
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = animRefs?.fwRot?.current ?? 0;
  });

  return (
    <group position={position}>
      <group ref={ref}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[fwR, fwR, fwThick, 56]} />
          <meshStandardMaterial color="#6a6a6a" metalness={0.82} roughness={0.18} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[fwR * 0.92, fwR * 0.55, fwThick * 0.3, 48]} />
          <meshStandardMaterial color="#8a8a7a" metalness={0.7} roughness={0.3} />
        </mesh>
        {Array.from({ length: 33 }, (_, i) => {
          const a = (i / 33) * Math.PI * 2;
          return (
            <mesh key={`fwt${i}`} position={[0, Math.cos(a) * (fwR + 0.015), Math.sin(a) * (fwR + 0.015)]} rotation={[a, 0, 0]}>
              <boxGeometry args={[fwThick * 0.7, 0.03, 0.015]} />
              <meshStandardMaterial color="#555" metalness={0.85} roughness={0.15} />
            </mesh>
          );
        })}
        {Array.from({ length: 6 }, (_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const bR = fwR * 0.3;
          return (
            <mesh key={`fwb${i}`} position={[fwThick * 0.55, Math.cos(angle) * bR, Math.sin(angle) * bR]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.03, 0.04, 6]} />
              <meshStandardMaterial color="#444" metalness={0.9} roughness={0.1} />
            </mesh>
          );
        })}
        <mesh rotation={[0, Math.PI / 2, 0]} position={[fwThick * 0.4, 0, 0]}>
          <torusGeometry args={[0.08, 0.015, 6, 16]} />
          <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLUTCH ASSEMBLY  (disc + pressure plate)
// ═══════════════════════════════════════════════════════════════════════════
function ClutchAssembly({
  position, rotationAngle, clutchStatus,
}: {
  position: [number, number, number]; rotationAngle: number; clutchStatus: string;
}) {
  const discRef = useRef<THREE.Group>(null!);
  const geo = useContext(EngineGeometryCtx).current;
  const clutchR = geo.clutchR;
  const ppThick = geo.ppThick;
  const clutchThick = geo.clutchThick;
  const animRefs = useContext(AnimationRefsCtx);

  useFrame(() => {
    if (discRef.current) discRef.current.rotation.x = animRefs?.fwRot?.current ?? 0;
  });

  const isEngaged = clutchStatus === "ENGAGED" || clutchStatus === "SPINNING";
  const discOffset = isEngaged ? 0 : 0.04;

  return (
    <group position={position}>
      <group ref={discRef}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[clutchR, clutchR, ppThick, 36]} />
          <meshStandardMaterial color="#5a5a5a" metalness={0.75} roughness={0.25} />
        </mesh>
        {Array.from({ length: 18 }, (_, i) => {
          const angle = (i / 18) * Math.PI * 2;
          const r = clutchR * 0.45;
          return (
            <mesh key={`ppf${i}`} position={[ppThick * 0.55, Math.cos(angle) * r, Math.sin(angle) * r]} rotation={[angle, 0, Math.PI / 12]}>
              <boxGeometry args={[0.01, clutchR * 0.4, 0.02]} />
              <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
            </mesh>
          );
        })}
      </group>

      <mesh rotation={[0, 0, Math.PI / 2]} position={[discOffset, 0, 0]}>
        <cylinderGeometry args={[clutchR * 0.95, clutchR * 0.35, clutchThick, 36]} />
        <meshStandardMaterial color={isEngaged ? "#4a4a3a" : "#5a5a4a"} metalness={0.3} roughness={0.85} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[discOffset, 0, 0]}>
        <torusGeometry args={[clutchR * 0.72, 0.015, 6, 32]} />
        <meshStandardMaterial color="#3a3a2a" roughness={0.95} />
      </mesh>

      <mesh rotation={[0, Math.PI / 2, 0]} position={[discOffset, 0, 0]}>
        <torusGeometry args={[clutchR * 0.5, 0.008, 4, 24]} />
        <meshBasicMaterial
          color={
            clutchStatus === "ENGAGED" ? "#22cc44"
            : clutchStatus === "SPINNING" ? "#ffaa00"
            : clutchStatus === "DISENGAGED" ? "#cc2222"
            : "#666"
          }
        />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSMISSION CASE (S4C — translucent cutaway)
// ═══════════════════════════════════════════════════════════════════════════
function TransmissionCase({
  position, currentGear,
}: {
  position: [number, number, number]; currentGear: number | string;
}) {
  const geo = useContext(EngineGeometryCtx).current;
  const store = useContext(PropsStoreCtx);
  const transL = geo.transL;
  const transH = geo.transH;
  const transD = geo.transD;
  const diffR = geo.diffR;

  const gearPositions = useMemo(() => {
    const ratios = store.current.gearRatios ?? [3.23, 2.105, 1.458, 1.107, 0.848];
    const numGears = ratios.length;
    const gears: { x: number; r1: number; r2: number; label: string }[] = [];
    for (let i = 0; i < numGears; i++) {
      const t = numGears > 1 ? (i / (numGears - 1)) - 0.5 : 0; // -0.5 to 0.5
      const ratio = ratios[i];
      const maxRatio = Math.max(...ratios);
      const minRatio = Math.min(...ratios);
      const normR = maxRatio > minRatio ? (ratio - minRatio) / (maxRatio - minRatio) : 0.5;
      gears.push({
        x: t * transL * 0.7,
        r1: 0.22 + normR * 0.18,
        r2: 0.48 - normR * 0.18,
        label: String(i + 1),
      });
    }
    return gears;
  }, [store, transL]);

  const gearNum = typeof currentGear === "number" ? currentGear : parseInt(String(currentGear)) || 0;

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[transD, transH * 0.65, transL * 0.55]} />
        <meshPhysicalMaterial color="#35c96e" transparent opacity={0.14} roughness={0.3} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>

      {[-0.4, -0.2, 0, 0.2, 0.4].map((f, i) => (
        <mesh key={`rib${i}`} position={[0, f * transH * 0.3, 0]}>
          <boxGeometry args={[transD * 1.02, 0.02, transL * 0.57]} />
          <meshPhysicalMaterial color="#3ad97e" transparent opacity={0.08} side={THREE.DoubleSide} />
        </mesh>
      ))}

      <mesh rotation={[0, 0, Math.PI / 2]} position={[-transD * 0.15, 0, -transL * 0.35]}>
        <cylinderGeometry args={[transH * 0.36, transH * 0.28, transD * 0.40, 28]} />
        <meshPhysicalMaterial color="#35c96e" transparent opacity={0.12} roughness={0.3} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, -transH * 0.12, transL * 0.22]}>
        <sphereGeometry args={[diffR, 28, 28]} />
        <meshPhysicalMaterial color="#2eb86a" transparent opacity={0.18} roughness={0.25} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>

      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, transL * 0.5, 12]} />
        <meshStandardMaterial color="#aaa" metalness={0.85} roughness={0.15} transparent opacity={0.6} />
      </mesh>

      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, -transH * 0.15, 0]}>
        <cylinderGeometry args={[0.055, 0.055, transL * 0.5, 12]} />
        <meshStandardMaterial color="#999" metalness={0.85} roughness={0.15} transparent opacity={0.5} />
      </mesh>

      {gearPositions.map((gp, i) => {
        const isActive = gearNum === i + 1;
        return (
          <group key={`gear${i}`}>
            <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 0, gp.x]}>
              <torusGeometry args={[gp.r1, 0.025, 8, 24]} />
              <meshStandardMaterial
                color={isActive ? "#44ff88" : "#888"} metalness={0.8} roughness={0.2}
                emissive={isActive ? "#22aa44" : "#000"} emissiveIntensity={isActive ? 0.3 : 0}
              />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]} position={[0, -transH * 0.15, gp.x]}>
              <torusGeometry args={[gp.r2, 0.025, 8, 24]} />
              <meshStandardMaterial
                color={isActive ? "#44ff88" : "#777"} metalness={0.8} roughness={0.2}
                emissive={isActive ? "#22aa44" : "#000"} emissiveIntensity={isActive ? 0.3 : 0}
              />
            </mesh>
          </group>
        );
      })}

      {[-1, 0, 1].map((f, i) => (
        <mesh key={`fork${i}`} position={[0, transH * 0.15, f * transL * 0.12]}>
          <boxGeometry args={[0.03, transH * 0.25, 0.04]} />
          <meshStandardMaterial color="#bbb" metalness={0.8} roughness={0.2} transparent opacity={0.5} />
        </mesh>
      ))}

      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, transH * 0.2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, transL * 0.45, 8]} />
        <meshStandardMaterial color="#ccc" metalness={0.9} roughness={0.1} transparent opacity={0.4} />
      </mesh>

      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const boltR = transH * 0.3;
        return (
          <mesh key={`tbolt${i}`} position={[-transD * 0.35, Math.cos(angle) * boltR, -transL * 0.35 + Math.sin(angle) * boltR]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.06, 6]} />
            <meshStandardMaterial color="#555" metalness={0.9} roughness={0.1} />
          </mesh>
        );
      })}

      <mesh position={[transD * 0.45, -transH * 0.1, transL * 0.15]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0.04, 0.035, 0.3, 8]} />
        <meshStandardMaterial color="#222" roughness={0.8} />
      </mesh>

      <mesh position={[0, -transH * 0.34, transL * 0.05]}>
        <cylinderGeometry args={[0.04, 0.04, 0.06, 6]} />
        <meshStandardMaterial color="#555" metalness={0.85} roughness={0.15} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA CONTROLLER  (smooth preset transitions without remounting Canvas)
// ═══════════════════════════════════════════════════════════════════════════
function CameraController({ presetIndex }: { presetIndex: number }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  React.useEffect(() => {
    const preset = VIEW_PRESETS[presetIndex];
    if (!preset) return;
    camera.position.set(preset.position[0], preset.position[1], preset.position[2]);
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.set(preset.target[0], preset.target[1], preset.target[2]);
      controlsRef.current.update();
    }
  }, [presetIndex, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={2}
      maxDistance={30}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3D LABEL HELPER  (uses Html from drei — no font loading required)
// ═══════════════════════════════════════════════════════════════════════════
const labelStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  userSelect: "none",
  textShadow: "0 0 4px rgba(0,0,0,0.8)",
};

function Label3D({ position, children, color = "#888", fontSize = 11, anchorX = "center" }:
  { position: [number, number, number]; children: React.ReactNode; color?: string; fontSize?: number; anchorX?: string }) {
  return (
    <Html position={position} center={anchorX === "center"} style={{ ...labelStyle, color, fontSize }}>
      {children}
    </Html>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TELEMETRY HUD  (imperative DOM updates via useFrame — no React re-renders)
// ═══════════════════════════════════════════════════════════════════════════
function TelemetryHUD() {
  const store = useContext(PropsStoreCtx);

  // Refs for each text span so we can mutate them imperatively
  const gearRef  = useRef<HTMLSpanElement>(null!);
  const ratioRef = useRef<HTMLSpanElement>(null!);
  const dtRef    = useRef<HTMLSpanElement>(null!);
  const engRef   = useRef<HTMLSpanElement>(null!);
  const tireRef  = useRef<HTMLSpanElement>(null!);
  const clutchRef = useRef<HTMLSpanElement>(null!);
  const clutchSlipRef = useRef<HTMLSpanElement>(null!);
  const tireSlipRef = useRef<HTMLSpanElement>(null!);

  const engNameRef = useRef<HTMLSpanElement>(null!);

  useFrame(() => {
    const p = store.current;
    const safeRpm = sn(p.rpm);
    const safeTireRpm = sn(p.tireRpm);
    const safeSlip = sn(p.slipPct);
    const safeRatio = sn(p.currentGearRatio);
    const safeClutchSlip = sn(p.clutchSlipPct);
    const gearLabel = p.currentGear === 0 ? "N" : String(p.currentGear);

    if (gearRef.current)  gearRef.current.textContent = gearLabel;
    if (ratioRef.current) ratioRef.current.textContent = safeRatio > 0 ? `${safeRatio.toFixed(3)} : 1` : "NEUTRAL";
    if (dtRef.current)    dtRef.current.textContent = p.drivetrainType || "FWD";
    if (engRef.current)   engRef.current.textContent = `ENGINE  ${Math.round(safeRpm)} RPM`;
    if (tireRef.current)  tireRef.current.textContent = `TIRE    ${Math.round(safeTireRpm)} RPM`;
    if (engNameRef.current) engNameRef.current.textContent = p.engineName || 'ENGINE';

    const clutchColor =
      p.clutchStatus === "ENGAGED" ? "#22cc44"
      : p.clutchStatus === "SLIPPING" ? "#ff4444"
      : p.clutchStatus === "SPINNING" ? "#ffaa00"
      : p.clutchStatus === "DISENGAGED" ? "#cc2222"
      : p.clutchStatus === "SHIFTING" ? "#4488ff"
      : "#666";
    if (clutchRef.current) {
      clutchRef.current.textContent = `CLUTCH: ${p.clutchStatus}`;
      clutchRef.current.style.color = clutchColor;
    }
    if (clutchSlipRef.current) {
      clutchSlipRef.current.textContent = `CLUTCH SLIP: ${safeClutchSlip.toFixed(1)}%`;
      clutchSlipRef.current.style.color = safeClutchSlip > 5 ? "#ff4444" : safeClutchSlip > 1 ? "#ffaa00" : "#888";
    }
    if (tireSlipRef.current) {
      tireSlipRef.current.textContent = `TIRE SLIP: ${safeSlip.toFixed(1)}%`;
      tireSlipRef.current.style.color = safeSlip > 10 ? "#ff6644" : safeSlip > 3 ? "#ffaa00" : "#888";
    }
  });

  return (
    <group position={[0, 4.5, 0]}>
      <Html position={[0, 0, 0]} center style={labelStyle}><span ref={gearRef} style={{ color: "#a3e635", fontSize: 28 }}>N</span></Html>
      <Html position={[0, -0.55, 0]} center style={labelStyle}><span ref={ratioRef} style={{ color: "#6ee7b7", fontSize: 11 }}>NEUTRAL</span></Html>
      <Html position={[0, -0.85, 0]} center style={labelStyle}><span ref={dtRef} style={{ color: "#7dd3fc", fontSize: 9 }}>FWD</span></Html>
      <Html position={[-4, 0.15, 0]} center style={labelStyle}><span ref={engNameRef} style={{ color: "#4488cc", fontSize: 12 }}>ENGINE</span></Html>
      <Html position={[-4, -0.2, 0]} center style={labelStyle}><span ref={engRef} style={{ color: "#f0f0f0", fontSize: 12 }}>ENGINE  0 RPM</span></Html>
      <Html position={[-4, -0.55, 0]} center style={labelStyle}><span ref={tireRef} style={{ color: "#aaa", fontSize: 10 }}>TIRE    0 RPM</span></Html>
      <Html position={[4, -0.2, 0]} center style={labelStyle}><span ref={clutchRef} style={{ color: "#666", fontSize: 10 }}>CLUTCH: ---</span></Html>
      <Html position={[4, -0.55, 0]} center style={labelStyle}><span ref={clutchSlipRef} style={{ color: "#888", fontSize: 10 }}>CLUTCH SLIP: 0.0%</span></Html>
      <Html position={[4, -0.9, 0]} center style={labelStyle}><span ref={tireSlipRef} style={{ color: "#888", fontSize: 10 }}>TIRE SLIP: 0.0%</span></Html>
      <mesh position={[0, -1.1, 0]}>
        <boxGeometry args={[9, 0.01, 0.01]} />
        <meshBasicMaterial color="#333" />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LABELS + DIMENSION LINES
// ═══════════════════════════════════════════════════════════════════════════
function ComponentLabels({
  tirePos, hubPos, shaftCenterX, innerCvX, outerCvX, transPos, fwPos,
}: {
  tirePos: number; hubPos: number; shaftCenterX: number;
  innerCvX: number; outerCvX: number; transPos: number; fwPos: number;
}) {
  const store = useContext(PropsStoreCtx);
  const p = store.current;
  const tw = p.tireWidthMm || 195;
  const ar = p.tireAspectRatio || 55;
  const wd = p.wheelDiameterIn || 15;
  const tireDiaInch = ((tw * (ar / 100) * 2) / 25.4 + wd).toFixed(1);
  const tireSpec = `${tw}/${ar}R${wd}`;
  const transName = p.transmissionName || 'TRANSMISSION';
  const gearCount = p.gearRatios?.length || 5;
  const finalDrive = (p.finalDriveRatio || 4.4).toFixed(3);
  const labelY = -4.2;
  return (
    <group>
      <Label3D position={[tirePos, labelY, 0]} color="#666">{tireSpec}</Label3D>
      <Label3D position={[tirePos, labelY - 0.3, 0]} color="#555" fontSize={9}>{tireDiaInch}&quot; DIA</Label3D>
      <Label3D position={[hubPos, labelY, 0]} color="#666">HUB / KNUCKLE</Label3D>
      <Label3D position={[outerCvX, labelY, 0]} color="#666">RZEPPA (OUTER)</Label3D>
      <Label3D position={[shaftCenterX, labelY + 1.8, 0]} color="#666">CV HALF-SHAFT (DRIVER) 345mm</Label3D>
      <Label3D position={[innerCvX, labelY, 0]} color="#666">TRIPOD (INNER)</Label3D>
      <Label3D position={[transPos, labelY, 0]} color="#5ae895" fontSize={12}>{transName} {gearCount}-SPEED</Label3D>
      <Label3D position={[transPos, labelY - 0.3, 0]} color="#4ac07a" fontSize={9}>FINAL DRIVE {finalDrive}</Label3D>
      <Label3D position={[fwPos, labelY, 0]} color="#666">FLYWHEEL</Label3D>
      <Label3D position={[fwPos, labelY - 0.3, 0]} color="#555" fontSize={9}>131T RING GEAR</Label3D>
    </group>
  );
}

function DimensionLine({
  from, to, label, color,
}: {
  from: [number, number, number]; to: [number, number, number];
  label: string; color?: string;
}) {
  const c = color || "#555";
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  const midZ = (from[2] + to[2]) / 2;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return (
    <group>
      <mesh position={[midX, midY, midZ]} rotation={[0, 0, Math.atan2(dy, dx)]}>
        <boxGeometry args={[length, 0.008, 0.008]} />
        <meshBasicMaterial color={c} />
      </mesh>
      {[from, to].map((pt, i) => (
        <mesh key={i} position={[pt[0], pt[1], pt[2]]}>
          <boxGeometry args={[0.008, 0.15, 0.008]} />
          <meshBasicMaterial color={c} />
        </mesh>
      ))}
      <Label3D position={[midX, midY + 0.15, midZ]} color={c} fontSize={9}>{label}</Label3D>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHIFT LINKAGE SYSTEM (Honda Civic EK — mechanical rod, ball-pivot)
// ═══════════════════════════════════════════════════════════════════════════
// OEM Honda S4C/Y21 5-speed shift linkage (rod-type, NOT cable):
//
//   1. Ball-pivot shift lever in cabin
//      - OEM parts: seat 54110-SH3-003, holder 54111-SH3-000
//      - Spherical ball ∅30mm captured in a cup on the floor tunnel
//      - 160mm above ball → knob, 80mm below ball → rod joint
//      - Lever ratio 2:1  (knob travel = 2× rod-end travel)
//
//   2. Change rod (54201-S04-G10) + Extension (54301-S04-G10)
//      - Rigid rod from lever bottom, forward under floor tunnel
//      - Through firewall to transmission external shift arm
//      - Transmits TWO DOF simultaneously:
//        a) Rod ROTATION about its own axis → gate selection (1-2 / 3-4 / 5th-R)
//        b) Rod axial PUSH/PULL → gear engagement (odd fwd, even back)
//
//   3. Transmission external shift arm
//      - Converts rod rotation → change holder alignment
//      - Converts rod push/pull → shift fork engagement
//
//   4. Internal: change holder (24400-P21-020) → shift forks
//      - Fork 1-2 (24220-P80-000), Fork 3-4 (24210-P80-V00), Fork 5th-R
//      - Detent ball + spring (24452-P20-000) per rail
//      - Interlock plate prevents double engagement
//
// BeamNG-style constraints: nodes at every joint, rigid beams between them,
// spherical (ball-joint) constraint at lever pivot.
// ═══════════════════════════════════════════════════════════════════════════

// Shift lever dimensions (Honda OEM real specs)
const LEVER_ABOVE       = 1.6;      // 160mm above ball pivot center
const LEVER_BELOW       = 0.8;      // 80mm below ball pivot center
const LEVER_KNOB_R      = 0.12;     // shift knob radius (Honda round LEA type)
const BALL_R            = 0.15;     // ball joint radius (~∅30mm)
const LEVER_SHAFT_TOP_R = 0.025;    // shaft radius at knob end
const LEVER_SHAFT_BOT_R = 0.035;    // shaft radius at ball end

// Linkage rod dimensions
const CHANGE_ROD_R      = 0.06;     // 12mm dia change rod
const ROD_END_BEARING_R = 0.08;     // rod-end bearing (heim joint)

// Cabin reference position (center console, floor tunnel)
const SHIFTER_X = 0;                // centered between seats
const SHIFTER_Y = -1.4;             // floor tunnel height
const SHIFTER_Z = -8.0;             // 800mm behind front axle centerline

// Firewall reference
const FIREWALL_Z = -2.0;

// H-pattern gate knob displacements (Honda 5-speed)
//   1  3  5  (forward = +Z)
//   2  4  R  (backward = -Z)
const GATE_POSITIONS: Record<number, [number, number]> = {
  0: [0, 0],         // Neutral (spring-centered)
  1: [-0.18, 0.12],  // 1st: left gate, forward
  2: [-0.18, -0.12], // 2nd: left gate, back
  3: [0, 0.12],      // 3rd: center gate, forward
  4: [0, -0.12],     // 4th: center gate, back
  5: [0.18, 0.12],   // 5th: right gate, forward
};

// Which shift fork rail is active for each gear
function getActiveForkIdx(gear: number): number {
  if (gear === 1 || gear === 2) return 0;   // fork 1-2
  if (gear === 3 || gear === 4) return 1;   // fork 3-4
  if (gear === 5) return 2;                 // fork 5th-R
  return -1;
}
// Fork axial slide (+X = engage forward, -X = engage backward on mainshaft)
function getForkSlide(gear: number): number {
  if (gear === 1 || gear === 3 || gear === 5) return 0.12;
  if (gear === 2 || gear === 4) return -0.12;
  return 0;
}

// ── Linkage Rod (rigid beam between two 3D nodes) ──────────────────────
// BeamNG "beam" style: cylinder + spherical rod-end bearings at each end
function LinkageRod({
  from, to, radius, color, label,
}: {
  from: [number, number, number]; to: [number, number, number];
  radius: number; color: string; label?: string;
}) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  const midZ = (from[2] + to[2]) / 2;
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return (
    <group>
      <mesh position={[midX, midY, midZ]} rotation={euler}>
        <cylinderGeometry args={[radius, radius, length, 8]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
      {[from, to].map((pt, i) => (
        <mesh key={`re${i}`} position={pt}>
          <sphereGeometry args={[ROD_END_BEARING_R, 8, 8]} />
          <meshStandardMaterial color="#666" metalness={0.75} roughness={0.25} />
        </mesh>
      ))}
      {label && (
        <Label3D position={[midX, midY - 0.25, midZ]} color="#555" fontSize={7}>{label}</Label3D>
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CABIN SHIFTER WITH BALL-PIVOT + FULL MECHANICAL ROD LINKAGE
// ═══════════════════════════════════════════════════════════════════════════
function CabinShifter({
  currentGear, transX,
}: {
  currentGear: number | string; transX: number;
}) {
  const gearNum = typeof currentGear === "number"
    ? currentGear
    : parseInt(String(currentGear)) || 0;
  const [gateX, gateZ] = GATE_POSITIONS[gearNum] || [0, 0];

  // ── KINEMATICS: ball-pivot lever ──
  // Lever tilts at the ball center.  Max angle ≈ atan2(0.18, 1.6) ≈ 6.4°
  const tiltZ = Math.atan2(gateX, LEVER_ABOVE);    // lateral tilt
  const tiltX = -Math.atan2(gateZ, LEVER_ABOVE);   // fore/aft tilt

  // Rod attachment below ball moves OPPOSITE to knob (lever inversion)
  const leverRatio = LEVER_BELOW / LEVER_ABOVE;     // 0.5
  const rodEndX = -gateX * leverRatio;
  const rodEndZ = -gateZ * leverRatio;

  // ── CONSTRAINT NODES (BeamNG-style) ──
  // N0: Ball pivot center (fixed to floor tunnel)
  const N0: [number, number, number] = [SHIFTER_X, SHIFTER_Y, SHIFTER_Z];
  // N1: Lever bottom / rod attach (moves with lever pivot)
  const N1: [number, number, number] = [
    SHIFTER_X + rodEndX,
    SHIFTER_Y - LEVER_BELOW,
    SHIFTER_Z + rodEndZ,
  ];
  // N2: Under-floor tunnel bracket (fixed support, 250mm forward of shifter)
  const bracketY = SHIFTER_Y - LEVER_BELOW - 0.3;
  const N2: [number, number, number] = [0, bracketY, SHIFTER_Z + 2.5];
  // N3: Firewall bracket (fixed, where rod passes through firewall)
  const N3: [number, number, number] = [0, bracketY + 0.15, FIREWALL_Z];
  // N4: Transmission external shift arm (animated end)
  const transArmY = TRANS_H * 0.35;
  const N4: [number, number, number] = [transX + rodEndX * 1.5, transArmY, 0.35];

  // ── TRANS-SIDE DERIVED STATE ──
  const selectAngle = Math.atan2(rodEndX, 0.2) * 1.5;
  const engageSlide = rodEndZ * 1.5;
  const activeFork = getActiveForkIdx(gearNum);
  const forkSlide = getForkSlide(gearNum);

  return (
    <group>
      {/* ════════════════════════════════════════════════════════ */}
      {/* ── CABIN FLOOR & BALL-PIVOT HOUSING (static) ───────── */}
      {/* ════════════════════════════════════════════════════════ */}
      <group position={N0}>
        {/* Center tunnel floor pan */}
        <mesh>
          <boxGeometry args={[1.2, 0.08, 2.5]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.1} />
        </mesh>
        {/* Console surround / trim ring */}
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.5, 0.04, 0.6]} />
          <meshStandardMaterial color="#111" roughness={0.85} metalness={0.2} />
        </mesh>
        {/* Gate plate (aluminum) */}
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.6, 0.02, 0.5]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* H-pattern slot cutouts */}
        {[[-0.18, 0], [0, 0], [0.18, 0]].map(([gx], i) => (
          <mesh key={`slot${i}`} position={[gx, 0.115, 0]}>
            <boxGeometry args={[0.04, 0.015, 0.3]} />
            <meshStandardMaterial color="#333" roughness={0.9} />
          </mesh>
        ))}
        {/* Crossgate (horizontal connector between slot columns) */}
        <mesh position={[0, 0.115, 0]}>
          <boxGeometry args={[0.5, 0.015, 0.04]} />
          <meshStandardMaterial color="#333" roughness={0.9} />
        </mesh>

        {/* Ball pivot housing (bolted cylinder on tunnel floor) */}
        <mesh position={[0, -0.04, 0]}>
          <cylinderGeometry args={[0.22, 0.24, 0.18, 16]} />
          <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Ball seat cup (concave, captures the ball from below) */}
        <mesh position={[0, -0.06, 0]} rotation={[Math.PI, 0, 0]}>
          <sphereGeometry args={[BALL_R + 0.03, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color="#555" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        {/* Thrust washers (×2, sandwich the ball) */}
        {[-0.01, 0.01].map((dy, i) => (
          <mesh key={`tw${i}`} position={[0, dy, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[BALL_R - 0.02, 0.015, 6, 16]} />
            <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
        {/* Dust seal A (rubber, top side) */}
        <mesh position={[0, 0.025, 0]}>
          <torusGeometry args={[0.06, 0.02, 8, 16]} />
          <meshStandardMaterial color="#222" roughness={0.95} />
        </mesh>

        {/* ══════════════════════════════════════════════════ */}
        {/* ── LEVER: PIVOTS at ball center (rotation group) */}
        {/* Group origin = ball center. rotation = tilt.     */}
        {/* Everything above & below moves with the pivot.   */}
        {/* ══════════════════════════════════════════════════ */}
        <group rotation={[tiltX, 0, tiltZ]}>
          {/* Ball sphere (the physical ball joint) */}
          <mesh>
            <sphereGeometry args={[BALL_R, 16, 12]} />
            <meshStandardMaterial color="#999" metalness={0.9} roughness={0.1} />
          </mesh>

          {/* ── ABOVE BALL: lever shaft → shift knob ── */}
          <mesh position={[0, LEVER_ABOVE * 0.5, 0]}>
            <cylinderGeometry args={[LEVER_SHAFT_TOP_R, LEVER_SHAFT_BOT_R, LEVER_ABOVE, 8]} />
            <meshStandardMaterial color="#888" metalness={0.85} roughness={0.15} />
          </mesh>
          {/* Shift knob (Honda round type, 54102-S30-N21) */}
          <mesh position={[0, LEVER_ABOVE + 0.05, 0]}>
            <sphereGeometry args={[LEVER_KNOB_R, 16, 12]} />
            <meshStandardMaterial color="#222" roughness={0.6} metalness={0.2} />
          </mesh>

          {/* ── BELOW BALL: lever arm → rod joint ── */}
          <mesh position={[0, -LEVER_BELOW * 0.5, 0]}>
            <cylinderGeometry args={[LEVER_SHAFT_BOT_R, 0.04, LEVER_BELOW, 8]} />
            <meshStandardMaterial color="#777" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Rod-end bearing (heim joint) at lever bottom */}
          <mesh position={[0, -LEVER_BELOW, 0]}>
            <sphereGeometry args={[ROD_END_BEARING_R, 10, 10]} />
            <meshStandardMaterial color="#666" metalness={0.75} roughness={0.25} />
          </mesh>
          {/* Rear joint collar (54117-SH3-000) */}
          <mesh position={[0, -LEVER_BELOW + 0.04, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.06, 8]} />
            <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>

        {/* Leather shift boot (static on housing, outside pivot group) */}
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.14, 0.06, 0.3, 12]} />
          <meshStandardMaterial color="#111" roughness={0.95} />
        </mesh>

        <Label3D position={[0, -0.55, 0]} color="#555" fontSize={9}>
          BALL-PIVOT SHIFTER (54110-SH3)
        </Label3D>
      </group>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ── CHANGE ROD  (N1 → N2: lever bottom → floor bracket) */}
      {/* OEM 54201-S04-G10 "Rod, Change"                        */}
      {/* ════════════════════════════════════════════════════════ */}
      <LinkageRod from={N1} to={N2} radius={CHANGE_ROD_R} color="#999" label="CHANGE ROD" />

      {/* Floor tunnel bracket (static support mount) */}
      <group position={N2}>
        <mesh>
          <boxGeometry args={[0.28, 0.12, 0.08]} />
          <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh>
          <torusGeometry args={[CHANGE_ROD_R * 1.5, 0.02, 8, 12]} />
          <meshStandardMaterial color="#222" roughness={0.95} />
        </mesh>
      </group>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ── EXTENSION ROD (N2 → N3: bracket → firewall)         */}
      {/* OEM 54301-S04-G10 "Extension, Change"                  */}
      {/* ════════════════════════════════════════════════════════ */}
      <LinkageRod from={N2} to={N3} radius={CHANGE_ROD_R} color="#aaa" />

      {/* Firewall bracket + rubber grommet + boot */}
      <group position={N3}>
        <mesh>
          <boxGeometry args={[0.35, 0.18, 0.1]} />
          <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[CHANGE_ROD_R * 1.8, 0.03, 8, 16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
        </mesh>
        {/* Shift rod boot (24316-PS1-000) */}
        <mesh position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[CHANGE_ROD_R * 2.2, CHANGE_ROD_R * 1.5, 0.12, 10]} />
          <meshStandardMaterial color="#222" roughness={0.9} />
        </mesh>
        <Label3D position={[0, -0.25, 0]} color="#555" fontSize={8}>FIREWALL</Label3D>
      </group>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ── ENGINE-BAY ROD (N3 → N4: firewall → trans arm)      */}
      {/* ════════════════════════════════════════════════════════ */}
      <LinkageRod from={N3} to={N4} radius={CHANGE_ROD_R} color="#bbb" label="EXTENSION" />

      {/* ════════════════════════════════════════════════════════ */}
      {/* ── TRANSMISSION EXTERNAL SHIFT ARM ──────────────────── */}
      {/* ════════════════════════════════════════════════════════ */}
      <group position={[transX, transArmY, 0.35]}>
        {/* Mounting bracket (bolted to trans case top) */}
        <mesh>
          <boxGeometry args={[0.25, 0.12, 0.15]} />
          <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* External arm (animated — rotates for gate select) */}
        <group rotation={[0, 0, selectAngle]}>
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[0.05, 0.25, 0.04]} />
            <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Arm pivot pin */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.18, 8]} />
            <meshStandardMaterial color="#888" metalness={0.85} roughness={0.15} />
          </mesh>
        </group>
        {/* Shift shaft (enters trans case — animated axial slide for engage) */}
        <mesh position={[0, -0.12, engageSlide]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.25, 8]} />
          <meshStandardMaterial color="#ccc" metalness={0.9} roughness={0.1} />
        </mesh>
        {/* Shaft oil seal */}
        <mesh position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.04, 0.012, 6, 12]} />
          <meshStandardMaterial color="#222" roughness={0.9} />
        </mesh>
        <Label3D position={[0, 0.42, 0]} color="#555" fontSize={8}>SHIFT ARM</Label3D>
      </group>

      {/* ════════════════════════════════════════════════════════ */}
      {/* ── TRANSMISSION INTERNAL SHIFT FORKS (animated)         */}
      {/* These overlay the existing TransmissionCase forks with  */}
      {/* physically accurate per-gear engagement animation.      */}
      {/* ════════════════════════════════════════════════════════ */}
      <group position={[transX, 0, 0]}>
        {[0, 1, 2].map((forkIdx) => {
          const railZ = (forkIdx - 1) * TRANS_L * 0.12;
          const isActive = forkIdx === activeFork;
          const slide = isActive ? forkSlide : 0;
          const forkColor = isActive ? "#44ff88" : "#999";
          const forkEmissive = isActive ? "#22aa44" : "#000";
          const forkLabels = ["FORK 1-2", "FORK 3-4", "FORK 5-R"];
          return (
            <group key={`afork${forkIdx}`}>
              {/* Fork body (slides along rail) */}
              <mesh position={[slide, TRANS_H * 0.16, railZ]}>
                <boxGeometry args={[0.04, TRANS_H * 0.26, 0.05]} />
                <meshStandardMaterial
                  color={forkColor} metalness={0.8} roughness={0.2}
                  emissive={forkEmissive} emissiveIntensity={isActive ? 0.5 : 0}
                />
              </mesh>
              {/* Fork prongs (Y-shape straddling synchronizer sleeve) */}
              {[-1, 1].map((side) => (
                <mesh
                  key={`prong${forkIdx}_${side}`}
                  position={[slide, TRANS_H * 0.08, railZ + side * 0.06]}
                >
                  <boxGeometry args={[0.03, 0.06, 0.025]} />
                  <meshStandardMaterial
                    color={forkColor} metalness={0.75} roughness={0.25}
                    emissive={forkEmissive} emissiveIntensity={isActive ? 0.4 : 0}
                  />
                </mesh>
              ))}
              {/* Shift fork rail (the rod the fork rides on) */}
              <mesh rotation={[0, 0, Math.PI / 2]} position={[0, TRANS_H * 0.16, railZ]}>
                <cylinderGeometry args={[0.015, 0.015, TRANS_L * 0.35, 6]} />
                <meshStandardMaterial color="#888" metalness={0.85} roughness={0.15} transparent opacity={0.4} />
              </mesh>
              {/* Detent ball + spring (click-locks into gear position) */}
              <mesh position={[0, TRANS_H * 0.3, railZ]}>
                <sphereGeometry args={[0.02, 8, 8]} />
                <meshStandardMaterial
                  color={isActive ? "#ffcc00" : "#aaa"} metalness={0.9} roughness={0.1}
                />
              </mesh>
              {/* Detent spring (compressed when ball is pushed down) */}
              <mesh position={[0, TRANS_H * 0.34, railZ]}>
                <cylinderGeometry args={[0.012, 0.012, 0.06, 6]} />
                <meshStandardMaterial color="#bbb" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Fork label */}
              <Label3D position={[0, TRANS_H * 0.42, railZ]} color={isActive ? "#44ff88" : "#666"} fontSize={6}>
                {forkLabels[forkIdx]}
              </Label3D>
            </group>
          );
        })}
        {/* Interlock plate (prevents two forks engaging simultaneously) */}
        <mesh position={[0, TRANS_H * 0.24, 0]}>
          <boxGeometry args={[0.02, 0.08, TRANS_L * 0.35]} />
          <meshStandardMaterial color="#aaa" metalness={0.7} roughness={0.3} transparent opacity={0.6} />
        </mesh>
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WHEEL CORNER ASSEMBLY  (full tire+brake+suspension for any corner)
// Uses the refined TireAndWheel + BrakeAssembly + HubKnuckleSuspension.
// For 'left' side: mirrors via scale=[-1,1,1] so outboard faces correct way.
// Three.js WebGLRenderer automatically handles face-winding for negative scale.
// ═══════════════════════════════════════════════════════════════════════════
function WheelCornerAssembly({
  position, rotationAngle, side, showSuspension = true, compression = 0,
}: {
  position: [number, number, number]; rotationAngle: number;
  side: 'left' | 'right'; showSuspension?: boolean;
  compression?: number;
}) {
  const mirror: [number, number, number] = side === 'left' ? [-1, 1, 1] : [1, 1, 1];
  return (
    <group position={position} scale={mirror}>
      {/* Tire + Wheel at origin */}
      <TireAndWheel rotationAngle={rotationAngle} />
      {/* Brake assembly — at hub face, ET-offset inboard of wheel center */}
      <group position={[-WHEEL_ET, 0, 0]}>
        <BrakeAssembly rotationAngle={rotationAngle} />
      </group>
      {/* Hub / Knuckle / McPherson strut / LCA / tie rod / sway bar */}
      {showSuspension && (
        <HubKnuckleSuspension position={[-(WHEEL_ET + 10 * S), 0, 0]} compression={compression} />
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REAR AXLE / DRIVESHAFT (for RWD/AWD configurations)
// ═══════════════════════════════════════════════════════════════════════════
// Civic wheelbase: 2620mm. Rear axle sits ~2620mm behind front axle.
const WHEELBASE_SCENE = 2620 * S; // 26.2 scene units
const REAR_AXLE_Z = -WHEELBASE_SCENE;
const PROPSHAFT_R = 0.06;

function PropShaft({
  from, to, rotationAngle: _unused, active,
}: {
  from: [number, number, number]; to: [number, number, number];
  rotationAngle: number; active: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const animRefs = useContext(AnimationRefsCtx);
  useFrame(() => { if (ref.current && active) ref.current.rotation.z = animRefs?.fwRot?.current ?? 0; });
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  const midZ = (from[2] + to[2]) / 2;
  // Rotation to align cylinder along from→to
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);
  return (
    <group>
      <mesh ref={ref} position={[midX, midY, midZ]} rotation={euler}>
        <cylinderGeometry args={[PROPSHAFT_R, PROPSHAFT_R, length, 12]} />
        <meshStandardMaterial
          color={active ? "#aaa" : "#666"}
          metalness={0.85}
          roughness={0.15}
        />
      </mesh>
      {/* U-joints at each end */}
      {[from, to].map((pt, i) => (
        <mesh key={`uj${i}`} position={pt}>
          <sphereGeometry args={[PROPSHAFT_R * 1.5, 8, 8]} />
          <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function RearDifferential({
  position, rotationAngle: _unused, diffType, active,
}: {
  position: [number, number, number]; rotationAngle: number;
  diffType: string; active: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const animRefs = useContext(AnimationRefsCtx);
  useFrame(() => { if (ref.current && active) ref.current.rotation.x = (animRefs?.tireRot?.current ?? 0) * 0.3; });
  const diffColor = diffType === 'locked' ? '#44ff88' : diffType === 'lsd' ? '#ffaa00' : '#888';
  return (
    <group position={position}>
      {/* Diff housing */}
      <mesh ref={ref}>
        <sphereGeometry args={[DIFF_R * 1.5, 20, 20]} />
        <meshPhysicalMaterial
          color="#3a3a3a"
          transparent
          opacity={0.35}
          metalness={0.5}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Ring gear */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[DIFF_R * 1.2, 0.03, 8, 24]} />
        <meshStandardMaterial color={diffColor} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Type label */}
      <Label3D position={[0, -DIFF_R * 2, 0]} color={diffColor} fontSize={9}>
        {`${diffType.toUpperCase()} DIFF`}
      </Label3D>
    </group>
  );
}

function RearAxleAssembly({
  rotationAngle, drivetrainType, rearDiffType, compression = 0,
}: {
  rotationAngle: number;
  drivetrainType: string; rearDiffType: string;
  compression?: number;
}) {
  const isRearDriven = drivetrainType === 'RWD' || drivetrainType === 'AWD';
  const rearZ = REAR_AXLE_Z;
  // Rear wheels spread symmetrically — rear track is 1460mm (slightly narrower than front)
  const rearTireX_R = HALF_TRACK_R;
  const rearTireX_L = -HALF_TRACK_R;

  return (
    <group position={[0, 0, rearZ]}>
      {/* Rear right wheel — full assembly facing outward */}
      <WheelCornerAssembly
        position={[rearTireX_R, 0, 0]}
        rotationAngle={isRearDriven ? rotationAngle : rotationAngle * 0.95}
        side="right"
        compression={compression}
      />
      {/* Rear left wheel — full assembly mirrored outward */}
      <WheelCornerAssembly
        position={[rearTireX_L, 0, 0]}
        rotationAngle={isRearDriven ? rotationAngle : rotationAngle * 0.95}
        side="left"
        compression={compression}
      />

      {isRearDriven && (
        <>
          {/* Rear differential */}
          <RearDifferential
            position={[0, -0.2, 0]}
            rotationAngle={rotationAngle}
            diffType={rearDiffType}
            active={true}
          />
          {/* Rear right half-shaft (diff → right wheel) */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[rearTireX_R * 0.42, 0, 0]}>
            <cylinderGeometry args={[AXLE_R, AXLE_R, rearTireX_R * 0.72, 12]} />
            <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Rear left half-shaft (diff → left wheel) */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[rearTireX_L * 0.42, 0, 0]}>
            <cylinderGeometry args={[AXLE_R, AXLE_R, rearTireX_R * 0.72, 12]} />
            <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.2} />
          </mesh>
        </>
      )}

      {!isRearDriven && (
        <>
          {/* Rear torsion beam (non-driven — solid axle tube) */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0, -0.6, 0]}>
            <cylinderGeometry args={[0.06, 0.06, rearTireX_R * 1.6, 8]} />
            <meshStandardMaterial color="#555" metalness={0.6} roughness={0.4} />
          </mesh>
          <Label3D position={[0, -1.5, 0]} color="#555" fontSize={9}>TORSION BEAM</Label3D>
        </>
      )}

      <Label3D position={[0, -TIRE_OR - 0.8, 0]} color="#666" fontSize={11}>REAR AXLE</Label3D>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPSHAFT (connects transmission to rear diff for RWD/AWD)
// ═══════════════════════════════════════════════════════════════════════════
function MainPropShaft({
  transX, rotationAngle, active,
}: {
  transX: number; rotationAngle: number; active: boolean;
}) {
  if (!active) return null;
  const rearZ = REAR_AXLE_Z;
  return (
    <PropShaft
      from={[transX, -0.3, -0.5]}
      to={[0, -0.3, rearZ + 0.5]}
      rotationAngle={rotationAngle}
      active={true}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PASSENGER FRONT WHEEL (mirrored left side with full CV assembly)
// ═══════════════════════════════════════════════════════════════════════════
function PassengerFrontAssembly({
  tireX, transX, rotationAngle, isFrontDriven, compression = 0,
}: {
  tireX: number; transX: number;
  rotationAngle: number; isFrontDriven: boolean;
  compression?: number;
}) {
  // Passenger-side positions: mirrored from driver (negative X)
  // In a FWD Honda, the passenger half-shaft is the LONG one (~870mm)
  // because it must reach from the trans differential to the far-side wheel.
  const pTireX = -tireX;
  // Hub is inboard of tire by the ET offset (toward center = positive X)
  const pHubX = pTireX + WHEEL_ET;
  // Outer CV (Rzeppa) sits just inboard of the hub bearing
  const pOuterCvX = pHubX + HUB_INBOARD_TO_CV;
  // Inner CV (Tripod) — use PASS_AXLE_LEN to place it correctly
  // so the rendered shaft matches the 870mm real half-shaft.
  const pInnerCvX = pOuterCvX + PASS_AXLE_LEN - CV_LEN;
  // Shaft runs between inner and outer CV joints
  const pShaftMidX = (pOuterCvX + pInnerCvX) / 2;
  const pShaftLen = Math.abs(pOuterCvX - pInnerCvX) - CV_LEN;

  // Intermediate shaft bearing bracket (Honda uses one on the long passenger half-shaft)
  // Mounted roughly halfway along the shaft to the engine block
  const intermBearingX = (pOuterCvX + pInnerCvX) / 2;

  return (
    <group>
      {/* Full wheel + brake + suspension — mirrored for left side */}
      <WheelCornerAssembly
        position={[pTireX, 0, 0]}
        rotationAngle={rotationAngle}
        side="left"
        compression={compression}
      />

      {isFrontDriven && (
        <>
          {/* Outer CV joint (Rzeppa) — wheel end */}
          <CVJoint position={[pOuterCvX, 0, 0]} rotationAngle={rotationAngle} type="rzeppa" />
          {/* Outer CV boot */}
          <CVBoot
            length={BOOT_LEN}
            innerR={AXLE_R * 1.6}
            outerR={CV_R * 0.75}
            position={[pOuterCvX + CV_LEN * 0.5, 0, 0]}
            flipDirection={false}
          />
          {/* Axle shaft (long passenger half-shaft) */}
          <AxleShaft position={[pShaftMidX, 0, 0]} length={Math.max(pShaftLen, 0.3)} />
          {/* Intermediate shaft bearing — stabilizes the long passenger shaft */}
          <group position={[intermBearingX, 0, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[AXLE_R * 2.5, AXLE_R * 2.5, 0.15, 12]} />
              <meshStandardMaterial color="#444" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Bearing bracket to block */}
            <mesh position={[0, 0.25, 0]}>
              <boxGeometry args={[0.08, 0.5, 0.15]} />
              <meshStandardMaterial color="#3a3a3a" metalness={0.5} roughness={0.5} />
            </mesh>
          </group>
          {/* Inner CV boot */}
          <CVBoot
            length={BOOT_LEN}
            innerR={AXLE_R * 1.6}
            outerR={CV_R * 0.75}
            position={[pInnerCvX - CV_LEN * 0.5, 0, 0]}
            flipDirection={true}
          />
          {/* Inner CV joint (Tripod) — trans end */}
          <CVJoint position={[pInnerCvX, 0, 0]} rotationAngle={rotationAngle} type="tripod" />

          {/* Dimension line for passenger half-shaft */}
          <Label3D position={[pShaftMidX, -1.5, 0]} color="#5a5a5a" fontSize={8}>
            {`${Math.round(pShaftLen / S)}mm (passenger)`}
          </Label3D>
        </>
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED VALVE ASSEMBLY — 4 per cylinder (2 intake + 2 exhaust)
// Each valve opens/closes based on crank angle + firing order phase offset
// Now reads rotation from AnimationRefsCtx for proper frame-by-frame sync
// ═══════════════════════════════════════════════════════════════════════════
function ValveAssembly({
  cylinderX, phaseAngle, isIntake,
}: {
  cylinderX: number; phaseAngle: number; isIntake: boolean;
}) {
  const valve1Ref = useRef<THREE.Group>(null!);
  const valve2Ref = useRef<THREE.Group>(null!);
  const spring1Ref = useRef<THREE.Mesh>(null!);
  const spring2Ref = useRef<THREE.Mesh>(null!);
  const animRefs = useContext(AnimationRefsCtx);

  const dia = isIntake ? INTAKE_VALVE_DIA : EXHAUST_VALVE_DIA;
  const zOff = isIntake ? INTAKE_VALVE_Z_OFFSET : EXHAUST_VALVE_Z_OFFSET;
  const color = isIntake ? '#3b82f6' : '#ef4444';

  useFrame(() => {
    // Read current rotation from shared ref for frame-accurate sync
    const rotationAngle = animRefs?.fwRot?.current ?? 0;
    const crankAngleDeg = ((rotationAngle + phaseAngle) * 180 / Math.PI);
    const liftMm = getValveLift3D(crankAngleDeg, isIntake);
    const liftScene = liftMm * S;
    // Two valves per side, slight x offset from bore center
    if (valve1Ref.current) valve1Ref.current.position.y = -liftScene;
    if (valve2Ref.current) valve2Ref.current.position.y = -liftScene;
    // Spring compression
    const springScale = 1 - liftScene / (VALVE_MAX_LIFT * 1.2);
    if (spring1Ref.current) spring1Ref.current.scale.y = Math.max(0.6, springScale);
    if (spring2Ref.current) spring2Ref.current.scale.y = Math.max(0.6, springScale);
  });

  const valveXOffsets = [-0.08, 0.08]; // two valves per side

  return (
    <group position={[cylinderX, BLOCK_DECK_H + HEAD_H * 0.3, zOff]}>
      {valveXOffsets.map((vx, vi) => (
        <group key={vi} position={[vx, 0, 0]}>
          {/* Valve (moves down when opening) */}
          <group ref={vi === 0 ? valve1Ref : valve2Ref}>
            {/* Valve head (tulip) */}
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[dia / 2, dia / 2 * 0.85, VALVE_HEAD_THICK, 16]} />
              <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Valve stem */}
            <mesh position={[0, VALVE_STEM_LEN / 2 + VALVE_HEAD_THICK / 2, 0]}>
              <cylinderGeometry args={[VALVE_STEM_DIA / 2, VALVE_STEM_DIA / 2, VALVE_STEM_LEN, 8]} />
              <meshStandardMaterial color="#ccc" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
          {/* Valve spring (compresses with lift) */}
          <mesh ref={vi === 0 ? spring1Ref : spring2Ref} position={[0, VALVE_STEM_LEN * 0.5, 0]}>
            <cylinderGeometry args={[VALVE_SPRING_OR, VALVE_SPRING_IR, VALVE_STEM_LEN * 0.5, 12, 1, true]} />
            <meshStandardMaterial color="#44aa44" metalness={0.5} roughness={0.4} transparent opacity={0.5} wireframe />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMBUSTION CYCLE VISUALIZATION — per-cylinder glow inside bore
// Blue (intake) → Yellow (compression) → Orange/Red (power) → Gray (exhaust)
// Now reads rotation from AnimationRefsCtx for proper frame-by-frame sync
// ═══════════════════════════════════════════════════════════════════════════
function CombustionEffect({
  cylinderX, phaseAngle, throttle,
}: {
  cylinderX: number; phaseAngle: number; throttle: number;
}) {
  const animRefs = useContext(AnimationRefsCtx);
  const glowRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);

  const PHASE_COLORS = useMemo(() => [
    new THREE.Color('#3388ff'),  // 0=INTAKE (blue)
    new THREE.Color('#ffcc22'),  // 1=COMPRESSION (yellow)
    new THREE.Color('#ff4422'),  // 2=POWER (orange-red)
    new THREE.Color('#666666'),  // 3=EXHAUST (gray)
  ], []);

  useFrame(() => {
    // Read current rotation from shared ref for frame-accurate sync
    const rotationAngle = animRefs?.fwRot?.current ?? 0;
    const crankAngleDeg = ((rotationAngle + phaseAngle) * 180 / Math.PI);
    const phase = getStrokePhase3D(crankAngleDeg);
    const pressure = getCylPressure3D(crankAngleDeg, throttle);
    if (matRef.current) {
      matRef.current.color.copy(PHASE_COLORS[phase]);
      // Opacity from pressure: low during intake, high during power
      matRef.current.opacity = phase === 2
        ? 0.15 + pressure * 0.55  // power stroke: bright bloom
        : phase === 1
          ? 0.05 + pressure * 0.25  // compression: moderate glow
          : 0.04;  // intake/exhaust: faint
    }
    // Scale Y (vertical fill inside bore) based on piston position
    if (glowRef.current) {
      const fillH = phase === 0 ? 0.6 : phase === 1 ? 0.3 : phase === 2 ? 0.8 : 0.5;
      glowRef.current.scale.y = fillH;
    }
  });

  return (
    <mesh
      ref={glowRef}
      position={[cylinderX, BLOCK_DECK_H * 0.7, 0]}
    >
      <cylinderGeometry args={[BORE / 2 * 0.85, BORE / 2 * 0.85, BLOCK_DECK_H * 0.4, 16]} />
      <meshBasicMaterial
        ref={matRef}
        transparent
        opacity={0.05}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXHAUST FLAME EFFECT — animated flame particles leaving exhaust valves
// and flowing into the exhaust manifold during the exhaust stroke
// ═══════════════════════════════════════════════════════════════════════════
const FLAME_PARTICLE_COUNT = 6;

function ExhaustFlameEffect({
  cylinderX, phaseAngle, throttle,
}: {
  cylinderX: number; phaseAngle: number; throttle: number;
}) {
  const animRefs = useContext(AnimationRefsCtx);
  const geo = useContext(EngineGeometryCtx);
  const particlesRef = useRef<THREE.Group>(null!);
  const materialsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const meshesRef = useRef<THREE.Mesh[]>([]);

  // Flame colors: hot white-yellow core → orange → red → dark
  const FLAME_COLORS = useMemo(() => [
    new THREE.Color('#ffffcc'),  // white-hot core
    new THREE.Color('#ffdd44'),  // bright yellow
    new THREE.Color('#ff8811'),  // orange
    new THREE.Color('#ff4400'),  // red-orange
    new THREE.Color('#cc2200'),  // dark red
    new THREE.Color('#441100'),  // ember
  ], []);

  // Per-particle random offsets (stable across frames)
  const particleSeeds = useMemo(() =>
    Array.from({ length: FLAME_PARTICLE_COUNT }, (_, i) => ({
      xJitter: (Math.random() - 0.5) * 0.12,
      yJitter: (Math.random() - 0.5) * 0.06,
      speed: 0.5 + Math.random() * 0.5,
      size: 0.06 + Math.random() * 0.05,
      phaseOff: Math.random() * Math.PI * 2,
    })),
  []);

  useFrame((_, delta) => {
    const rotationAngle = animRefs?.fwRot?.current ?? 0;
    const crankAngleDeg = ((rotationAngle + phaseAngle) * 180 / Math.PI);
    const n = ((crankAngleDeg % 720) + 720) % 720;

    // Exhaust valve open: ~490° to ~730° crank (exhaust stroke + some overlap)
    // Flame visible during exhaust stroke and early overlap period
    const exhaustOpen = (n >= 480 && n <= 720) || n < 20;
    // Intensity ramps up after exhaust valve opens, fades near end
    let exhaustIntensity = 0;
    if (n >= 480 && n <= 720) {
      const progress = (n - 480) / 240; // 0→1 across exhaust stroke
      exhaustIntensity = progress < 0.15
        ? progress / 0.15        // ramp up fast at blowdown
        : 1.0 - (progress - 0.15) * 0.7; // gradual fade
    } else if (n < 20) {
      exhaustIntensity = 0.2 * (1 - n / 20); // tail end overlap
    }

    // Scale with throttle (more fuel = hotter exhaust)
    const throttleFactor = 0.3 + (throttle / 100) * 0.7;
    const intensity = exhaustIntensity * throttleFactor;

    const g = geo.current;
    // Exhaust port position: at head height, rear of block
    const portY = g.blockDeckH + g.headH * 0.3;
    const portZ = -g.blockD * 0.5 - 0.15;

    for (let p = 0; p < FLAME_PARTICLE_COUNT; p++) {
      const mesh = meshesRef.current[p];
      const mat = materialsRef.current[p];
      if (!mesh || !mat) continue;

      const seed = particleSeeds[p];
      if (!exhaustOpen || intensity < 0.02) {
        mat.opacity = 0;
        continue;
      }

      // Each particle travels along a path from valve port into the manifold
      // t = 0 is at the valve, t = 1 is deep into the collector
      const time = performance.now() * 0.001 * seed.speed + seed.phaseOff;
      const t = (time % 1); // cycle 0→1 continuously

      // Path: start at exhaust port, curve downward into collector
      const px = cylinderX + seed.xJitter * (1 + t);
      // Lerp toward collector center X (0) as particle moves along path
      const collectorLerp = t * t * 0.6;
      const finalX = px * (1 - collectorLerp);
      // Move downward and backward into header
      const py = portY + seed.yJitter - t * 0.25;
      const pz = portZ - t * 0.3;

      mesh.position.set(finalX, py, pz);

      // Size: start small at port, expand, then shrink
      const sizeScale = Math.sin(t * Math.PI) * seed.size * (1 + intensity);
      mesh.scale.setScalar(Math.max(0.005, sizeScale));

      // Color: hot at birth, cooler as it travels
      const colorIdx = Math.min(FLAME_COLORS.length - 1,
        Math.floor(t * (FLAME_COLORS.length - 0.5)));
      mat.color.copy(FLAME_COLORS[colorIdx]);

      // Opacity: ramp up, then fade
      const opacityEnvelope = Math.sin(t * Math.PI);
      mat.opacity = opacityEnvelope * intensity * 0.9;
    }
  });

  return (
    <group ref={particlesRef}>
      {particleSeeds.map((seed, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) meshesRef.current[i] = el; }}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial
            ref={(el) => { if (el) materialsRef.current[i] = el; }}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRING ORDER INDICATORS — numbered labels above each cylinder
// Pulse when at TDC-power, color-code by stroke phase
// ═══════════════════════════════════════════════════════════════════════════
function FiringOrderIndicators({
  cylOffsets,
}: {
  cylOffsets: number[];
}) {
  const animRefs = useContext(AnimationRefsCtx);
  const FIRING_ORDER = [1, 3, 4, 2];
  const PHASE_LABELS = ['INTAKE', 'COMP', 'POWER', 'EXHAUST'];
  const PHASE_COLORS_STR = ['#3388ff', '#ffcc22', '#ff4422', '#888888'];
  const rotationAngle = animRefs?.fwRot?.current ?? 0;

  return (
    <>
      {cylOffsets.map((cx, i) => {
        const cylCrankDeg = ((rotationAngle + CRANK_OFFSETS[i]) * 180 / Math.PI) % 720;
        const phase = getStrokePhase3D(((cylCrankDeg % 720) + 720) % 720);
        const isFiring = phase === 2 && getCylPressure3D(((cylCrankDeg % 720) + 720) % 720, 50) > 0.8;
        return (
          <group key={i} position={[cx, BLOCK_DECK_H + HEAD_TOTAL_H + 0.15, 0]}>
            <Html center distanceFactor={12} style={{ pointerEvents: 'none' }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                fontFamily: 'monospace', userSelect: 'none',
              }}>
                <span style={{
                  fontSize: isFiring ? 14 : 11,
                  fontWeight: 'bold',
                  color: PHASE_COLORS_STR[phase],
                  textShadow: isFiring ? `0 0 8px ${PHASE_COLORS_STR[phase]}` : 'none',
                  transition: 'all 0.05s',
                }}>
                  #{FIRING_ORDER[i]}
                </span>
                <span style={{
                  fontSize: 7,
                  color: PHASE_COLORS_STR[phase],
                  opacity: 0.7,
                  letterSpacing: 1,
                }}>
                  {PHASE_LABELS[phase]}
                </span>
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMING BELT — connects crank sprocket to cam sprockets (2:1 ratio)
// Visualized as a tube path with animated UV scroll
// ═══════════════════════════════════════════════════════════════════════════
function TimingBelt() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const animRefs = useContext(AnimationRefsCtx);

  // Belt path: crank sprocket (bottom) → intake cam sprocket (front-top) → exhaust cam (rear-top) → back
  const beltPath = useMemo(() => {
    const crankY = 0;
    const camY = BLOCK_DECK_H + HEAD_H + VALVE_COVER_H * 0.4;
    const intakeCamZ = 0.35 * BLOCK_D;
    const exhaustCamZ = -0.35 * BLOCK_D;
    const beltX = BLOCK_L * 0.5 + 0.22; // side of block (timing cover side)

    // Create belt path points (going around all 3 sprockets)
    const points: THREE.Vector3[] = [];
    const segments = 64;

    // Bottom arc around crank sprocket (left half, going CW from intake side)
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * 0.5 + (i / 12) * Math.PI;
      points.push(new THREE.Vector3(beltX, crankY + Math.sin(a) * CRANK_SPROCKET_R, Math.cos(a) * CRANK_SPROCKET_R));
    }
    // Straight run up to intake cam (front)
    points.push(new THREE.Vector3(beltX, camY - CAM_SPROCKET_R, intakeCamZ));
    // Top arc around intake cam sprocket
    for (let i = 0; i <= 8; i++) {
      const a = -Math.PI * 0.5 + (i / 8) * Math.PI;
      points.push(new THREE.Vector3(beltX, camY + Math.sin(a) * CAM_SPROCKET_R, intakeCamZ + Math.cos(a) * CAM_SPROCKET_R * 0.3));
    }
    // Cross from intake cam to exhaust cam
    points.push(new THREE.Vector3(beltX, camY + CAM_SPROCKET_R * 0.3, 0));
    // Arc around exhaust cam
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * 0.5 - (i / 8) * Math.PI;
      points.push(new THREE.Vector3(beltX, camY + Math.sin(a) * CAM_SPROCKET_R, exhaustCamZ + Math.cos(a) * CAM_SPROCKET_R * 0.3));
    }
    // Straight run back down to crank (rear side)
    points.push(new THREE.Vector3(beltX, crankY + CRANK_SPROCKET_R, exhaustCamZ * 0.3));

    return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
  }, []);

  const tubeGeo = useMemo(() => {
    return new THREE.TubeGeometry(beltPath, 80, 0.02, 6, true);
  }, [beltPath]);

  // Animate UV offset to simulate belt motion
  useFrame(() => {
    const rotationAngle = animRefs?.fwRot?.current ?? 0;
    if (meshRef.current && meshRef.current.material) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (mat.map) {
        mat.map.offset.y += rotationAngle * 0.0001;
      }
    }
  });

  return (
    <mesh ref={meshRef} geometry={tubeGeo}>
      <meshStandardMaterial
        color="#222"
        metalness={0.3}
        roughness={0.8}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// THROTTLE BUTTERFLY — disc inside throttle body that pivots with throttle%
// ═══════════════════════════════════════════════════════════════════════════
function ThrottleButterfly({ throttle }: { throttle: number }) {
  const discRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (discRef.current) {
      // 0% throttle = closed (0°), 100% = wide open (90°)
      const openAngle = (throttle / 100) * (Math.PI / 2);
      discRef.current.rotation.x = openAngle;
    }
  });

  return (
    <group position={[0, 0, BLOCK_D * 0.5 + 0.35]} rotation={[Math.PI / 2, 0, 0]}>
      {/* Throttle body housing */}
      <mesh>
        <cylinderGeometry args={[TB_DIA / 2 + 0.02, TB_DIA / 2 + 0.02, 0.12, 16, 1, true]} />
        <meshStandardMaterial color="#666" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} transparent opacity={0.3} />
      </mesh>
      {/* Butterfly disc */}
      <mesh ref={discRef}>
        <cylinderGeometry args={[TB_DIA / 2 - 0.005, TB_DIA / 2 - 0.005, 0.005, 16]} />
        <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Shaft */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.01, 0.01, TB_DIA + 0.04, 6]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
      </mesh>
      <Html center distanceFactor={10} position={[0, 0.15, 0]} style={{ pointerEvents: 'none' }}>
        <span style={{ fontSize: 8, color: '#999', fontFamily: 'monospace' }}>
          TB {Math.round(throttle)}%
        </span>
      </Html>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW MODE CONTROLLER — applies X-Ray / Cutaway / Exploded effects
// Traverses scene graph each frame and adjusts material properties
// ═══════════════════════════════════════════════════════════════════════════
function ViewModeController() {
  const viewSettingsRef = useContext(ViewSettingsCtx);
  const { scene } = useThree();
  const clippingPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, -1), 0));
  const prevMode = useRef<ViewMode>('normal');

  useFrame(({ gl }) => {
    const mode = viewSettingsRef.current.viewMode;
    if (mode === prevMode.current && mode === 'normal') return;
    prevMode.current = mode;

    const isXray = mode === 'xray';
    const isCutaway = mode === 'cutaway';
    const isExploded = mode === 'exploded';
    const isPowerflow = mode === 'powerflow';

    // Enable/disable clipping planes globally
    if (isCutaway) {
      gl.clippingPlanes = [clippingPlaneRef.current];
    } else {
      gl.clippingPlanes = [];
    }

    // Traverse scene to modify materials
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = obj.material;
      if (!mat || Array.isArray(mat)) return;

      const m = mat as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial;

      if (isXray) {
        // X-Ray: make all opaque/semi-opaque materials very transparent
        if (!m.userData._origOpacity) {
          m.userData._origOpacity = m.opacity;
          m.userData._origTransparent = m.transparent;
        }
        m.transparent = true;
        m.opacity = Math.min(m.userData._origOpacity, 0.12);
        m.depthWrite = false;
      } else if (isPowerflow) {
        // Power flow: dim everything not in the flow path
        if (!m.userData._origOpacity) {
          m.userData._origOpacity = m.opacity;
          m.userData._origTransparent = m.transparent;
        }
        m.transparent = true;
        m.opacity = Math.min(m.userData._origOpacity, 0.15);
      } else {
        // Normal / exploded / cutaway: restore original
        if (m.userData._origOpacity !== undefined) {
          m.opacity = m.userData._origOpacity;
          m.transparent = m.userData._origTransparent;
          m.depthWrite = true;
          delete m.userData._origOpacity;
          delete m.userData._origTransparent;
        }
      }
    });

    // For exploded view, offset sub-groups vertically
    // Each major component group gets a Y offset based on its position in the hierarchy
    if (isExploded) {
      let idx = 0;
      scene.children.forEach((child) => {
        if (child instanceof THREE.Group && child.children.length > 0) {
          // Spread groups apart along Y
          child.position.y += (idx % 2 === 0 ? 0.3 : -0.3) * (idx > 0 ? 1 : 0);
          idx++;
        }
      });
    }
  });

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// POWER FLOW PATH — glowing tube tracing torque from combustion → tire
// Visible only in 'powerflow' view mode.
// ═══════════════════════════════════════════════════════════════════════════
function PowerFlowPath({ engineX, fwX, clutchX, transX, outerCvX, tireX, active }: {
  engineX: number; fwX: number; clutchX: number; transX: number; outerCvX: number; tireX: number; active: boolean;
}) {
  const tubeRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.MeshBasicMaterial>(null!);
  const timeRef = useRef(0);

  useFrame((_, dt) => {
    if (!active) { if (tubeRef.current) tubeRef.current.visible = false; return; }
    if (tubeRef.current) tubeRef.current.visible = true;
    timeRef.current += dt;
    if (matRef.current) {
      // Pulsing glow
      matRef.current.opacity = 0.35 + 0.15 * Math.sin(timeRef.current * 4);
    }
  });

  const curve = useMemo(() => {
    // Power path: engine crank → flywheel → clutch → trans → CV → tire
    const points = [
      new THREE.Vector3(engineX, 0, 0),       // crank center
      new THREE.Vector3(fwX, 0, 0),            // flywheel
      new THREE.Vector3(clutchX, 0, 0),        // clutch disc
      new THREE.Vector3(transX, 0, 0),         // trans input shaft
      new THREE.Vector3(transX + 0.5, -0.8, 0),// trans output (below, offset)
      new THREE.Vector3(outerCvX, 0, 0),       // outer CV
      new THREE.Vector3(tireX, 0, 0),          // tire hub
    ];
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);
  }, [engineX, fwX, clutchX, transX, outerCvX, tireX]);

  const geo = useMemo(() => new THREE.TubeGeometry(curve, 64, 0.06, 8, false), [curve]);

  return (
    <mesh ref={tubeRef} geometry={geo} visible={active}>
      <meshBasicMaterial
        ref={matRef}
        color="#00ff88"
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SELECTABLE PART WRAPPER — highlights on hover, shows info on click
// ═══════════════════════════════════════════════════════════════════════════
function SelectablePart({
  children, partId, onSelect,
}: {
  children: React.ReactNode; partId: string;
  onSelect: (id: string | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);

  return (
    <group
      ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'grab'; }}
      onPointerDown={(e) => { e.stopPropagation(); onSelect(partId); }}
    >
      {children}
      {hovered && (
        <mesh scale={[1.02, 1.02, 1.02]}>
          <boxGeometry args={[0.01, 0.01, 0.01]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PART INFO PANEL — floating Html panel showing part specs
// ═══════════════════════════════════════════════════════════════════════════
function PartInfoPanel({ partId, onClose }: { partId: string; onClose: () => void }) {
  const spec = PART_SPECS[partId];
  if (!spec) return null;

  return (
    <Html center distanceFactor={12} style={{ pointerEvents: 'auto' }}>
      <div style={{
        background: 'rgba(10,10,10,0.95)',
        border: '1px solid #a3e635',
        borderRadius: 8,
        padding: '12px 16px',
        maxWidth: 280,
        fontFamily: 'monospace',
        color: '#eee',
        fontSize: 11,
        boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: '#a3e635', fontWeight: 700, fontSize: 13 }}>{spec.name}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16, padding: 0 }}
          >✕</button>
        </div>
        <p style={{ color: '#999', margin: '0 0 8px 0', lineHeight: 1.4 }}>{spec.description}</p>
        <ul style={{ margin: 0, paddingLeft: 16, color: '#ccc' }}>
          {spec.specs.map((s, i) => (
            <li key={i} style={{ marginBottom: 2 }}>{s}</li>
          ))}
        </ul>
      </div>
    </Html>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE BLOCK — translucent with visible rotating assembly
// Dynamically sized from EngineGeometry context
// Transverse-mounted: crankshaft along X axis, cylinders point up (+Y)
// Now reads rotation from AnimationRefsCtx for proper frame-by-frame sync
// ═══════════════════════════════════════════════════════════════════════════
function EngineBlock({
  position, throttle,
}: {
  position: [number, number, number]; throttle: number;
}) {
  const crankRef = useRef<THREE.Group>(null!);
  const camIntakeRef = useRef<THREE.Group>(null!);
  const camExhaustRef = useRef<THREE.Group>(null!);
  const geo = useContext(EngineGeometryCtx).current;
  const store = useContext(PropsStoreCtx);
  const animRefs = useContext(AnimationRefsCtx);

  useFrame(() => {
    // Read current rotation from shared ref for frame-accurate sync
    const rotationAngle = animRefs?.fwRot?.current ?? 0;
    if (crankRef.current) crankRef.current.rotation.x = rotationAngle;
    // Camshafts turn at half crank speed (2:1 ratio)
    const camAngle = rotationAngle / 2;
    if (camIntakeRef.current) camIntakeRef.current.rotation.x = camAngle;
    if (camExhaustRef.current) camExhaustRef.current.rotation.x = camAngle;
  });

  // ── Read dynamic dimensions from engine geometry ──
  const g_bore = geo.bore;
  const g_boreSpacing = geo.boreSpacing;
  const g_blockL = geo.blockL;
  const g_blockDeckH = geo.blockDeckH;
  const g_blockSumpH = geo.blockSumpH;
  const g_blockD = geo.blockD;
  const g_headH = geo.headH;
  const g_valveCoverH = geo.valveCoverH;
  const g_headTotalH = geo.headTotalH;
  const g_crankMainR = geo.crankMainR;
  const g_crankOffsets = geo.crankOffsets;
  const g_cylinders = geo.cylinders;
  const g_crankThrow = geo.crankThrow;
  const g_conRodLen = geo.conRodLen;
  const g_pistonH = geo.pistonH;
  const g_crankPinR = geo.crankPinR;
  const g_cwR = geo.cwR;
  const g_cwThick = geo.cwThick;

  // Engine name from props store
  const engineName = store.current.engineName;
  const engineId = store.current.engineId;
  const activePreset = ENGINE_PRESETS.find(p => p.id === engineId);

  // Cylinder X offsets
  const cylOffsets = useMemo(() => {
    return geo.cylinderXOffsets;
  }, [geo]);

  const blockTotalH = g_blockDeckH + g_blockSumpH;
  const blockCenterY = (g_blockDeckH - g_blockSumpH) / 2;

  return (
    <group position={position}>
      {/* ── BLOCK SHELL (translucent) ── */}
      <mesh position={[0, blockCenterY, 0]}>
        <boxGeometry args={[g_blockL, blockTotalH, g_blockD]} />
        <meshPhysicalMaterial
          color="#4488cc"
          transparent
          opacity={0.10}
          roughness={0.3}
          metalness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Block ribbing (casting detail) */}
      {[-0.3, -0.1, 0.1, 0.3].map((f, i) => (
        <mesh key={`brib${i}`} position={[f * g_blockL, blockCenterY, 0]}>
          <boxGeometry args={[0.02, blockTotalH * 1.01, g_blockD * 1.01]} />
          <meshPhysicalMaterial color="#5599dd" transparent opacity={0.06} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* ── CYLINDER HEAD (translucent, sits on top of block) ── */}
      <mesh position={[0, g_blockDeckH + g_headH / 2, 0]}>
        <boxGeometry args={[g_blockL * 0.95, g_headH, g_blockD * 0.92]} />
        <meshPhysicalMaterial
          color="#6699cc"
          transparent
          opacity={0.08}
          roughness={0.3}
          metalness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Cam cover (DOHC — two cam humps) */}
      {[-0.35, 0.35].map((zf, i) => (
        <mesh key={`cam${i}`} position={[0, g_blockDeckH + g_headH + g_valveCoverH / 2, zf * g_blockD]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[g_valveCoverH * 0.4, g_valveCoverH * 0.4, g_blockL * 0.88, 12, 1, false, 0, Math.PI]} />
          <meshPhysicalMaterial color="#cc3333" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* ── SPINNING DOHC CAMSHAFTS (visible through translucent cam covers) ── */}
      {[
        { zf: 0.35, label: 'INTAKE', color: '#3b82f6', ref: camIntakeRef },
        { zf: -0.35, label: 'EXHAUST', color: '#ef4444', ref: camExhaustRef },
      ].map(({ zf, color, ref }, camIdx) => {
        const camY = g_blockDeckH + g_headH + g_valveCoverH * 0.4;
        const camZ = zf * g_blockD;
        return (
          <group key={`camshaft-${camIdx}`} position={[0, camY, camZ]}>
            <group ref={ref}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[13 * S, 13 * S, g_blockL * 0.85, 12]} />
                <meshStandardMaterial color="#aaa" metalness={0.9} roughness={0.1} />
              </mesh>
              {cylOffsets.map((cx, i) => {
                const lobePhase = g_crankOffsets[i] / 2;
                // Real B16A2 VTEC hi-cam: base circle ~17mm radius,
                // lobe lift 10.6mm intake / 9.4mm exhaust.
                // Total nose radius ≈ 27.6mm (17 + 10.6).
                const baseR = 17 * S;       // base circle radius
                const lobeWidth = 14.5 * S; // lobe width along cam axis
                const noseLift = camIdx === 0 ? 10.6 * S : 9.4 * S; // intake vs exhaust lift
                const noseR = 10 * S;       // rounding on nose tip
                return (
                  <group key={`lobe-${camIdx}-${i}`} position={[cx, 0, 0]} rotation={[lobePhase, 0, 0]}>
                    {/* Base circle */}
                    <mesh>
                      <cylinderGeometry args={[baseR, baseR, lobeWidth, 16]} />
                      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
                    </mesh>
                    {/* Lobe ramp — tapered box from base to nose */}
                    <mesh position={[0, baseR * 0.5 + noseLift * 0.35, 0]}>
                      <boxGeometry args={[lobeWidth, noseLift * 0.9, baseR * 0.85]} />
                      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
                    </mesh>
                    {/* Lobe nose (rounded tip) */}
                    <mesh position={[0, baseR + noseLift - noseR * 0.3, 0]}>
                      <sphereGeometry args={[noseR, 10, 8]} />
                      <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
                    </mesh>
                  </group>
                );
              })}
            </group>
          </group>
        );
      })}

      {/* VTEC solenoid (only for Honda VTEC engines) */}
      {(engineId === 'b16a2' || engineId === 'k20a' || engineId === 'f20c') && (
        <>
          <mesh position={[g_blockL * 0.25, g_blockDeckH + g_headH * 0.5, -g_blockD * 0.5 - 0.08]}>
            <cylinderGeometry args={[0.08, 0.08, 0.18, 10]} />
            <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
          </mesh>
          <Label3D position={[g_blockL * 0.25, g_blockDeckH + g_headH * 0.5 - 0.25, -g_blockD * 0.5 - 0.18]} color="#ff6644" fontSize={7}>VTEC</Label3D>
        </>
      )}

      {/* ── CYLINDER BORES ── */}
      {cylOffsets.map((cx, i) => (
        <group key={`bore${i}`}>
          <mesh position={[cx, g_blockDeckH * 0.5 + 0.1, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[g_bore / 2, g_bore / 2, g_blockDeckH * 0.75, 24, 1, true]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.3} side={THREE.DoubleSide} transparent opacity={0.3} />
          </mesh>
          <mesh position={[cx, g_blockDeckH, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[g_bore / 2, 0.008, 6, 24]} />
            <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* ── CRANKSHAFT JOURNALS ── */}
      <group ref={crankRef}>
        {Array.from({ length: g_cylinders + 1 }, (_, i) => {
          const jx = -(g_cylinders / 2) * g_boreSpacing + i * g_boreSpacing;
          return (
            <mesh key={`mj${i}`} position={[jx, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[g_crankMainR, g_crankMainR, g_boreSpacing * 0.35, 16]} />
              <meshStandardMaterial color="#bbb" metalness={0.9} roughness={0.1} />
            </mesh>
          );
        })}
        <mesh position={[g_blockL * 0.5 + 0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[g_crankMainR * 0.8, g_crankMainR * 0.8, 0.2, 12]} />
          <meshStandardMaterial color="#888" metalness={0.85} roughness={0.15} />
        </mesh>
        <mesh position={[g_blockL * 0.5 + 0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.05, 24]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* ── PISTON + CON ROD + CRANK THROW ASSEMBLIES ── */}
      {cylOffsets.map((cx, i) => {
        const phaseAngle = g_crankOffsets[i];
        return (
          <CrankThrowAssembly
            key={`cta${i}`}
            cylinderX={cx}
            phaseAngle={phaseAngle}
            cylIndex={i}
            bore={g_bore}
            stroke={geo.stroke}
            crankThrow={g_crankThrow}
            conRodLen={g_conRodLen}
            pistonH={g_pistonH}
            crankPinR={g_crankPinR}
            cwR={g_cwR}
            cwThick={g_cwThick}
            boreSpacing={g_boreSpacing}
          />
        );
      })}

      {/* ── OIL PAN ── */}
      <mesh position={[0, -g_blockSumpH - 0.25, 0]}>
        <boxGeometry args={[g_blockL * 0.85, 0.5, g_blockD * 0.7]} />
        <meshPhysicalMaterial color="#3a3a3a" transparent opacity={0.15} roughness={0.4} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -g_blockSumpH - 0.52, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.06, 6]} />
        <meshStandardMaterial color="#555" metalness={0.85} roughness={0.15} />
      </mesh>

      {/* ── INTAKE MANIFOLD ── */}
      <group position={[0, g_blockDeckH + g_headH * 0.4, g_blockD * 0.5 + 0.15]}>
        {cylOffsets.map((cx, i) => (
          <mesh key={`runner${i}`} position={[cx, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[19 * S, 20 * S, 320 * S * 0.5, 10]} />
            <meshPhysicalMaterial color="#888" transparent opacity={0.2} metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <mesh position={[0, 0.08, 0.2]}>
          <boxGeometry args={[g_blockL * 0.75, 0.40, 0.22]} />
          <meshPhysicalMaterial color="#999" transparent opacity={0.12} metalness={0.5} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
        <Label3D position={[0, 0.45, 0.2]} color="#666" fontSize={8}>INTAKE MANIFOLD</Label3D>
      </group>

      {/* ── EXHAUST MANIFOLD ── */}
      <group position={[0, g_blockDeckH + g_headH * 0.3, -g_blockD * 0.5 - 0.15]}>
        {cylOffsets.map((cx, i) => (
          <mesh key={`exhport${i}`} position={[cx, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[19 * S, 19 * S, 0.2, 10]} />
            <meshStandardMaterial color="#8B4513" metalness={0.5} roughness={0.6} transparent opacity={0.4} />
          </mesh>
        ))}
        <mesh position={[0, -0.2, -0.15]} rotation={[Math.PI / 4, 0, 0]}>
          <cylinderGeometry args={[27 * S, 19 * S, 0.40, 10]} />
          <meshStandardMaterial color="#8B4513" metalness={0.4} roughness={0.7} transparent opacity={0.3} />
        </mesh>
        <Label3D position={[0, -0.50, -0.2]} color="#8B4513" fontSize={8}>
          {g_cylinders <= 4 ? '4-2-1 HEADER' : g_cylinders <= 6 ? '6-2 HEADER' : 'HEADERS'}
        </Label3D>
      </group>

      {/* ── DYNAMIC LABELS ── */}
      <Label3D position={[0, g_blockDeckH + g_headTotalH + 0.6, 0]} color="#4488cc" fontSize={12}>
        {activePreset ? `${activePreset.name} ${activePreset.valvetrain.split(' ')[0]}` : engineName}
      </Label3D>
      <Label3D position={[0, g_blockDeckH + g_headTotalH + 0.35, 0]} color="#4488cc" fontSize={9}>
        {activePreset ? `${activePreset.bore}mm × ${activePreset.stroke}mm — ${activePreset.displacement}cc` : `${g_bore / S}mm bore`}
      </Label3D>
      <Label3D position={[0, -g_blockSumpH - 0.9, 0]} color="#555" fontSize={8}>
        {activePreset ? `${activePreset.compression}:1 COMPRESSION` : 'ENGINE'}
      </Label3D>

      {/* ── ANIMATED VALVES ── */}
      {cylOffsets.map((cx, i) => {
        const phaseAngle = g_crankOffsets[i];
        return (
          <React.Fragment key={`valves-${i}`}>
            <ValveAssembly cylinderX={cx} phaseAngle={phaseAngle} isIntake={true} />
            <ValveAssembly cylinderX={cx} phaseAngle={phaseAngle} isIntake={false} />
          </React.Fragment>
        );
      })}

      {/* ── COMBUSTION EFFECTS ── */}
      {cylOffsets.map((cx, i) => {
        const phaseAngle = g_crankOffsets[i];
        return (
          <CombustionEffect
            key={`comb-${i}`}
            cylinderX={cx}
            phaseAngle={phaseAngle}
            throttle={throttle}
          />
        );
      })}

      {/* ── EXHAUST FLAME EFFECTS ── */}
      {cylOffsets.map((cx, i) => {
        const phaseAngle = g_crankOffsets[i];
        return (
          <ExhaustFlameEffect
            key={`exh-flame-${i}`}
            cylinderX={cx}
            phaseAngle={phaseAngle}
            throttle={throttle}
          />
        );
      })}

      {/* ── FIRING ORDER INDICATORS ── */}
      <FiringOrderIndicators cylOffsets={cylOffsets} />

      {/* ── TIMING BELT ── */}
      <TimingBelt />

      {/* ── THROTTLE BUTTERFLY ── */}
      <ThrottleButterfly throttle={throttle} />
    </group>
  );
}

// ── CRANK THROW + CON ROD + PISTON (single cylinder — positioned by parent) ──
// Now reads rotation from AnimationRefsCtx for proper frame-by-frame sync
function CrankThrowAssembly({
  cylinderX, phaseAngle, cylIndex,
  bore, stroke, crankThrow, conRodLen, pistonH, crankPinR, cwR, cwThick, boreSpacing,
}: {
  cylinderX: number; phaseAngle: number; cylIndex: number;
  bore: number; stroke: number; crankThrow: number; conRodLen: number;
  pistonH: number; crankPinR: number; cwR: number; cwThick: number; boreSpacing: number;
}) {
  const pistonRef = useRef<THREE.Group>(null!);
  const conRodRef = useRef<THREE.Group>(null!);
  const throwRef = useRef<THREE.Group>(null!);
  const animRefs = useContext(AnimationRefsCtx);

  useFrame(() => {
    // Read current rotation from shared ref for frame-accurate sync
    const rotationAngle = animRefs?.fwRot?.current ?? 0;
    const angle = rotationAngle + phaseAngle;
    const pinY = crankThrow * Math.cos(angle);
    const pinZ = crankThrow * Math.sin(angle);
    const sinA = crankThrow * Math.sin(angle);
    const pistonY = crankThrow * Math.cos(angle) +
      Math.sqrt(Math.max(conRodLen * conRodLen - sinA * sinA, 0.001));
    const conRodAngle = Math.atan2(pinZ, pistonY - pinY);
    const conRodCY = (pistonY + pinY) / 2;
    const conRodCZ = pinZ / 2;

    if (pistonRef.current) pistonRef.current.position.y = pistonY;
    if (conRodRef.current) {
      conRodRef.current.position.y = conRodCY;
      conRodRef.current.position.z = conRodCZ;
      conRodRef.current.rotation.x = -conRodAngle;
    }
    if (throwRef.current) {
      throwRef.current.position.y = pinY;
      throwRef.current.position.z = pinZ;
    }
  });

  const colors = ['#ff6644', '#44cc88', '#4488ff', '#ffaa22', '#cc44ff', '#44cccc', '#ff4488', '#88cc44', '#ff8844', '#4444ff', '#cccc44', '#ff44cc'];
  const pistonColor = colors[cylIndex % colors.length];

  return (
    <group position={[cylinderX, 0, 0]}>
      <group ref={throwRef}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[crankPinR, crankPinR, boreSpacing * 0.5, 12]} />
          <meshStandardMaterial color="#ccc" metalness={0.9} roughness={0.1} />
        </mesh>
        {[-0.3, 0.3].map((dx, i) => (
          <mesh key={`cw${i}`} position={[dx * boreSpacing, -cwR * 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[cwR, cwR * 0.85, cwThick, 12, 1, false, Math.PI * 0.6, Math.PI * 0.8]} />
            <meshStandardMaterial color="#999" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
      </group>

      <group ref={conRodRef}>
        <mesh>
          <boxGeometry args={[0.04, conRodLen, 0.025]} />
          <meshStandardMaterial color="#bbbbbb" metalness={0.85} roughness={0.15} />
        </mesh>
        <mesh position={[0, -conRodLen / 2, 0]}>
          <torusGeometry args={[crankPinR * 1.1, 0.015, 6, 16]} />
          <meshStandardMaterial color="#aaa" metalness={0.85} roughness={0.15} />
        </mesh>
        <mesh position={[0, conRodLen / 2, 0]}>
          <torusGeometry args={[0.04, 0.012, 6, 12]} />
          <meshStandardMaterial color="#aaa" metalness={0.85} roughness={0.15} />
        </mesh>
      </group>

      <group ref={pistonRef}>
        <mesh>
          <cylinderGeometry args={[bore / 2 - 0.005, bore / 2 - 0.008, pistonH, 20]} />
          <meshStandardMaterial color={pistonColor} metalness={0.75} roughness={0.25} transparent opacity={0.8} />
        </mesh>
        {[0.10, 0.07, 0.02].map((yOff, ri) => (
          <mesh key={`ring${ri}`} position={[0, yOff, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[bore / 2 - 0.003, 0.006, 4, 24]} />
            <meshStandardMaterial color={ri < 2 ? "#888" : "#555"} metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, bore * 0.7, 8]} />
          <meshStandardMaterial color="#ddd" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

function GroundAndEnvironment() {
  const store = useContext(PropsStoreCtx);
  const tw = store.current.tireWidthMm || 195;
  const ar = store.current.tireAspectRatio || 55;
  const wd = store.current.wheelDiameterIn || 15;
  const groundTireOR = (wd * 25.4 + 2 * tw * (ar / 100)) * S / 2;

  // Scrolling ground for motion effect during runs
  const groundGroupRef = useRef<THREE.Group>(null!);
  const roadLinesRef = useRef<THREE.Group>(null!);
  const edgeLinesRef = useRef<THREE.Group>(null!);
  const scrollOffsetRef = useRef(0);
  const prevTimeRef = useRef(performance.now());
  const ROAD_DASH_SPACING = 4;     // spacing between road dashes
  const NUM_DASHES = 30;

  useFrame(() => {
    const p = store.current;
    const speed = sn(p.speedMph);
    const isRunning = (p.quarterMileActive || p.topSpeedMode) && p.quarterMileLaunched;

    // Use real delta time instead of assuming 60fps
    const now = performance.now();
    let dt = (now - prevTimeRef.current) / 1000;
    prevTimeRef.current = now;
    if (dt > 0.1) dt = 0.016;
    if (dt <= 0) dt = 0.016;

    if (isRunning && speed > 0.5) {
      // Convert MPH to scene scroll: tuned so motion feels real
      const scrollSpeed = speed * 0.15; // world-units per second
      scrollOffsetRef.current += scrollSpeed * dt;

      // Keep offset manageable
      const dashCycle = ROAD_DASH_SPACING * NUM_DASHES;
      if (scrollOffsetRef.current > dashCycle) {
        scrollOffsetRef.current -= dashCycle;
      }
    } else if (scrollOffsetRef.current > 0.01) {
      // Smoothly decelerate to zero
      scrollOffsetRef.current *= (1 - 3 * dt);
      if (scrollOffsetRef.current < 0.01) scrollOffsetRef.current = 0;
    }

    // Apply scroll to all moving elements (Z direction = toward camera = forward)
    const zOffset = -(scrollOffsetRef.current % ROAD_DASH_SPACING);
    if (roadLinesRef.current) {
      roadLinesRef.current.position.z = zOffset;
    }
    if (edgeLinesRef.current) {
      edgeLinesRef.current.position.z = zOffset;
    }
    // Scroll grid subtly (modulo the grid cell size = 1 unit since 80 cells / 80 size)
    if (groundGroupRef.current) {
      groundGroupRef.current.position.z = -(scrollOffsetRef.current % 1);
    }
  });

  const groundY = -groundTireOR - 0.05;
  const GROUND_SIZE = 80;

  return (
    <group>
      {/* Base ground plane (extra large for scrolling) */}
      <group ref={groundGroupRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY, 0]}>
          <planeGeometry args={[GROUND_SIZE, GROUND_SIZE * 2]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.95} metalness={0.05} />
        </mesh>
        <gridHelper args={[GROUND_SIZE, GROUND_SIZE, "#1a1a1a", "#141414"]} position={[0, groundY + 0.01, 0]} />
      </group>

      {/* Road center dashes — repeating marks that scroll to show motion */}
      <group ref={roadLinesRef}>
        {Array.from({ length: NUM_DASHES }, (_, i) => (
          <mesh key={i} position={[0, groundY + 0.02, -60 + i * ROAD_DASH_SPACING]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, 1.8]} />
            <meshBasicMaterial color="#333" />
          </mesh>
        ))}
      </group>

      {/* Edge lane markings (left & right) — also scroll */}
      <group ref={edgeLinesRef}>
        {Array.from({ length: NUM_DASHES }, (_, i) => (
          <group key={i}>
            <mesh position={[-4, groundY + 0.02, -60 + i * ROAD_DASH_SPACING]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.08, 1.2]} />
              <meshBasicMaterial color="#2a2a2a" />
            </mesh>
            <mesh position={[12, groundY + 0.02, -60 + i * ROAD_DASH_SPACING]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.08, 1.2]} />
              <meshBasicMaterial color="#2a2a2a" />
            </mesh>
          </group>
        ))}
      </group>

      {/* 1 meter reference (fixed, only visible when stationary) */}
      <group position={[0, groundY + 0.03, 5]}>
        <mesh>
          <boxGeometry args={[1.0, 0.01, 0.03]} />
          <meshBasicMaterial color="#444" />
        </mesh>
        <Label3D position={[0, 0.15, 0]} color="#444" fontSize={10}>1 METER</Label3D>
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCENE ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════════
function DrivetrainScene(_props: DrivetrainView3DProps) {
  const store = useContext(PropsStoreCtx);
  const viewSettingsRef = useContext(ViewSettingsCtx);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);

  // Cumulative rotation refs - shared via AnimationRefsCtx for frame-accurate sync
  const tireRotRef = useRef(0);
  const fwRotRef = useRef(0);
  const prevTimeRef = useRef(performance.now());

  // Create animation refs object for context (stable reference)
  const animRefs = useMemo(() => ({ fwRot: fwRotRef, tireRot: tireRotRef }), []);

  // Mutable layout values updated each frame
  const frontCompRef = useRef(0);
  const rearCompRef = useRef(0);

  useFrame(() => {
    const p = store.current;
    const vs = viewSettingsRef.current;
    const safeTireRpm = sn(p.tireRpm);
    const safeRpm = sn(p.rpm);
    const accelG = sn(p.accelerationG);

    const now = performance.now();
    let dt = (now - prevTimeRef.current) / 1000;
    prevTimeRef.current = now;
    if (dt > 0.1) dt = 0.016;
    if (dt < 0) dt = 0.016;

    // Animation is driven directly by simulation RPM — no local speed override

    fwRotRef.current += (safeRpm / 60) * Math.PI * 2 * dt;
    tireRotRef.current += (safeTireRpm / 60) * Math.PI * 2 * dt;
    if (Math.abs(fwRotRef.current) > 1e6) fwRotRef.current %= (Math.PI * 2);
    if (Math.abs(tireRotRef.current) > 1e6) tireRotRef.current %= (Math.PI * 2);

    // Suspension compression from weight transfer
    const maxComp = 0.35;
    const rawTransfer = accelG * 0.3;
    frontCompRef.current = Math.max(-maxComp, Math.min(maxComp, -rawTransfer));
    rearCompRef.current  = Math.max(-maxComp, Math.min(maxComp,  rawTransfer));
  });

  // Read initial values for child layout (they also get live updates via useFrame)
  const p = store.current;
  const dtType = (p.drivetrainType || 'FWD');
  const isFrontDriven = dtType === 'FWD' || dtType === 'AWD';
  const isRearDriven = dtType === 'RWD' || dtType === 'AWD';
  const currentGear = p.currentGear;
  const clutchStatus = p.clutchStatus;
  const frontCompression = frontCompRef.current;
  const rearCompression = rearCompRef.current;

  // ── LAYOUT — all positions derived from real Honda Civic EK measurements ──
  // Every gap uses a named constant (mm × S) instead of magic numbers.
  const geo = useContext(EngineGeometryCtx).current;
  const tireX      = HALF_TRACK_F;                                              // 7.40
  const hubX       = tireX - WHEEL_ET;                                          // 6.95
  const outerCvX   = hubX - HUB_INBOARD_TO_CV;                                 // 6.55
  const innerCvX   = outerCvX - DRIVER_AXLE_LEN + CV_LEN;                      // ≈2.01
  const transX     = innerCvX - INNER_CV_GAP;                                   // ≈1.76
  const clutchX    = transX - geo.transD * 0.5 - geo.clutchThick * 0.5 - VISUAL_GAP;
  const fwX        = clutchX - geo.clutchThick * 0.5 - geo.fwThick * 0.5 - VISUAL_GAP;
  const engineX    = fwX - geo.fwThick * 0.5 - geo.blockL * 0.5 - VISUAL_GAP;

  const shaftLen   = outerCvX - innerCvX - CV_LEN;
  const shaftMidX  = (innerCvX + outerCvX) / 2;

  return (
    <AnimationRefsCtx.Provider value={animRefs}>
      {/* ── VIEW MODE CONTROLLER (x-ray, cutaway, exploded effects) ── */}
      <ViewModeController />

      {/* ── LIGHTING (stays fixed in world space) ── */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 8, 6]} intensity={1.0} castShadow />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} />
      <pointLight position={[0, 2, 6]} intensity={0.25} color="#90ee90" />
      <pointLight position={[tireX, -2, 3]} intensity={0.15} color="#a3e635" />

      {/* ── GROUND (scrolls during races to show motion) ── */}
      <GroundAndEnvironment />

      {/* ── DRIVER FRONT WHEEL CORNER (right side — outboard faces +X) ── */}
      <WheelCornerAssembly
        position={[tireX, 0, 0]}
        rotationAngle={tireRotRef.current}
        side="right"
        compression={frontCompression}
      />

      {/* ── OUTER CV JOINT (Rzeppa) ── */}
      <CVJoint position={[outerCvX, 0, 0]} rotationAngle={tireRotRef.current} type="rzeppa" />

      {/* ── OUTER CV BOOT ── */}
      <CVBoot
        length={BOOT_LEN}
        innerR={AXLE_R * 1.6}
        outerR={CV_R * 0.75}
        position={[outerCvX - CV_LEN * 0.5 - BOOT_LEN, 0, 0]}
        flipDirection={true}
      />

      {/* ── AXLE SHAFT ── */}
      <AxleShaft position={[shaftMidX, 0, 0]} length={shaftLen} />

      {/* ── INNER CV BOOT ── */}
      <CVBoot
        length={BOOT_LEN}
        innerR={AXLE_R * 1.6}
        outerR={CV_R * 0.75}
        position={[innerCvX + CV_LEN * 0.5, 0, 0]}
        flipDirection={false}
      />

      {/* ── INNER CV JOINT (Tripod) ── */}
      <CVJoint position={[innerCvX, 0, 0]} rotationAngle={tireRotRef.current} type="tripod" />

      {/* ── TRANSMISSION ── */}
      <TransmissionCase position={[transX, 0, 0]} currentGear={currentGear} />

      {/* ── CLUTCH ASSEMBLY ── */}
      <ClutchAssembly
        position={[clutchX, 0, 0]}
        rotationAngle={fwRotRef.current}
        clutchStatus={clutchStatus}
      />

      {/* ── FLYWHEEL ── */}
      <Flywheel position={[fwX, 0, 0]} rotationAngle={fwRotRef.current} />

      {/* ── ENGINE BLOCK (translucent with rotating assembly) ── */}
      <EngineBlock
        position={[engineX, 0, 0]}
        throttle={p.throttle}
      />

      {/* ── CABIN SHIFTER + SHIFT CABLES (BeamNG-style prop) ── */}
      <CabinShifter currentGear={currentGear} transX={transX} />

      {/* ── PASSENGER FRONT WHEEL (left side — mirrored outboard) ── */}
      <PassengerFrontAssembly
        tireX={tireX}
        transX={transX}
        rotationAngle={tireRotRef.current}
        isFrontDriven={isFrontDriven}
        compression={frontCompression}
      />

      {/* ── REAR AXLE ASSEMBLY (both rear wheels + diff/torsion beam) ── */}
      <RearAxleAssembly
        rotationAngle={tireRotRef.current}
        drivetrainType={dtType}
        rearDiffType={dtType === 'FWD' ? 'open' : 'lsd'}
        compression={rearCompression}
      />

      {/* ── PROPSHAFT (RWD/AWD only) ── */}
      <MainPropShaft
        transX={transX}
        rotationAngle={fwRotRef.current}
        active={isRearDriven}
      />

      {/* ── HUD ── */}
      <TelemetryHUD />

      {/* ── LABELS ── */}
      <ComponentLabels
        tirePos={tireX}
        hubPos={hubX}
        shaftCenterX={shaftMidX}
        innerCvX={innerCvX}
        outerCvX={outerCvX}
        transPos={transX}
        fwPos={fwX}
      />

      {/* ── DIMENSION LINES ── */}
      <DimensionLine
        from={[innerCvX, -2.8, 0]}
        to={[outerCvX, -2.8, 0]}
        label="345mm (driver)"
        color="#5a5a5a"
      />
      <DimensionLine
        from={[tireX - 3.0, -3.5, 0]}
        to={[tireX + 3.0, -3.5, 0]}
        label="tire dia"
        color="#5a5a5a"
      />

      {/* ── POWER FLOW PATH (shown in powerflow mode) ── */}
      <PowerFlowPath
        engineX={engineX}
        fwX={fwX}
        clutchX={clutchX}
        transX={transX}
        outerCvX={outerCvX}
        tireX={tireX}
        active={viewSettingsRef.current.viewMode === 'powerflow'}
      />

      {/* ── PART INFO PANEL (when a part is selected) ── */}
      {selectedPart && (
        <group position={[0, 4, 0]}>
          <PartInfoPanel partId={selectedPart} onClose={() => setSelectedPart(null)} />
        </group>
      )}
    </AnimationRefsCtx.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW PRESET CONTROLS
// ═══════════════════════════════════════════════════════════════════════════
interface ViewPreset {
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

const VIEW_PRESETS: ViewPreset[] = [
  { label: "3/4 Front",   position: [6, 6, 18],      target: [0, 0, -6] },
  { label: "Side",        position: [0, 1, 22],       target: [0, 0, -6] },
  { label: "Top",         position: [0, 18, -6],      target: [0, 0, -6] },
  { label: "Tire Close",  position: [9, 2, 6],        target: [9, 0, 0] },
  { label: "Trans Close", position: [-2, 2, 6],       target: [-2, 0, 0] },
  { label: "Engine",      position: [-10, 4, 6],      target: [-8, 1, 0] },
  { label: "Flywheel",    position: [-6, 1, 5],       target: [-4, 0, 0] },
  { label: "Rear Axle",   position: [0, 4, -20],      target: [0, 0, -26] },
  { label: "Shifter",     position: [2, 2, -5],       target: [0, -1, -8] },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORTED COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export const DrivetrainView3D = memo(function DrivetrainView3D(props: DrivetrainView3DProps) {
  const [activePreset, setActivePreset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [selectedPartUI, setSelectedPartUI] = useState<string | null>(null);
  const [enginePresetOpen, setEnginePresetOpen] = useState(false);

  // ── Sync activeEngine from simulation's engineId prop ──
  const resolvedEngineId = props.engineId || 'b16a2';
  const activeEngine = useMemo(() =>
    ENGINE_PRESETS.find(p => p.id === resolvedEngineId) || ENGINE_PRESETS[0],
    [resolvedEngineId]
  );

  // ── Compute engine geometry from active engine (only recomputes on engine/cylinder change) ──
  const overrideCyls = props.numCylinders;
  const engineGeometry = useMemo(() => {
    if (overrideCyls && overrideCyls !== activeEngine.cylinders) {
      // Create a modified preset with the user's cylinder count and matching layout
      let newLayout = activeEngine.layout;
      // Adjust layout to match new cylinder count for inline engines
      if (activeEngine.layout.startsWith('I') || activeEngine.layout === 'I4') {
        if (overrideCyls === 3) newLayout = 'I3';
        else if (overrideCyls === 4) newLayout = 'I4';
        else if (overrideCyls === 6) newLayout = 'I6';
        else newLayout = 'I4'; // fallback — computeEngineGeometry default branch handles arbitrary cylCount
      }
      const modified = { ...activeEngine, cylinders: overrideCyls, layout: newLayout as typeof activeEngine.layout };
      return computeEngineGeometry(modified);
    }
    return computeEngineGeometry(activeEngine);
  }, [activeEngine, overrideCyls]);
  const engineGeometryRef = useRef<EngineGeometry>(engineGeometry);
  engineGeometryRef.current = engineGeometry;

  // ── Resolve transmission name from model id ──
  const resolvedTransId = props.transmissionModel || 'honda_s4c';
  const activeTransPreset = useMemo(() =>
    TRANS_PRESETS.find(p => p.id === resolvedTransId) || TRANS_PRESETS[0],
    [resolvedTransId]
  );

  // ── Sync props into module-level store every render ──
  // This runs even though the component itself is memo'd(() => true),
  // because the PARENT re-renders and React still calls this function body
  // on mount. After mount memo prevents re-calls, so we ALSO sync
  // imperatively from the parent via the exported syncDrivetrainStore().
  const propsStoreRef = _drivetrainStoreRef;

  // ── View settings ref (read by scene children in useFrame) ──
  const viewSettingsRef = useRef<ViewSettings>({
    viewMode: 'normal',
    selectedPart: null,
  });

  // Sync view settings to ref on state change
  viewSettingsRef.current.viewMode = viewMode;
  viewSettingsRef.current.selectedPart = selectedPartUI;

  // Props sync happens in syncDrivetrainStore() called from dashboard tick

  const applyPreset = useCallback((idx: number) => {
    setActivePreset(idx);
  }, []);

  // Detect mobile for responsive height
  const [viewHeight, setViewHeight] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 320 : 520
  );
  useEffect(() => {
    const onResize = () => setViewHeight(window.innerWidth < 640 ? 320 : 520);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const VIEW_MODE_BUTTONS: { mode: ViewMode; label: string; icon: string }[] = [
    { mode: 'normal',    label: 'Normal',    icon: '🔧' },
    { mode: 'xray',      label: 'X-Ray',     icon: '🔬' },
    { mode: 'cutaway',   label: 'Cutaway',   icon: '🔪' },
    { mode: 'exploded',  label: 'Exploded',  icon: '💥' },
    { mode: 'powerflow', label: 'Power Flow', icon: '⚡' },
  ];

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 960,
        height: viewHeight,
        margin: "0 auto",
        background: "linear-gradient(180deg, #111 0%, #0a0a0a 100%)",
        borderRadius: 12,
        overflow: "hidden",
        cursor: "grab",
        position: "relative",
        border: "1px solid #222",
      }}
    >
      {/* ── TOP LEFT: Camera preset buttons ── */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          display: "flex",
          gap: 4,
          zIndex: 10,
          pointerEvents: "auto",
          flexWrap: 'wrap',
          maxWidth: 400,
        }}
      >
        {VIEW_PRESETS.map((vp, i) => (
          <button
            key={i}
            onClick={() => applyPreset(i)}
            style={{
              background: activePreset === i ? "#a3e635" : "#222",
              color: activePreset === i ? "#111" : "#888",
              border: "1px solid #333",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 10,
              fontFamily: "monospace",
              cursor: "pointer",
              letterSpacing: 0.5,
            }}
          >
            {vp.label}
          </button>
        ))}
      </div>

      {/* ── TOP RIGHT: View mode buttons ── */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          display: "flex",
          gap: 3,
          zIndex: 10,
          pointerEvents: "auto",
        }}
      >
        {VIEW_MODE_BUTTONS.map(({ mode, label, icon }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            title={label}
            style={{
              background: viewMode === mode ? '#a3e635' : '#1a1a1a',
              color: viewMode === mode ? '#111' : '#888',
              border: `1px solid ${viewMode === mode ? '#a3e635' : '#333'}`,
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 10,
              fontFamily: 'monospace',
              cursor: 'pointer',
              letterSpacing: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span style={{ fontSize: 12 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── ENGINE INFO BADGE (top center) — synced from sim ── */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 11,
          pointerEvents: "auto",
        }}
      >
        <button
          onClick={() => setEnginePresetOpen(!enginePresetOpen)}
          style={{
            background: '#1a1a1a',
            color: '#a3e635',
            border: '1px solid #333',
            borderRadius: 4,
            padding: '3px 12px',
            fontSize: 11,
            fontFamily: 'monospace',
            cursor: 'pointer',
            letterSpacing: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 10, color: '#888' }}>ENGINE:</span>
          <span style={{ fontWeight: 700 }}>{activeEngine.shortName}</span>
          <span style={{ fontSize: 8, color: '#666' }}>{activeEngine.displacement}cc {activeEngine.forced === 'NA' ? 'NA' : activeEngine.forced}</span>
          <span style={{ fontSize: 8, color: '#555' }}>| {activeTransPreset.shortName} {activeTransPreset.speeds}sp</span>
          <span style={{ fontSize: 10 }}>{enginePresetOpen ? '▲' : '▼'}</span>
        </button>
        {enginePresetOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: 4,
              background: 'rgba(10,10,10,0.97)',
              border: '1px solid #333',
              borderRadius: 8,
              padding: 10,
              width: 340,
              boxShadow: '0 8px 24px rgba(0,0,0,0.9)',
            }}
          >
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#ccc', lineHeight: 1.6 }}>
              <div style={{ color: '#a3e635', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{activeEngine.make} {activeEngine.name}</div>
              <div><span style={{ color: '#888' }}>Layout:</span> {activeEngine.layout} · {activeEngine.cylinders} cyl · {activeEngine.displacement}cc</div>
              <div><span style={{ color: '#888' }}>Bore × Stroke:</span> {activeEngine.bore}mm × {activeEngine.stroke}mm</div>
              <div><span style={{ color: '#888' }}>Compression:</span> {activeEngine.compression}:1</div>
              <div><span style={{ color: '#888' }}>Valvetrain:</span> {activeEngine.valvetrain}</div>
              <div><span style={{ color: '#888' }}>Power:</span> {activeEngine.maxHp} HP @ {activeEngine.maxHpRpm} RPM</div>
              <div><span style={{ color: '#888' }}>Torque:</span> {activeEngine.maxTq} lb-ft @ {activeEngine.maxTqRpm} RPM</div>
              <div><span style={{ color: '#888' }}>Redline:</span> {activeEngine.redline} RPM</div>
              <div><span style={{ color: '#888' }}>Aspiration:</span> {activeEngine.forced}</div>
              <div style={{ marginTop: 6, borderTop: '1px solid #333', paddingTop: 6 }}>
                <div style={{ color: '#5ae895', fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{activeTransPreset.name}</div>
                <div><span style={{ color: '#888' }}>Gears:</span> {(props.gearRatios ?? activeTransPreset.defaultRatios).map((r, i) => `${i+1}=${r.toFixed(2)}`).join(' / ')}</div>
                <div><span style={{ color: '#888' }}>Final Drive:</span> {(props.finalDriveRatio ?? 4.40).toFixed(2)}:1</div>
              </div>
              <div style={{ marginTop: 6, color: '#666', fontSize: 9, fontStyle: 'italic' }}>
                Change engine on the Vehicle page to update the 3D view
              </div>
            </div>
          </div>
        )}
      </div>



      {/* ── BOTTOM RIGHT: Selected part info (external UI) ── */}
      {selectedPartUI && PART_SPECS[selectedPartUI] && (
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            right: 8,
            background: 'rgba(10,10,10,0.95)',
            border: '1px solid #a3e635',
            borderRadius: 8,
            padding: '10px 14px',
            maxWidth: 260,
            fontFamily: 'monospace',
            color: '#eee',
            fontSize: 10,
            zIndex: 10,
            pointerEvents: 'auto',
            boxShadow: '0 4px 16px rgba(0,0,0,0.8)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ color: '#a3e635', fontWeight: 700, fontSize: 12 }}>{PART_SPECS[selectedPartUI].name}</span>
            <button
              onClick={() => setSelectedPartUI(null)}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 14 }}
            >✕</button>
          </div>
          <p style={{ color: '#999', margin: '0 0 6px 0', lineHeight: 1.3 }}>
            {PART_SPECS[selectedPartUI].description}
          </p>
          <ul style={{ margin: 0, paddingLeft: 14, color: '#ccc' }}>
            {PART_SPECS[selectedPartUI].specs.map((s, i) => (
              <li key={i} style={{ marginBottom: 1 }}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <PropsStoreCtx.Provider value={propsStoreRef}>
        <ViewSettingsCtx.Provider value={viewSettingsRef}>
          <EngineGeometryCtx.Provider value={engineGeometryRef}>
          <WebGLErrorBoundary height={viewHeight}>
            {isWebGLAvailable() ? (
              <Canvas
                camera={{ position: VIEW_PRESETS[0].position, fov: 42 }}
                style={{ width: "100%", height: "100%" }}
                frameloop="always"
                gl={{ antialias: true, alpha: false, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false }}
                onCreated={({ gl }) => {
                  try {
                    gl.setClearColor("#0e0e0e");
                    gl.toneMapping = THREE.ACESFilmicToneMapping;
                    gl.toneMappingExposure = 1.15;
                  } catch (e) {
                    log.warn('DrivetrainView3D', 'GL onCreated error', e);
                  }
                }}
              >
                <Suspense fallback={null}>
                  <CameraController presetIndex={activePreset} />
                  <DrivetrainScene tireRpm={0} rpm={0} clutchStatus="" clutchSlipPct={0} currentGear={0} currentGearRatio={0} slipPct={0} drivetrainType="FWD" accelerationG={0} throttle={0} />
                </Suspense>
              </Canvas>
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: '#888',
                fontFamily: 'monospace', fontSize: 12, gap: 8,
              }}>
                <span style={{ color: '#ff6b6b', fontSize: 14 }}>⚠ WebGL not detected</span>
                <span>Open in Chrome/Firefox/Edge for the 3D drivetrain view.</span>
              </div>
            )}
          </WebGLErrorBoundary>
          </EngineGeometryCtx.Provider>
        </ViewSettingsCtx.Provider>
      </PropsStoreCtx.Provider>

      {/* Bottom overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 6,
          left: 0,
          right: 0,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: "#a3e635",
            opacity: 0.4,
            fontFamily: "monospace",
            letterSpacing: 2,
          }}
        >
          {(props.drivetrainType || 'FWD').toUpperCase()} DRIVETRAIN — 3D INTERACTIVE (CLICK + DRAG TO ORBIT · SCROLL TO ZOOM)
        </span>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Allow re-render when engine structure changes (cylinder count, engine swap, transmission)
  if (prevProps.numCylinders !== nextProps.numCylinders) return false;
  if (prevProps.engineId !== nextProps.engineId) return false;
  if (prevProps.transmissionModel !== nextProps.transmissionModel) return false;
  if (prevProps.tireWidthMm !== nextProps.tireWidthMm) return false;
  if (prevProps.tireAspectRatio !== nextProps.tireAspectRatio) return false;
  if (prevProps.wheelDiameterIn !== nextProps.wheelDiameterIn) return false;
  // Block re-render for fast-changing animation props — those flow through module-level store
  return true;
});
