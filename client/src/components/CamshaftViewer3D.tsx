// ═══════════════════════════════════════════════════════════════════════════
// 3D CAMSHAFT VIEWER — Interactive visualization with live lobe changes
// ═══════════════════════════════════════════════════════════════════════════
// Renders a DOHC camshaft (B16A2 style) with:
//   • 4 intake lobes + 4 exhaust lobes
//   • Lobe profile driven by lift (mm) and duration (deg) from EcuConfig
//   • Live updates when cam parameters change
//   • Orbit controls for zoom/rotate/pan
//   • RPM-based rotation animation
// ═══════════════════════════════════════════════════════════════════════════

import React, { useRef, useMemo, useCallback, memo, Suspense, Component, ErrorInfo, ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { useTheme, type ThemeColors } from '@/lib/theme';

// ── Types ─────────────────────────────────────────────────────────────
export interface CamshaftViewer3DProps {
  // Low cam profile
  lowCamIntakeLiftMm: number;
  lowCamExhaustLiftMm: number;
  lowCamIntakeDuration: number;
  lowCamExhaustDuration: number;
  // VTEC cam profile
  vtecIntakeLiftMm: number;
  vtecExhaustLiftMm: number;
  vtecIntakeDuration: number;
  vtecExhaustDuration: number;
  // Live state
  rpm: number;
  vtecActive: boolean;
  // Engine config
  numCylinders?: number;
  // Size
  height?: number;
}

// ── Constants — Real B16A2 DOHC VTEC camshaft dimensions ──────────────
// All measurements from Honda FSM and aftermarket cam manufacturer data.
// Scene scale: 1 unit ≈ 10mm for visual clarity; actual mm values noted.
const S_CAM = 0.01;                       // mm → scene units
const SHAFT_RADIUS = 13 * S_CAM;          // 0.13  (journal dia 26mm → r=13mm)
const DEFAULT_NUM_CYLINDERS = 4;
const LOBE_SEGMENTS = 64;                 // Angular resolution for lobe profile
const LOBE_SPACING = 87 * S_CAM;          // 0.87  (follows 87mm bore spacing)
const LOBE_WIDTH = 14.5 * S_CAM;          // 0.145 (lobe axial width ~14.5mm)
const BASE_CIRCLE_R = 15.25 * S_CAM;      // 0.1525 (base circle dia ~30.5mm → r=15.25mm)
const EXHAUST_OFFSET = 30 * S_CAM;        // 0.30  (axial offset between intake and exhaust lobes ~30mm)

/** Compute shaft length from cylinder count */
function getShaftLength(numCylinders: number): number {
  return (numCylinders * 87 + 50) * S_CAM; // bore spacing * cylinders + end journals
}

// ── Lobe profile generator ────────────────────────────────────────────
// Creates a 2D profile shape with realistic cam lobe geometry
// liftMm: peak lift in mm, durationDeg: lobe duration in crank degrees
function createLobeProfile(liftMm: number, durationDeg: number): THREE.Shape {
  const shape = new THREE.Shape();
  const liftScaled = liftMm * S_CAM;  // mm to scene units (e.g. 10.6mm → 0.106)
  const halfAngle = (durationDeg / 2) * (Math.PI / 360); // duration/2 in radians (cam rotates at half crank speed)

  // Generate smooth cam profile using harmonic lift model
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= LOBE_SEGMENTS; i++) {
    const angle = (i / LOBE_SEGMENTS) * Math.PI * 2;
    let r = BASE_CIRCLE_R;

    // Lift region: smooth rise and fall using cosine profile
    const angleFromNose = Math.abs(((angle + Math.PI) % (Math.PI * 2)) - Math.PI);
    if (angleFromNose < halfAngle) {
      const t = angleFromNose / halfAngle; // 0 at nose, 1 at flank
      // Polydyne-style lift: smooth acceleration/deceleration
      const lift = liftScaled * (1 - (1 - Math.cos(t * Math.PI)) / 2);
      r += lift;
    }
    points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }

  // Build shape from points
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }
  shape.closePath();
  return shape;
}

// ── Single Cam Lobe mesh ──────────────────────────────────────────────
const CamLobe = memo(function CamLobe({
  liftMm,
  durationDeg,
  position,
  color,
  isActive,
  label,
}: {
  liftMm: number;
  durationDeg: number;
  position: [number, number, number];
  color: string;
  isActive: boolean;
  label: string;
}) {
  const geometry = useMemo(() => {
    const shape = createLobeProfile(liftMm, durationDeg);
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: LOBE_WIDTH,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.01,
      bevelSegments: 3,
    };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    // Rotate to align extrusion along X axis (camshaft axis)
    geo.rotateY(Math.PI / 2);
    return geo;
  }, [liftMm, durationDeg]);

  return (
    <group position={position}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          metalness={0.7}
          roughness={0.3}
          emissive={isActive ? color : "#000"}
          emissiveIntensity={isActive ? 0.15 : 0}
        />
      </mesh>
      <Html position={[0, BASE_CIRCLE_R + liftMm * 0.03 + 0.15, 0]} center>
        <div style={{
          fontSize: 8,
          fontFamily: "'JetBrains Mono', monospace",
          color: isActive ? color : '#666',
          whiteSpace: 'nowrap',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
});

// ── Camshaft assembly (shaft + all lobes) ─────────────────────────────
function CamshaftAssembly({
  lowIntake, lowExhaust, vtecIntake, vtecExhaust, rpm, vtecActive, numCylinders = DEFAULT_NUM_CYLINDERS,
}: {
  lowIntake: { lift: number; duration: number };
  lowExhaust: { lift: number; duration: number };
  vtecIntake: { lift: number; duration: number };
  vtecExhaust: { lift: number; duration: number };
  rpm: number;
  vtecActive: boolean;
  numCylinders?: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const cylCount = Math.max(1, numCylinders);
  const shaftLength = getShaftLength(cylCount);

  // Rotate at half crank speed (cam speed)
  useFrame((_, delta) => {
    if (groupRef.current && rpm > 0) {
      const camRps = (rpm / 60) / 2; // cam rotates at half crank speed
      groupRef.current.rotation.x += camRps * 2 * Math.PI * delta;
    }
  });

  // Active cam profiles for current state
  const intake = vtecActive ? vtecIntake : lowIntake;
  const exhaust = vtecActive ? vtecExhaust : lowExhaust;
  const intakeColor = vtecActive ? "#22c55e" : "#3b82f6";  // Green for VTEC, blue for low cam
  const exhaustColor = vtecActive ? "#f59e0b" : "#ef4444"; // Amber for VTEC, red for low cam

  // Generate lobe angles: evenly spaced across 720° crank (360° cam)
  // e.g. 4-cyl: 0°, 90°, 180°, 270° cam; 6-cyl: 0°, 60°, 120°, 180°, 240°, 300°
  const lobeAngles = useMemo(() => {
    return Array.from({ length: cylCount }, (_, i) => (i / cylCount) * Math.PI * 2);
  }, [cylCount]);

  const startX = -LOBE_SPACING * (cylCount - 1) / 2;

  return (
    <group ref={groupRef}>
      {/* Main shaft */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, shaftLength, 24]} />
        <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Bearing journals (wider sections) */}
      {[...Array(cylCount + 1)].map((_, i) => {
        const x = startX - LOBE_SPACING * 0.6 + i * LOBE_SPACING;
        return (
          <mesh key={`journal-${i}`} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[SHAFT_RADIUS * 1.25, SHAFT_RADIUS * 1.25, 0.12, 20]} />
            <meshStandardMaterial color="#555" metalness={0.85} roughness={0.15} />
          </mesh>
        );
      })}

      {/* Intake lobes (per cylinder) */}
      {lobeAngles.map((angle, i) => (
        <group key={`intake-${i}`} rotation={[angle, 0, 0]}>
          <CamLobe
            liftMm={intake.lift}
            durationDeg={intake.duration}
            position={[startX + i * LOBE_SPACING, 0, 0]}
            color={intakeColor}
            isActive={vtecActive}
            label={`IN ${i + 1}`}
          />
        </group>
      ))}

      {/* Exhaust lobes (per cylinder, offset axially) */}
      {lobeAngles.map((angle, i) => (
        <group key={`exhaust-${i}`} rotation={[angle + Math.PI * 0.6, 0, 0]}>
          <CamLobe
            liftMm={exhaust.lift}
            durationDeg={exhaust.duration}
            position={[startX + i * LOBE_SPACING + EXHAUST_OFFSET, 0, 0]}
            color={exhaustColor}
            isActive={vtecActive}
            label={`EX ${i + 1}`}
          />
        </group>
      ))}

      {/* Cam gear (sprocket end) */}
      <mesh position={[shaftLength / 2 - 0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.4, 0.08, 32]} />
        <meshStandardMaterial color="#444" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Gear teeth (simplified) */}
      {[...Array(24)].map((_, i) => {
        const ang = (i / 24) * Math.PI * 2;
        return (
          <mesh
            key={`tooth-${i}`}
            position={[
              shaftLength / 2 - 0.1,
              Math.cos(ang) * 0.42,
              Math.sin(ang) * 0.42,
            ]}
            rotation={[ang, 0, 0]}
          >
            <boxGeometry args={[0.06, 0.04, 0.03]} />
            <meshStandardMaterial color="#555" metalness={0.8} roughness={0.2} />
          </mesh>
        );
      })}

      {/* Distributor drive gear (opposite end) */}
      <mesh position={[-shaftLength / 2 + 0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.18, 0.12, 16]} />
        <meshStandardMaterial color="#555" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ── Info HUD overlay ──────────────────────────────────────────────────
function CamInfoHUD({
  intake, exhaust, vtecActive, rpm, theme,
}: {
  intake: { lift: number; duration: number };
  exhaust: { lift: number; duration: number };
  vtecActive: boolean;
  rpm: number;
  theme: ThemeColors;
}) {
  return (
    <div style={{
      position: 'absolute',
      top: 8,
      left: 8,
      zIndex: 10,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10,
      color: theme.text,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: theme.navBg,
        borderRadius: 6,
        padding: '6px 10px',
        border: vtecActive ? '1px solid rgba(34,197,94,0.4)' : `1px solid ${theme.border}`,
      }}>
        <div style={{ color: vtecActive ? '#22c55e' : '#3b82f6', fontWeight: 700, fontSize: 11, marginBottom: 4 }}>
          {vtecActive ? '◆ VTEC ENGAGED' : '○ LOW CAM'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
          <span style={{ color: theme.textDim }}>Intake Lift</span>
          <span style={{ color: theme.text, fontWeight: 600 }}>{intake.lift.toFixed(1)} mm</span>
          <span style={{ color: theme.textDim }}>Intake Duration</span>
          <span style={{ color: theme.text, fontWeight: 600 }}>{intake.duration}°</span>
          <span style={{ color: theme.textDim }}>Exhaust Lift</span>
          <span style={{ color: theme.text, fontWeight: 600 }}>{exhaust.lift.toFixed(1)} mm</span>
          <span style={{ color: theme.textDim }}>Exhaust Duration</span>
          <span style={{ color: theme.text, fontWeight: 600 }}>{exhaust.duration}°</span>
        </div>
        {rpm > 0 && (
          <div style={{ marginTop: 4, color: theme.textDim, fontSize: 9 }}>
            Cam speed: {Math.round(rpm / 2)} rpm
          </div>
        )}
      </div>
    </div>
  );
}

// ── Error boundary ────────────────────────────────────────────────────
class CamViewerErrorBoundary extends Component<{ children: ReactNode; height: number; theme: ThemeColors }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const th = this.props.theme;
      return (
        <div style={{
          width: '100%', height: this.props.height, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: th.cardBg, borderRadius: 12,
          border: `1px solid ${th.border}`, color: th.textMuted, fontFamily: 'monospace', fontSize: 12, gap: 8,
        }}>
          <span style={{ color: '#ff6b6b', fontSize: 14 }}>⚠ WebGL error</span>
          <span style={{ opacity: 0.5 }}>{this.state.error.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main export ───────────────────────────────────────────────────────
export const CamshaftViewer3D = memo(function CamshaftViewer3D({
  lowCamIntakeLiftMm,
  lowCamExhaustLiftMm,
  lowCamIntakeDuration,
  lowCamExhaustDuration,
  vtecIntakeLiftMm,
  vtecExhaustLiftMm,
  vtecIntakeDuration,
  vtecExhaustDuration,
  rpm,
  vtecActive,
  numCylinders,
  height = 280,
}: CamshaftViewer3DProps) {
  const t = useTheme();
  const activeIntake = vtecActive
    ? { lift: vtecIntakeLiftMm, duration: vtecIntakeDuration }
    : { lift: lowCamIntakeLiftMm, duration: lowCamIntakeDuration };
  const activeExhaust = vtecActive
    ? { lift: vtecExhaustLiftMm, duration: vtecExhaustDuration }
    : { lift: lowCamExhaustLiftMm, duration: lowCamExhaustDuration };

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <CamInfoHUD
        intake={activeIntake}
        exhaust={activeExhaust}
        vtecActive={vtecActive}
        rpm={rpm}
        theme={t}
      />
      <CamViewerErrorBoundary height={height} theme={t}>
        <Canvas
          camera={{ position: [0, 2, 5], fov: 35 }}
          style={{ borderRadius: 12, background: t.bg }}
          gl={{ antialias: true, alpha: false }}
        >
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <directionalLight position={[-3, 2, -3]} intensity={0.4} color="#6688ff" />
          <pointLight position={[0, 3, 0]} intensity={0.5} color="#ffffff" />

          <Suspense fallback={null}>
            <CamshaftAssembly
              lowIntake={{ lift: lowCamIntakeLiftMm, duration: lowCamIntakeDuration }}
              lowExhaust={{ lift: lowCamExhaustLiftMm, duration: lowCamExhaustDuration }}
              vtecIntake={{ lift: vtecIntakeLiftMm, duration: vtecIntakeDuration }}
              vtecExhaust={{ lift: vtecExhaustLiftMm, duration: vtecExhaustDuration }}
              rpm={rpm}
              vtecActive={vtecActive}
              numCylinders={numCylinders}
            />
          </Suspense>

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxDistance={15}
            minDistance={2}
          />
          <gridHelper args={[10, 20, t.border, t.borderFaint]} position={[0, -1.5, 0]} />
        </Canvas>
      </CamViewerErrorBoundary>

      {/* Controls hint */}
      <div style={{
        position: 'absolute',
        bottom: 6,
        right: 8,
        fontSize: 8,
        fontFamily: "'JetBrains Mono', monospace",
        color: t.textDim,
        pointerEvents: 'none',
      }}>
        Drag to rotate • Scroll to zoom • Right-drag to pan
      </div>
    </div>
  );
});
