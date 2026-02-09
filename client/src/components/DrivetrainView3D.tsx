import React, { useRef, useMemo, useState, useCallback, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";

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

// CV axle
const AXLE_R           = 12.5 * S;   // 0.125
const AXLE_LEN         = 610 * S;    // 6.10
const CV_R             = 38 * S;     // 0.38
const CV_LEN           = 76 * S;     // 0.76
const BOOT_LEN         = 80 * S;     // 0.80

// Transmission case (S4C 5-speed)
const TRANS_L          = 394 * S;    // 3.94  (length along axle)
const TRANS_H          = 356 * S;    // 3.56
const TRANS_D          = 305 * S;    // 3.05  (depth front-to-back)
const DIFF_R           = 63.5 * S;   // 0.635

// Flywheel & clutch
const FW_R             = 130 * S;    // 1.30
const FW_THICK         = 22 * S;     // 0.22
const CLUTCH_R         = 110 * S;    // 1.10
const CLUTCH_THICK     = 12 * S;     // 0.12
const PP_THICK         = 14 * S;     // 0.14  pressure plate

// Brake rotor
const ROTOR_R          = RIM_R * 0.72;
const ROTOR_THICK      = 0.045;

// Hub assembly
const HUB_OR           = 0.40;
const HUB_W            = 0.50;
const KNUCKLE_R        = 0.22;
const KNUCKLE_H        = 1.2;

// Spring / strut  (McPherson front on Civic)
const SPRING_OR        = 0.45;
const SPRING_IR        = 0.35;
const SPRING_H         = 2.8;
const STRUT_R          = 0.12;
const STRUT_H          = 3.5;

// Lower control arm
const LCA_LEN          = 3.5;
const LCA_W            = 0.18;
const LCA_THICK        = 0.08;

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
function TireAndWheel({ rotationAngle }: { rotationAngle: number }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.x = rotationAngle;
    }
  });

  // ── Tire body: LatheGeometry with realistic cross-section ──
  // Points define the tire profile in the XY plane (x = radius from center,
  // y = lateral position along width).  LatheGeometry revolves around Y.
  // After creation, the whole mesh is rotated so the tire axis = X.
  const tireGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const halfW = TIRE_SECTION_W / 2;

    // === Left bead seat (where tire seats on rim flange) ===
    pts.push(new THREE.Vector2(RIM_R + 0.015, -halfW * 0.82));

    // === Left sidewall — subtle convex bulge outward ===
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.06, -halfW * 0.86));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.18, -halfW * 0.91));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.32, -halfW * 0.95));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.48, -halfW * 0.97)); // max bulge
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.62, -halfW * 0.96));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.76, -halfW * 0.92));

    // === Left shoulder — rounded transition from sidewall to tread ===
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.86, -halfW * 0.85));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.94, -halfW * 0.76));
    pts.push(new THREE.Vector2(TIRE_OR - 0.008, -halfW * 0.66));

    // === Tread surface — flat with very subtle crown ===
    pts.push(new THREE.Vector2(TIRE_OR, -halfW * 0.54));
    pts.push(new THREE.Vector2(TIRE_OR + 0.003, -halfW * 0.28));
    pts.push(new THREE.Vector2(TIRE_OR + 0.004, 0));             // crown center
    pts.push(new THREE.Vector2(TIRE_OR + 0.003, halfW * 0.28));
    pts.push(new THREE.Vector2(TIRE_OR, halfW * 0.54));

    // === Right shoulder ===
    pts.push(new THREE.Vector2(TIRE_OR - 0.008, halfW * 0.66));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.94, halfW * 0.76));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.86, halfW * 0.85));

    // === Right sidewall ===
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.76, halfW * 0.92));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.62, halfW * 0.96));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.48, halfW * 0.97));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.32, halfW * 0.95));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.18, halfW * 0.91));
    pts.push(new THREE.Vector2(RIM_R + SIDEWALL_H * 0.06, halfW * 0.86));

    // === Right bead seat ===
    pts.push(new THREE.Vector2(RIM_R + 0.015, halfW * 0.82));

    return new THREE.LatheGeometry(pts, 64);
  }, []);

  // ── Rim barrel: cylinder at rim diameter, width matches bead-to-bead ──
  const barrelW = TIRE_SECTION_W * 0.65;  // ~6.5" rim width for 15x6
  const barrelGeo = useMemo(
    () => new THREE.CylinderGeometry(RIM_R, RIM_R, barrelW, 40, 1, true),
    [],
  );

  // ── 5-spoke angles (EM1 Si 5-spoke alloy) ──
  const SPOKE_COUNT = 5;
  const spokeAngles = useMemo(
    () => Array.from({ length: SPOKE_COUNT }, (_, i) => (i / SPOKE_COUNT) * Math.PI * 2),
    [],
  );

  // ── Spoke window geometry — dark openings between spokes ──
  // Positioned at the mid-radius between hub and rim lip
  const windowR = (HUB_OR + RIM_R * 0.90) / 2;
  const windowLen = RIM_R * 0.48;   // radial span of the opening

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
        <mesh key={`groove-${i}`} rotation={[0, Math.PI / 2, 0]} position={[frac * TIRE_SECTION_W, 0, 0]}>
          <torusGeometry args={[TIRE_OR + 0.001, 0.008, 6, 64]} />
          <meshStandardMaterial color="#0e0e0e" roughness={1} metalness={0} />
        </mesh>
      ))}

      {/* ═══ LATERAL TREAD SIPES ═══ */}
      {/* Small cross-cuts across the tread blocks */}
      {Array.from({ length: 48 }, (_, i) => {
        const angle = (i / 48) * Math.PI * 2;
        const cy = Math.cos(angle) * (TIRE_OR + 0.002);
        const cz = Math.sin(angle) * (TIRE_OR + 0.002);
        return (
          <mesh key={`sipe-${i}`} position={[0, cy, cz]} rotation={[angle, 0, 0]}>
            <boxGeometry args={[TIRE_SECTION_W * 0.48, 0.005, 0.018]} />
            <meshStandardMaterial color="#0d0d0d" roughness={1} />
          </mesh>
        );
      })}

      {/* ═══ SIDEWALL LETTERING (raised text effect) ═══ */}
      {[1, -1].map((side) => {
        const swMidR = RIM_R + SIDEWALL_H * 0.48;  // at max bulge
        return Array.from({ length: 16 }, (_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          const sy = Math.cos(angle) * swMidR;
          const sz = Math.sin(angle) * swMidR;
          return (
            <mesh key={`swt${side}_${i}`} position={[side * TIRE_SECTION_W * 0.38, sy, sz]} rotation={[angle, 0, 0]}>
              <boxGeometry args={[0.015, 0.06, SIDEWALL_H * 0.18]} />
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
          <torusGeometry args={[RIM_R, 0.04, 10, 40]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.92} roughness={0.06} />
        </mesh>
      ))}

      {/* ═══ RIM FACE DISC (outboard) ═══ */}
      {/* Solid ring behind the spokes — visible through spoke windows */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[faceX - 0.05, 0, 0]}>
        <ringGeometry args={[HUB_OR * 0.75, RIM_R * 0.94, 40]} />
        <meshStandardMaterial color="#555" metalness={0.6} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* ═══ SPOKE WINDOWS (dark openings) ═══ */}
      {spokeAngles.map((angle, i) => {
        const midAngle = angle + Math.PI / SPOKE_COUNT; // between two spokes
        const wy = Math.cos(midAngle) * windowR;
        const wz = Math.sin(midAngle) * windowR;
        return (
          <mesh key={`win${i}`} position={[faceX - 0.02, wy, wz]} rotation={[midAngle, 0, 0]}>
            <boxGeometry args={[0.06, windowLen, RIM_R * 0.32]} />
            <meshStandardMaterial color="#222" metalness={0.3} roughness={0.7} />
          </mesh>
        );
      })}

      {/* ═══ 5 SPOKES — tapered from hub to rim ═══ */}
      {spokeAngles.map((angle, i) => {
        const hubEnd = HUB_OR + 0.02;
        const rimEnd = RIM_R * 0.88;
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
      <mesh position={[-barrelW * 0.25, -(RIM_R + SIDEWALL_H * 0.08), 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.13, 8]} />
        <meshStandardMaterial color="#333" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Valve cap */}
      <mesh position={[-barrelW * 0.25, -(RIM_R + SIDEWALL_H * 0.08) - 0.075, 0]}>
        <cylinderGeometry args={[0.022, 0.015, 0.025, 8]} />
        <meshStandardMaterial color="#555" metalness={0.6} roughness={0.4} />
      </mesh>

    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BRAKE ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════════
function BrakeAssembly({ rotationAngle }: { rotationAngle: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.x = rotationAngle;
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
function HubKnuckleSuspension({ position }: { position: [number, number, number] }) {
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
      <group position={[0.1, KNUCKLE_H * 0.4, 0]}>
        {/* Strut body */}
        <mesh>
          <cylinderGeometry args={[STRUT_R, STRUT_R * 0.9, STRUT_H, 16]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Strut rod (chrome) */}
        <mesh position={[0, STRUT_H * 0.45, 0]}>
          <cylinderGeometry args={[STRUT_R * 0.35, STRUT_R * 0.35, STRUT_H * 0.3, 8]} />
          <meshStandardMaterial color="#bbb" metalness={0.95} roughness={0.05} />
        </mesh>
        {/* Strut mount (top hat) */}
        <mesh position={[0, STRUT_H * 0.55, 0]}>
          <cylinderGeometry args={[STRUT_R * 1.5, STRUT_R * 1.3, 0.2, 16]} />
          <meshStandardMaterial color="#333" roughness={0.8} />
        </mesh>

        {/* ── COIL SPRING ── */}
        <CoilSpring
          innerR={SPRING_IR}
          outerR={SPRING_OR}
          height={SPRING_H}
          coils={7}
          wireR={0.04}
        />
      </group>

      {/* ── LOWER CONTROL ARM (A-arm) ── */}
      <group position={[-0.5, -KNUCKLE_H * 0.45, 0]}>
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
  position, rotationAngle, type,
}: {
  position: [number, number, number]; rotationAngle: number;
  type: "tripod" | "rzeppa";
}) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    // CV joint internals rotate around the axle axis (+X)
    if (ref.current) ref.current.rotation.x = rotationAngle;
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
function Flywheel({ position, rotationAngle }: {
  position: [number, number, number]; rotationAngle: number;
}) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    // Rotate around X axis — same direction and axis as the tire
    if (ref.current) ref.current.rotation.x = rotationAngle;
  });

  return (
    <group position={position}>
      <group ref={ref}>
        {/* Main flywheel disc — cylinder axis Y → rotate π/2 around Z so axis = X */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[FW_R, FW_R, FW_THICK, 56]} />
          <meshStandardMaterial color="#6a6a6a" metalness={0.82} roughness={0.18} />
        </mesh>
        {/* Friction surface (lighter ring) */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[FW_R * 0.92, FW_R * 0.55, FW_THICK * 0.3, 48]} />
          <meshStandardMaterial color="#8a8a7a" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Ring gear teeth (outer perimeter) */}
        {Array.from({ length: 33 }, (_, i) => {
          const a = (i / 33) * Math.PI * 2;
          return (
            <mesh
              key={`fwt${i}`}
              position={[0, Math.cos(a) * (FW_R + 0.015), Math.sin(a) * (FW_R + 0.015)]}
              rotation={[a, 0, 0]}
            >
              <boxGeometry args={[FW_THICK * 0.7, 0.03, 0.015]} />
              <meshStandardMaterial color="#555" metalness={0.85} roughness={0.15} />
            </mesh>
          );
        })}
        {/* Bolt pattern (6 bolts) */}
        {Array.from({ length: 6 }, (_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const bR = FW_R * 0.3;
          return (
            <mesh
              key={`fwb${i}`}
              position={[FW_THICK * 0.55, Math.cos(angle) * bR, Math.sin(angle) * bR]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.03, 0.03, 0.04, 6]} />
              <meshStandardMaterial color="#444" metalness={0.9} roughness={0.1} />
            </mesh>
          );
        })}
        {/* Pilot bearing hole */}
        <mesh rotation={[0, Math.PI / 2, 0]} position={[FW_THICK * 0.4, 0, 0]}>
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

  useFrame(() => {
    if (discRef.current) discRef.current.rotation.x = rotationAngle;
  });

  const isEngaged = clutchStatus === "ENGAGED" || clutchStatus === "SPINNING";
  const discOffset = isEngaged ? 0 : 0.04;

  return (
    <group position={position}>
      {/* Pressure plate (bolted to flywheel, always spins with engine) */}
      <group ref={discRef}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[CLUTCH_R, CLUTCH_R, PP_THICK, 36]} />
          <meshStandardMaterial color="#5a5a5a" metalness={0.75} roughness={0.25} />
        </mesh>
        {/* Diaphragm spring fingers */}
        {Array.from({ length: 18 }, (_, i) => {
          const angle = (i / 18) * Math.PI * 2;
          const r = CLUTCH_R * 0.45;
          return (
            <mesh
              key={`ppf${i}`}
              position={[PP_THICK * 0.55, Math.cos(angle) * r, Math.sin(angle) * r]}
              rotation={[angle, 0, Math.PI / 12]}
            >
              <boxGeometry args={[0.01, CLUTCH_R * 0.4, 0.02]} />
              <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
            </mesh>
          );
        })}
      </group>

      {/* Clutch disc (friction disc) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[discOffset, 0, 0]}>
        <cylinderGeometry args={[CLUTCH_R * 0.95, CLUTCH_R * 0.35, CLUTCH_THICK, 36]} />
        <meshStandardMaterial
          color={isEngaged ? "#4a4a3a" : "#5a5a4a"}
          metalness={0.3}
          roughness={0.85}
        />
      </mesh>
      {/* Friction material ring */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[discOffset, 0, 0]}>
        <torusGeometry args={[CLUTCH_R * 0.72, 0.015, 6, 32]} />
        <meshStandardMaterial color="#3a3a2a" roughness={0.95} />
      </mesh>

      {/* Status indicator */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[discOffset, 0, 0]}>
        <torusGeometry args={[CLUTCH_R * 0.5, 0.008, 4, 24]} />
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
  // Internal gear shafts (simplified)
  const gearPositions = useMemo(() => {
    const gears: { x: number; r1: number; r2: number; label: string }[] = [
      { x: -TRANS_L * 0.35, r1: 0.25, r2: 0.45, label: "1" },
      { x: -TRANS_L * 0.18, r1: 0.30, r2: 0.40, label: "2" },
      { x: 0,               r1: 0.33, r2: 0.37, label: "3" },
      { x: TRANS_L * 0.18,  r1: 0.36, r2: 0.34, label: "4" },
      { x: TRANS_L * 0.35,  r1: 0.38, r2: 0.32, label: "5" },
    ];
    return gears;
  }, []);

  const gearNum = typeof currentGear === "number" ? currentGear : parseInt(String(currentGear)) || 0;

  return (
    <group position={position}>
      {/* Main case shell */}
      <mesh>
        <boxGeometry args={[TRANS_D, TRANS_H * 0.65, TRANS_L * 0.55]} />
        <meshPhysicalMaterial
          color="#35c96e"
          transparent
          opacity={0.14}
          roughness={0.3}
          metalness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Case ribbing */}
      {[-0.4, -0.2, 0, 0.2, 0.4].map((f, i) => (
        <mesh key={`rib${i}`} position={[0, f * TRANS_H * 0.3, 0]}>
          <boxGeometry args={[TRANS_D * 1.02, 0.02, TRANS_L * 0.57]} />
          <meshPhysicalMaterial color="#3ad97e" transparent opacity={0.08} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Bellhousing */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[-TRANS_D * 0.15, 0, -TRANS_L * 0.35]}>
        <cylinderGeometry args={[TRANS_H * 0.36, TRANS_H * 0.28, TRANS_D * 0.40, 28]} />
        <meshPhysicalMaterial
          color="#35c96e"
          transparent
          opacity={0.12}
          roughness={0.3}
          metalness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Differential bulge */}
      <mesh position={[0, -TRANS_H * 0.12, TRANS_L * 0.22]}>
        <sphereGeometry args={[DIFF_R, 28, 28]} />
        <meshPhysicalMaterial
          color="#2eb86a"
          transparent
          opacity={0.18}
          roughness={0.25}
          metalness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Mainshaft (input shaft) */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, TRANS_L * 0.5, 12]} />
        <meshStandardMaterial color="#aaa" metalness={0.85} roughness={0.15} transparent opacity={0.6} />
      </mesh>

      {/* Countershaft */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, -TRANS_H * 0.15, 0]}>
        <cylinderGeometry args={[0.055, 0.055, TRANS_L * 0.5, 12]} />
        <meshStandardMaterial color="#999" metalness={0.85} roughness={0.15} transparent opacity={0.5} />
      </mesh>

      {/* Gear pairs */}
      {gearPositions.map((gp, i) => {
        const isActive = gearNum === i + 1;
        return (
          <group key={`gear${i}`}>
            {/* Mainshaft gear */}
            <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 0, gp.x]}>
              <torusGeometry args={[gp.r1, 0.025, 8, 24]} />
              <meshStandardMaterial
                color={isActive ? "#44ff88" : "#888"}
                metalness={0.8}
                roughness={0.2}
                emissive={isActive ? "#22aa44" : "#000"}
                emissiveIntensity={isActive ? 0.3 : 0}
              />
            </mesh>
            {/* Countershaft gear */}
            <mesh rotation={[0, Math.PI / 2, 0]} position={[0, -TRANS_H * 0.15, gp.x]}>
              <torusGeometry args={[gp.r2, 0.025, 8, 24]} />
              <meshStandardMaterial
                color={isActive ? "#44ff88" : "#777"}
                metalness={0.8}
                roughness={0.2}
                emissive={isActive ? "#22aa44" : "#000"}
                emissiveIntensity={isActive ? 0.3 : 0}
              />
            </mesh>
          </group>
        );
      })}

      {/* Shift forks */}
      {[-1, 0, 1].map((f, i) => (
        <mesh key={`fork${i}`} position={[0, TRANS_H * 0.15, f * TRANS_L * 0.12]}>
          <boxGeometry args={[0.03, TRANS_H * 0.25, 0.04]} />
          <meshStandardMaterial color="#bbb" metalness={0.8} roughness={0.2} transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Shift rod */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, TRANS_H * 0.2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, TRANS_L * 0.45, 8]} />
        <meshStandardMaterial color="#ccc" metalness={0.9} roughness={0.1} transparent opacity={0.4} />
      </mesh>

      {/* Bellhousing bolts */}
      {Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const boltR = TRANS_H * 0.3;
        return (
          <mesh
            key={`tbolt${i}`}
            position={[-TRANS_D * 0.35, Math.cos(angle) * boltR, -TRANS_L * 0.35 + Math.sin(angle) * boltR]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.025, 0.025, 0.06, 6]} />
            <meshStandardMaterial color="#555" metalness={0.9} roughness={0.1} />
          </mesh>
        );
      })}

      {/* Speed sensor */}
      <mesh position={[TRANS_D * 0.45, -TRANS_H * 0.1, TRANS_L * 0.15]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[0.04, 0.035, 0.3, 8]} />
        <meshStandardMaterial color="#222" roughness={0.8} />
      </mesh>

      {/* Drain plug */}
      <mesh position={[0, -TRANS_H * 0.34, TRANS_L * 0.05]}>
        <cylinderGeometry args={[0.04, 0.04, 0.06, 6]} />
        <meshStandardMaterial color="#555" metalness={0.85} roughness={0.15} />
      </mesh>
    </group>
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
// TELEMETRY HUD
// ═══════════════════════════════════════════════════════════════════════════
function TelemetryHUD(props: DrivetrainView3DProps) {
  const { rpm, tireRpm, clutchStatus, clutchSlipPct, currentGear, currentGearRatio, slipPct, drivetrainType } = props;
  const safeRpm = sn(rpm);
  const safeTireRpm = sn(tireRpm);
  const safeSlip = sn(slipPct);
  const safeRatio = sn(currentGearRatio);
  const safeClutchSlip = sn(clutchSlipPct);

  const gearLabel = currentGear === 0 ? "N" : String(currentGear);
  const clutchColor =
    clutchStatus === "ENGAGED" ? "#22cc44"
    : clutchStatus === "SLIPPING" ? "#ff4444"
    : clutchStatus === "SPINNING" ? "#ffaa00"
    : clutchStatus === "DISENGAGED" ? "#cc2222"
    : clutchStatus === "SHIFTING" ? "#4488ff"
    : "#666";

  return (
    <group position={[0, 4.5, 0]}>
      <Label3D position={[0, 0, 0]} color="#a3e635" fontSize={28}>{gearLabel}</Label3D>
      <Label3D position={[0, -0.55, 0]} color="#6ee7b7" fontSize={11}>
        {safeRatio > 0 ? `${safeRatio.toFixed(3)} : 1` : "NEUTRAL"}
      </Label3D>
      <Label3D position={[0, -0.85, 0]} color="#7dd3fc" fontSize={9}>
        {drivetrainType || "FWD"}
      </Label3D>
      <Label3D position={[-4, -0.2, 0]} color="#f0f0f0" fontSize={12}>
        {`ENGINE  ${Math.round(safeRpm)} RPM`}
      </Label3D>
      <Label3D position={[-4, -0.55, 0]} color="#aaa" fontSize={10}>
        {`TIRE    ${Math.round(safeTireRpm)} RPM`}
      </Label3D>
      <Label3D position={[4, -0.2, 0]} color={clutchColor} fontSize={10}>
        {`CLUTCH: ${clutchStatus}`}
      </Label3D>
      <Label3D position={[4, -0.55, 0]} color={safeClutchSlip > 5 ? "#ff4444" : safeClutchSlip > 1 ? "#ffaa00" : "#888"} fontSize={10}>
        {`CLUTCH SLIP: ${safeClutchSlip.toFixed(1)}%`}
      </Label3D>
      <Label3D position={[4, -0.9, 0]} color={safeSlip > 10 ? "#ff6644" : safeSlip > 3 ? "#ffaa00" : "#888"} fontSize={10}>
        {`TIRE SLIP: ${safeSlip.toFixed(1)}%`}
      </Label3D>
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
  const labelY = -4.2;
  return (
    <group>
      <Label3D position={[tirePos, labelY, 0]} color="#666">195/55R15</Label3D>
      <Label3D position={[tirePos, labelY - 0.3, 0]} color="#555" fontSize={9}>23.4&quot; DIA</Label3D>
      <Label3D position={[hubPos, labelY, 0]} color="#666">HUB / KNUCKLE</Label3D>
      <Label3D position={[outerCvX, labelY, 0]} color="#666">RZEPPA (OUTER)</Label3D>
      <Label3D position={[shaftCenterX, labelY + 1.8, 0]} color="#666">CV HALF-SHAFT 610mm</Label3D>
      <Label3D position={[innerCvX, labelY, 0]} color="#666">TRIPOD (INNER)</Label3D>
      <Label3D position={[transPos, labelY, 0]} color="#5ae895" fontSize={12}>S4C 5-SPEED</Label3D>
      <Label3D position={[transPos, labelY - 0.3, 0]} color="#4ac07a" fontSize={9}>FINAL DRIVE 4.400</Label3D>
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
// SHIFT LEVER + CABLE LINKAGE  (Honda cable-operated shifter)
// ═══════════════════════════════════════════════════════════════════════════
// BeamNG-style approach: shifter is a "prop" positioned relative to cabin
// reference nodes. The Honda EM1 shifter sits on the center tunnel between
// driver and passenger seats, ~700–900mm behind the front axle centerline.
// Two shift cables (select + shift) route forward under the floor tunnel,
// through the firewall, and connect to the transmission shift arm.
// ═══════════════════════════════════════════════════════════════════════════
const LEVER_H          = 1.6;       // shift lever height from pivot
const LEVER_KNOB_R     = 0.12;

// Cabin reference position (center console, floor tunnel)
// Z = longitudinal (negative = behind front axle), X = 0 (centered), Y = height
const SHIFTER_X = 0;                // centered between seats
const SHIFTER_Y = -1.4;             // floor tunnel height (~160mm above ground)
const SHIFTER_Z = -8.0;             // ~800mm behind front axle

function CabinShifter({
  currentGear, transX,
}: {
  currentGear: number | string; transX: number;
}) {
  const gearNum = typeof currentGear === "number" ? currentGear : parseInt(String(currentGear)) || 0;

  // H-pattern gate positions (Honda 5-speed):
  //   1  3  5       X-offset (left/right in gate)
  //   2  4  R       Z-offset (forward/back)
  const gatePositions: Record<number, [number, number]> = {
    0: [0, 0],        // Neutral (center)
    1: [-0.18, 0.12], // 1st: left-forward
    2: [-0.18, -0.12],// 2nd: left-back
    3: [0, 0.12],     // 3rd: center-forward
    4: [0, -0.12],    // 4th: center-back
    5: [0.18, 0.12],  // 5th: right-forward
  };
  const [gateX, gateZ] = gatePositions[gearNum] || [0, 0];

  // Transmission shift arm (cable endpoint)
  const transShiftArmY = TRANS_H * 0.25;

  return (
    <group>
      {/* ── CABIN FLOOR / CONSOLE REFERENCE ── */}
      <group position={[SHIFTER_X, SHIFTER_Y, SHIFTER_Z]}>
        {/* Center tunnel (floor pan section) */}
        <mesh>
          <boxGeometry args={[1.2, 0.08, 2.5]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.1} />
        </mesh>
        {/* Console surround / boot ring */}
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.5, 0.04, 0.6]} />
          <meshStandardMaterial color="#111" roughness={0.85} metalness={0.2} />
        </mesh>
        {/* Gate plate */}
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.6, 0.02, 0.5]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Gate slot cutouts (H-pattern grooves) */}
        {[[-0.18, 0], [0, 0], [0.18, 0]].map(([gx, gz], i) => (
          <mesh key={`slot${i}`} position={[gx, 0.115, gz]}>
            <boxGeometry args={[0.04, 0.015, 0.3]} />
            <meshStandardMaterial color="#333" roughness={0.9} />
          </mesh>
        ))}
        {/* Crossgate (connects the 3 vertical slots) */}
        <mesh position={[0, 0.115, 0]}>
          <boxGeometry args={[0.5, 0.015, 0.04]} />
          <meshStandardMaterial color="#333" roughness={0.9} />
        </mesh>

        {/* ── LEVER ASSEMBLY — animated per gear selection ── */}
        <group position={[gateX, 0.12, gateZ]}>
          {/* Lever shaft */}
          <mesh position={[0, LEVER_H * 0.5, 0]}>
            <cylinderGeometry args={[0.025, 0.035, LEVER_H, 8]} />
            <meshStandardMaterial color="#888" metalness={0.85} roughness={0.15} />
          </mesh>
          {/* Shift knob (round, Honda OEM style) */}
          <mesh position={[0, LEVER_H + 0.05, 0]}>
            <sphereGeometry args={[LEVER_KNOB_R, 16, 12]} />
            <meshStandardMaterial color="#222" roughness={0.6} metalness={0.2} />
          </mesh>
          {/* Leather shift boot (accordion) */}
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.14, 0.06, 0.25, 12]} />
            <meshStandardMaterial color="#111" roughness={0.95} />
          </mesh>
        </group>

        {/* Console label */}
        <Label3D position={[0, -0.4, 0]} color="#555" fontSize={9}>SHIFTER (CENTER CONSOLE)</Label3D>
      </group>

      {/* ── SELECT CABLE (lateral L/R movement) ── */}
      {/* Routes: shifter base → down through floor → forward under car → up to trans */}
      <ShiftCable
        from={[SHIFTER_X - 0.05, SHIFTER_Y - 0.04, SHIFTER_Z + 0.1]}
        to={[transX + 0.1, transShiftArmY + 0.1, 0.4]}
        color="#555"
      />

      {/* ── SHIFT CABLE (fore/aft engagement) ── */}
      <ShiftCable
        from={[SHIFTER_X + 0.05, SHIFTER_Y - 0.04, SHIFTER_Z - 0.1]}
        to={[transX - 0.1, transShiftArmY, 0.35]}
        color="#666"
      />

      {/* Cable bracket on transmission */}
      <mesh position={[transX, transShiftArmY + 0.05, 0.38]}>
        <boxGeometry args={[0.2, 0.08, 0.1]} />
        <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} />
      </mesh>
      <Label3D position={[transX, transShiftArmY + 0.25, 0.4]} color="#555" fontSize={8}>CABLE BRACKET</Label3D>
    </group>
  );
}

// Shift cable path — realistic routing from cabin to engine bay
function ShiftCable({
  from, to, color,
}: {
  from: [number, number, number]; to: [number, number, number]; color: string;
}) {
  const points = useMemo(() => {
    const [x0, y0, z0] = from;
    const [x1, y1, z1] = to;
    const floorY = -TIRE_OR + 0.2;  // just above ground plane
    // Route: down from shifter → along floor tunnel → forward under car →
    //        rise through firewall → to trans shift arm
    const pts = [
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x0, floorY, z0),                         // drop to floor
      new THREE.Vector3(x0 * 0.5 + x1 * 0.5, floorY, z0 * 0.6), // under floor, heading forward
      new THREE.Vector3(x1, floorY, z1 * 0.5 + z0 * 0.1),        // approaching engine bay
      new THREE.Vector3(x1, y1 + 0.4, z1 * 0.8),                 // rise through firewall
      new THREE.Vector3(x1, y1, z1),                              // attach to trans
    ];
    return new THREE.CatmullRomCurve3(pts).getPoints(32);
  }, [from, to]);

  const lineGeo = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  const lineObj = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color });
    return new THREE.Line(lineGeo, mat);
  }, [lineGeo, color]);

  return (
    <group>
      <primitive object={lineObj} />
      {/* Cable housing ferrules at each end */}
      {[from, to].map((pt, i) => (
        <mesh key={`ferrule${i}`} position={pt}>
          <cylinderGeometry args={[0.025, 0.025, 0.06, 6]} />
          <meshStandardMaterial color="#777" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
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
  position, rotationAngle, side, showSuspension = true,
}: {
  position: [number, number, number]; rotationAngle: number;
  side: 'left' | 'right'; showSuspension?: boolean;
}) {
  const mirror: [number, number, number] = side === 'left' ? [-1, 1, 1] : [1, 1, 1];
  return (
    <group position={position} scale={mirror}>
      {/* Tire + Wheel at origin */}
      <TireAndWheel rotationAngle={rotationAngle} />
      {/* Brake assembly inboard of wheel */}
      <group position={[-1.1, 0, 0]}>
        <BrakeAssembly rotationAngle={rotationAngle} />
      </group>
      {/* Hub / Knuckle / McPherson strut / LCA / tie rod / sway bar */}
      {showSuspension && (
        <HubKnuckleSuspension position={[-1.2, 0, 0]} />
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
  from, to, rotationAngle, active,
}: {
  from: [number, number, number]; to: [number, number, number];
  rotationAngle: number; active: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => { if (ref.current && active) ref.current.rotation.z = rotationAngle; });
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
  position, rotationAngle, diffType, active,
}: {
  position: [number, number, number]; rotationAngle: number;
  diffType: string; active: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => { if (ref.current && active) ref.current.rotation.x = rotationAngle * 0.3; });
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
  rotationAngle, drivetrainType, rearDiffType,
}: {
  rotationAngle: number;
  drivetrainType: string; rearDiffType: string;
}) {
  const isRearDriven = drivetrainType === 'RWD' || drivetrainType === 'AWD';
  const rearZ = REAR_AXLE_Z;
  // Rear wheels spread symmetrically about X=0 — same track as front
  const rearTireX_R = 9.0;
  const rearTireX_L = -9.0;

  return (
    <group position={[0, 0, rearZ]}>
      {/* Rear right wheel — full assembly facing outward */}
      <WheelCornerAssembly
        position={[rearTireX_R, 0, 0]}
        rotationAngle={isRearDriven ? rotationAngle : rotationAngle * 0.95}
        side="right"
      />
      {/* Rear left wheel — full assembly mirrored outward */}
      <WheelCornerAssembly
        position={[rearTireX_L, 0, 0]}
        rotationAngle={isRearDriven ? rotationAngle : rotationAngle * 0.95}
        side="left"
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
  tireX, transX, rotationAngle, isFrontDriven,
}: {
  tireX: number; transX: number;
  rotationAngle: number; isFrontDriven: boolean;
}) {
  // Passenger-side positions: mirrored from driver (negative X)
  const pTireX = -tireX;
  // CV assembly from trans left output to passenger wheel
  const pHubX = pTireX + 1.2;         // hub is inboard of tire (toward center)
  const pOuterCvX = pHubX + 1.5;      // outer CV inboard of hub
  // Inner CV must clear the flywheel + clutch disc entirely
  const fwX_p = transX - TRANS_D * 0.5 - CLUTCH_THICK - 0.1 - FW_THICK - 0.1;
  const pInnerCvX = fwX_p - FW_THICK * 0.5 - CV_LEN * 0.5 - 0.5;
  const pShaftMidX = (pOuterCvX + pInnerCvX) / 2;
  const pShaftLen = Math.abs(pOuterCvX - pInnerCvX) - CV_LEN;

  return (
    <group>
      {/* Full wheel + brake + suspension — mirrored for left side */}
      <WheelCornerAssembly
        position={[pTireX, 0, 0]}
        rotationAngle={rotationAngle}
        side="left"
      />

      {isFrontDriven && (
        <>
          {/* Outer CV joint (Rzeppa) */}
          <CVJoint position={[pOuterCvX, 0, 0]} rotationAngle={rotationAngle} type="rzeppa" />
          {/* Outer CV boot */}
          <CVBoot
            length={BOOT_LEN}
            innerR={AXLE_R * 1.6}
            outerR={CV_R * 0.75}
            position={[pOuterCvX + CV_LEN * 0.5, 0, 0]}
            flipDirection={false}
          />
          {/* Axle shaft */}
          <AxleShaft position={[pShaftMidX, 0, 0]} length={Math.max(pShaftLen, 0.3)} />
          {/* Inner CV boot */}
          <CVBoot
            length={BOOT_LEN}
            innerR={AXLE_R * 1.6}
            outerR={CV_R * 0.75}
            position={[pInnerCvX - CV_LEN * 0.5 - BOOT_LEN, 0, 0]}
            flipDirection={true}
          />
          {/* Inner CV joint (Tripod) */}
          <CVJoint position={[pInnerCvX, 0, 0]} rotationAngle={rotationAngle} type="tripod" />
        </>
      )}
    </group>
  );
}

function GroundAndEnvironment() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -TIRE_OR - 0.05, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.95} metalness={0.05} />
      </mesh>
      <gridHelper args={[40, 40, "#1a1a1a", "#141414"]} position={[0, -TIRE_OR - 0.04, 0]} />
      {/* 1m scale bar */}
      <group position={[0, -TIRE_OR - 0.02, 5]}>
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
function DrivetrainScene(props: DrivetrainView3DProps) {
  const { tireRpm, rpm, clutchStatus, currentGear, slipPct, drivetrainType } = props;

  const dtType = drivetrainType || 'FWD';
  const isFrontDriven = dtType === 'FWD' || dtType === 'AWD';
  const isRearDriven = dtType === 'RWD' || dtType === 'AWD';

  // Cumulative rotation refs
  const tireRotRef = useRef(0);
  const fwRotRef = useRef(0);
  const prevTimeRef = useRef(performance.now());

  const safeTireRpm = sn(tireRpm);
  const safeRpm = sn(rpm);

  useFrame(() => {
    const now = performance.now();
    let dt = (now - prevTimeRef.current) / 1000;
    prevTimeRef.current = now;
    // Clamp dt to prevent huge jumps (same guard as sim engine)
    if (dt > 0.1) dt = 0.016;
    if (dt < 0) dt = 0.016;

    // Flywheel always spins at engine RPM
    fwRotRef.current += (safeRpm / 60) * Math.PI * 2 * dt;
    // Tire/CV/axle spin at tire RPM
    tireRotRef.current += (safeTireRpm / 60) * Math.PI * 2 * dt;

    // Prevent floating point overflow after long sessions
    if (Math.abs(fwRotRef.current) > 1e6) fwRotRef.current %= (Math.PI * 2);
    if (Math.abs(tireRotRef.current) > 1e6) tireRotRef.current %= (Math.PI * 2);
  });

  // ── LAYOUT (everything along +X axis, tire on right, trans on left) ──
  // tireX=9.0 gives enough clearance for the passenger-side wheel
  // to sit past the flywheel / clutch without clipping.
  const tireX      = 9.0;
  const hubX       = tireX - 1.2;
  const outerCvX   = hubX - 1.5;
  const innerCvX   = outerCvX - AXLE_LEN + CV_LEN;
  const transX     = innerCvX - 2.5;
  const clutchX    = transX - TRANS_D * 0.5 - CLUTCH_THICK - 0.1;
  const fwX        = clutchX - FW_THICK - 0.1;

  const shaftLen   = outerCvX - innerCvX - CV_LEN;
  const shaftMidX  = (innerCvX + outerCvX) / 2;

  return (
    <>
      {/* ── LIGHTING ── */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 8, 6]} intensity={1.0} castShadow />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} />
      <pointLight position={[0, 2, 6]} intensity={0.25} color="#90ee90" />
      <pointLight position={[tireX, -2, 3]} intensity={0.15} color="#a3e635" />

      {/* ── GROUND ── */}
      <GroundAndEnvironment />

      {/* ── DRIVER FRONT WHEEL CORNER (right side — outboard faces +X) ── */}
      <WheelCornerAssembly
        position={[tireX, 0, 0]}
        rotationAngle={tireRotRef.current}
        side="right"
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

      {/* ── CABIN SHIFTER + SHIFT CABLES (BeamNG-style prop) ── */}
      <CabinShifter currentGear={currentGear} transX={transX} />

      {/* ── PASSENGER FRONT WHEEL (left side — mirrored outboard) ── */}
      <PassengerFrontAssembly
        tireX={tireX}
        transX={transX}
        rotationAngle={tireRotRef.current}
        isFrontDriven={isFrontDriven}
      />

      {/* ── REAR AXLE ASSEMBLY (both rear wheels + diff/torsion beam) ── */}
      <RearAxleAssembly
        rotationAngle={tireRotRef.current}
        drivetrainType={dtType}
        rearDiffType={props.drivetrainType === 'FWD' ? 'open' : 'lsd'}
      />

      {/* ── PROPSHAFT (RWD/AWD only) ── */}
      <MainPropShaft
        transX={transX}
        rotationAngle={fwRotRef.current}
        active={isRearDriven}
      />

      {/* ── HUD ── */}
      <TelemetryHUD {...props} />

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
        label="610mm"
        color="#5a5a5a"
      />
      <DimensionLine
        from={[tireX - TIRE_OR, -3.5, 0]}
        to={[tireX + TIRE_OR, -3.5, 0]}
        label="595.5mm dia"
        color="#5a5a5a"
      />
    </>
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
  { label: "Flywheel",    position: [-6, 1, 5],       target: [-4, 0, 0] },
  { label: "Rear Axle",   position: [0, 4, -20],      target: [0, 0, -26] },
  { label: "Shifter",     position: [2, 2, -5],       target: [0, -1, -8] },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORTED COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export function DrivetrainView3D(props: DrivetrainView3DProps) {
  const [activePreset, setActivePreset] = useState(0);

  const applyPreset = useCallback((idx: number) => {
    setActivePreset(idx);
  }, []);

  const preset = VIEW_PRESETS[activePreset];

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 960,
        height: 480,
        margin: "0 auto",
        background: "linear-gradient(180deg, #111 0%, #0a0a0a 100%)",
        borderRadius: 12,
        overflow: "hidden",
        cursor: "grab",
        position: "relative",
        border: "1px solid #222",
      }}
    >
      {/* View preset buttons */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          display: "flex",
          gap: 4,
          zIndex: 10,
          pointerEvents: "auto",
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

      <Canvas
        key={activePreset}
        camera={{ position: preset.position, fov: 42 }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0e0e0e");
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
      >
        <Suspense fallback={null}>
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={2}
            maxDistance={30}
            target={preset.target}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.6}
          />
          <DrivetrainScene {...props} />
        </Suspense>
      </Canvas>

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
}
