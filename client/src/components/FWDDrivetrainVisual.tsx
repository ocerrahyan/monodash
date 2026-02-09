import React, { useRef, useEffect, useState } from "react";

interface FWDDrivetrainVisualProps {
  tireRpm: number;
  driveshaftRpm: number;
  currentGear: number | string;
  currentGearRatio: number;
  tireWidthMm: number;
  tireAspectRatio: number;
  rimDiameterIn: number;
  slipPct: number;
  clutchStatus: string;
  rpm: number;
}

export const FWDDrivetrainVisual: React.FC<FWDDrivetrainVisualProps> = ({
  tireRpm,
  driveshaftRpm,
  currentGear,
  currentGearRatio,
  tireWidthMm,
  tireAspectRatio,
  rimDiameterIn,
  slipPct,
  clutchStatus,
  rpm,
}) => {
  // Animation refs
  const [rotation, setRotation] = useState(0);
  const [flywheelRotation, setFlywheelRotation] = useState(0);
  const rotRef = useRef(0);
  const fwRotRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef<number>(0);

  // Safe values
  const safeTireRpm = typeof tireRpm === "number" && !isNaN(tireRpm) ? tireRpm : 0;
  const safeSlipPct = typeof slipPct === "number" && !isNaN(slipPct) ? slipPct : 0;
  const safeRpm = typeof rpm === "number" && !isNaN(rpm) ? rpm : 0;

  // ─── Drivetrain physics ───
  // CV axle is mechanically locked to the wheel hub. They ALWAYS spin together.
  // Power path: Flywheel → Clutch → Input shaft → Gears → Diff → CV axle → Wheel
  // Clutch DISENGAGED (pedal in): flywheel free, downstream stopped
  // Clutch ENGAGED (pedal out): flywheel + clutch lock, power transfers
  const clutchEngaged = clutchStatus === "ENGAGED" || clutchStatus === "SPINNING";

  useEffect(() => {
    const animate = (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Flywheel always spins at engine RPM
      const fwDeg = (safeRpm / 60) * 360 * dt;
      fwRotRef.current = (fwRotRef.current + fwDeg) % 360;
      setFlywheelRotation(fwRotRef.current);

      // CV axle + tire + rim all spin together at tireRpm
      // (mechanically locked — CV joint only allows angular deflection, not speed change)
      const tireDeg = (safeTireRpm / 60) * 360 * dt;
      rotRef.current = (rotRef.current + tireDeg) % 360;
      setRotation(rotRef.current);

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [safeTireRpm, safeRpm]);

  // ─── Slip visuals ───
  const isSlipping = safeSlipPct > 5;
  const heavySlip = safeSlipPct > 20;
  const tireStroke = heavySlip ? "#ef4444" : isSlipping ? "#f97316" : "#444";
  const tireFill = heavySlip ? "#3a1111" : "#1a1a1a";
  const spokeOpacity = safeTireRpm > 600 ? Math.max(0.08, 1 - (safeTireRpm - 600) / 1200) : 1;

  // ─── Real dimensions ───
  const sidewallMm = tireWidthMm * (tireAspectRatio / 100);
  const rimMm = rimDiameterIn * 25.4;
  const totalDiamMm = rimMm + sidewallMm * 2;
  const rimRatio = rimMm / totalDiamMm; // 0.64
  const sidewallThicknessRatio = sidewallMm / (totalDiamMm / 2);

  // ─── SVG coordinates ───
  // Front 3/4: same perspective foreshortening on tire AND rim
  const perspective = 0.82;
  const tireRadius = 130;
  const tireRx = tireRadius * perspective;
  const tireRy = tireRadius;
  const rimR = tireRadius * rimRatio;
  const rimRx = rimR * perspective;
  const rimRy = rimR;
  const sidewallPx = tireRadius * sidewallThicknessRatio;

  // Positions
  const tireCx = 660;
  const tireCy = 200;
  const outerCvCx = 530;
  const innerCvCx = 220;
  const cvCy = 200;
  const shaftY = 193;
  const shaftH = 14;
  const cvJointR = 28;

  const clutchColor = clutchEngaged ? "#a3e635" : clutchStatus === "SPINNING" ? "#facc15" : "#71717a";

  return (
    <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", background: "#18181b", borderRadius: 12, boxShadow: "0 2px 12px #0004", padding: 16 }}>
      <svg width="100%" viewBox="0 0 900 400" fill="none" strokeLinejoin="round" strokeLinecap="round" style={{ display: "block" }}>
        <defs>
          <linearGradient id="dtTransGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a7f3d0" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0.14} />
          </linearGradient>
          <linearGradient id="dtShaftGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4d4d8" />
            <stop offset="50%" stopColor="#71717a" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </linearGradient>
          <radialGradient id="dtRimGrad">
            <stop offset="0%" stopColor="#a1a1aa" />
            <stop offset="75%" stopColor="#52525b" />
            <stop offset="100%" stopColor="#3f3f46" />
          </radialGradient>
          <radialGradient id="dtTireGrad">
            <stop offset="70%" stopColor={tireFill} />
            <stop offset="100%" stopColor="#111" />
          </radialGradient>
        </defs>

        {/* ═══ TRANSMISSION CASE (translucent aluminum) ═══ */}
        <g opacity={0.36}>
          <rect x={60} y={120} width={200} height={160} rx={30}
            fill="url(#dtTransGrad)" stroke="#059669" strokeWidth={2} />
          <path d="M 62 145 Q 35 200 62 255" fill="none" stroke="#059669" strokeWidth={1.8} opacity={0.5} />
          {[145, 170, 195, 220, 245].map(y => (
            <circle key={`bL${y}`} cx={65} cy={y} r={2.5} fill="#059669" opacity={0.35} />
          ))}
          {[145, 170, 195, 220, 245].map(y => (
            <circle key={`bR${y}`} cx={256} cy={y} r={2.5} fill="#059669" opacity={0.35} />
          ))}
          <line x1={255} y1={130} x2={255} y2={270} stroke="#059669" strokeWidth={1} strokeDasharray="4 4" opacity={0.3} />
        </g>

        {/* ═══ FLYWHEEL (always spins at engine RPM) ═══ */}
        <g transform={`translate(72,200) rotate(${flywheelRotation})`} opacity={0.35}>
          <circle r={34} fill="none" stroke="#a1a1aa" strokeWidth={3} />
          <circle r={28} fill="none" stroke="#71717a" strokeWidth={1} />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(a => (
            <line key={`fwt${a}`} x1={0} y1={-30} x2={0} y2={-34}
              stroke="#a1a1aa" strokeWidth={1.5} transform={`rotate(${a})`} />
          ))}
          <circle r={8} fill="#52525b" stroke="#71717a" strokeWidth={1} />
        </g>
        <text x={72} y={248} textAnchor="middle" fontSize={8} fill="#a1a1aa" opacity={0.4}>FLYWHEEL</text>

        {/* ═══ CLUTCH DISC ═══ */}
        <g transform={`translate(95,200) rotate(${clutchEngaged ? rotation : flywheelRotation * 0.1})`} opacity={0.4}>
          <circle r={22} fill="none" stroke={clutchColor} strokeWidth={2.5} />
          <circle r={15} fill="none" stroke={clutchColor} strokeWidth={1} strokeDasharray="3 3" />
          <circle r={5} fill={clutchColor} opacity={0.5} />
        </g>
        <text x={95} y={232} textAnchor="middle" fontSize={7} fill={clutchColor} opacity={0.5}>
          {clutchStatus}
        </text>

        {/* ═══ INTERNAL GEARS (hint) ═══ */}
        <g opacity={0.2}>
          <circle cx={165} cy={195} r={20} fill="none" stroke="#059669" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={165} cy={210} r={14} fill="none" stroke="#059669" strokeWidth={0.8} strokeDasharray="2 3" />
        </g>

        {/* ═══ DIFFERENTIAL BULGE ═══ */}
        <g opacity={0.32}>
          <ellipse cx={240} cy={200} rx={42} ry={45}
            fill="#34d399" stroke="#059669" strokeWidth={2} />
          <circle cx={240} cy={200} r={30} fill="none" stroke="#065f46" strokeWidth={1.2} strokeDasharray="5 3" opacity={0.4} />
          <rect x={277} y={194} width={16} height={12} rx={4} fill="#6ee7b7" stroke="#059669" strokeWidth={1} opacity={0.4} />
        </g>

        {/* ═══ CV AXLE SHAFT (steel, 25mm dia) ═══ */}
        <rect x={innerCvCx + cvJointR} y={shaftY} width={outerCvCx - innerCvCx - cvJointR * 2} height={shaftH} rx={shaftH / 2}
          fill="url(#dtShaftGrad)" stroke="#3f3f46" strokeWidth={1.2} />
        {Array.from({ length: 10 }, (_, i) => {
          const x = innerCvCx + cvJointR + 10 + i * ((outerCvCx - innerCvCx - cvJointR * 2 - 20) / 9);
          return (
            <line key={`sp${i}`} x1={x} y1={shaftY + 1} x2={x} y2={shaftY + shaftH - 1}
              stroke="#52525b" strokeWidth={0.6} opacity={0.25} />
          );
        })}

        {/* ═══ CV BOOTS (accordion rubber) ═══ */}
        {[innerCvCx + cvJointR - 2, outerCvCx - cvJointR - 20].map((bx, idx) => {
          const folds = 4;
          const bw = 22;
          const topY = shaftY - 4;
          const botY = shaftY + shaftH + 4;
          let d = `M ${bx} ${shaftY}`;
          for (let i = 0; i < folds; i++) {
            const x1 = bx + (i + 0.5) * (bw / folds);
            const x2 = bx + (i + 1) * (bw / folds);
            d += ` Q ${x1} ${topY} ${x2} ${shaftY}`;
          }
          d += ` L ${bx + bw} ${shaftY + shaftH}`;
          for (let i = folds - 1; i >= 0; i--) {
            const x1 = bx + (i + 0.5) * (bw / folds);
            const x2 = bx + i * (bw / folds);
            d += ` Q ${x1} ${botY} ${x2} ${shaftY + shaftH}`;
          }
          d += " Z";
          return <path key={`boot${idx}`} d={d} fill="#27272a" stroke="#3f3f46" strokeWidth={0.8} opacity={0.65} />;
        })}

        {/* ═══ INNER CV JOINT (tripod — spins with tire) ═══ */}
        <g transform={`translate(${innerCvCx},${cvCy}) rotate(${rotation})`}>
          <circle r={cvJointR} fill="#a1a1aa" stroke="#3f3f46" strokeWidth={1.5} />
          {[0, 120, 240].map(a => (
            <g key={`il${a}`} transform={`rotate(${a})`}>
              <ellipse cx={0} cy={-cvJointR * 0.65} rx={7} ry={4.5} fill="#d4d4d8" stroke="#52525b" strokeWidth={1} />
            </g>
          ))}
          <circle r={7} fill="#71717a" stroke="#3f3f46" strokeWidth={1} />
          <circle r={3} fill="#52525b" />
        </g>

        {/* ═══ OUTER CV JOINT (Rzeppa — spins with tire) ═══ */}
        <g transform={`translate(${outerCvCx},${cvCy}) rotate(${rotation})`}>
          <circle r={cvJointR} fill="#a1a1aa" stroke="#3f3f46" strokeWidth={1.5} />
          {[0, 60, 120, 180, 240, 300].map(a => (
            <g key={`ob${a}`} transform={`rotate(${a})`}>
              <circle cx={0} cy={-cvJointR * 0.7} r={4.5} fill="#e4e4e7" stroke="#71717a" strokeWidth={0.8} />
            </g>
          ))}
          <circle r={10} fill="#71717a" stroke="#52525b" strokeWidth={1} />
          <circle r={4} fill="#3f3f46" />
        </g>

        {/* ═══ HUB / KNUCKLE ═══ */}
        <rect x={outerCvCx + cvJointR + 2} y={shaftY - 2}
          width={tireCx - tireRx - outerCvCx - cvJointR - 4} height={shaftH + 4} rx={4}
          fill="#52525b" stroke="#3f3f46" strokeWidth={1.2} />

        {/* ═══ TIRE (front 3/4, same perspective on tire + rim) ═══ */}
        <g transform={`translate(${tireCx},${tireCy})`}>
          <ellipse rx={tireRx} ry={tireRy} fill="url(#dtTireGrad)" stroke={tireStroke} strokeWidth={2.5} />
          {/* Sidewall inner ring */}
          <ellipse rx={tireRx - sidewallPx * perspective * 0.4} ry={tireRy - sidewallPx * 0.4}
            fill="none" stroke="#333" strokeWidth={0.8} opacity={0.3} />
          {/* Tread grooves */}
          {[-0.85, -0.55, -0.25, 0.25, 0.55, 0.85].map((frac, i) => {
            const y = tireRy * frac;
            const xAtY = tireRx * Math.sqrt(1 - (y * y) / (tireRy * tireRy));
            return (
              <g key={`tg${i}`}>
                <line x1={-xAtY + 2} y1={y} x2={-xAtY + 10} y2={y} stroke="#333" strokeWidth={1.5} opacity={0.4} />
                <line x1={xAtY - 10} y1={y} x2={xAtY - 2} y2={y} stroke="#333" strokeWidth={1.5} opacity={0.4} />
              </g>
            );
          })}
          <text x={0} y={-tireRy + 14} textAnchor="middle" fontSize={8} fill="#555" opacity={0.4} style={{ fontFamily: "monospace" }}>
            195/55R15
          </text>

          {/* ── Rim (static outline — round object always looks the same at this angle) ── */}
          <ellipse rx={rimRx} ry={rimRy} fill="url(#dtRimGrad)" stroke="#52525b" strokeWidth={1.5} />

          {/* ── Spokes (positions calculated parametrically on the ellipse) ── */}
          {[0, 72, 144, 216, 288].map(a => {
            // Convert rotation to radians, add spoke base angle
            const theta = ((a + rotation) * Math.PI) / 180;
            // Parametric point on the rim ellipse
            const ex = Math.cos(theta) * (rimRx - 6);
            const ey = Math.sin(theta) * (rimRy - 6);
            return (
              <g key={`spoke${a}`} opacity={spokeOpacity}>
                <line x1={0} y1={0} x2={ex} y2={ey}
                  stroke="#71717a" strokeWidth={6} strokeLinecap="round" />
                <circle cx={ex} cy={ey} r={5} fill="#52525b" stroke="#3f3f46" strokeWidth={0.5} />
              </g>
            );
          })}

          {/* Center hub (static) */}
          <circle r={14} fill="#27272a" stroke="#52525b" strokeWidth={1.5} />

          {/* ── Lug nuts (parametric on ellipse) ── */}
          {[0, 72, 144, 216, 288].map(a => {
            const theta = ((a + rotation) * Math.PI) / 180;
            const lx = Math.cos(theta) * 9;
            const ly = Math.sin(theta) * 9;
            return (
              <circle key={`lug${a}`} cx={lx} cy={ly} r={2.5}
                fill="#3f3f46" stroke="#71717a" strokeWidth={0.6} />
            );
          })}

          {/* Center cap (static) */}
          <circle r={5} fill="#18181b" stroke="#52525b" strokeWidth={0.8} />

          {/* Slip smoke */}
          {isSlipping && (
            <g opacity={Math.min(0.5, safeSlipPct / 100)}>
              <ellipse cx={tireRx + 8} cy={tireRy - 15} rx={12 + safeSlipPct * 0.2} ry={5} fill="#fff" opacity={0.12} />
              <ellipse cx={-tireRx - 8} cy={tireRy - 15} rx={10 + safeSlipPct * 0.15} ry={4} fill="#fff" opacity={0.08} />
            </g>
          )}
        </g>

        {/* ═══ GEAR INDICATOR ═══ */}
        <text x={160} y={208} textAnchor="middle" fontSize={30} fill="#fff" fontWeight="bold" opacity={0.55} style={{ fontFamily: "monospace" }}>
          {currentGear === 0 ? "N" : currentGear}
        </text>
        <text x={160} y={228} textAnchor="middle" fontSize={9} fill="#a3e635" opacity={0.35} style={{ fontFamily: "monospace" }}>
          {typeof currentGearRatio === "number" && currentGearRatio > 0 ? `RATIO ${currentGearRatio.toFixed(3)}` : "NEUTRAL"}
        </text>

        {/* ═══ LABELS ═══ */}
        <text x={72} y={108} textAnchor="middle" fontSize={9} fill="#a1a1aa" opacity={0.35}>ENGINE</text>
        <text x={160} y={108} textAnchor="middle" fontSize={9} fill="#6ee7b7" opacity={0.45}>S4C TRANS</text>
        <text x={240} y={108} textAnchor="middle" fontSize={9} fill="#6ee7b7" opacity={0.4}>DIFF</text>
        <text x={(innerCvCx + outerCvCx) / 2} y={shaftY - 8} textAnchor="middle" fontSize={8} fill="#a1a1aa" opacity={0.3}>
          CV HALF-SHAFT (610mm)
        </text>
        <text x={tireCx} y={tireCy + tireRy + 16} textAnchor="middle" fontSize={9} fill="#a1a1aa" opacity={0.35}>
          195/55R15
        </text>
        <text x={450} y={388} textAnchor="middle" fontSize={12} fill="#a3e635" opacity={0.5}>
          FWD Drivetrain — Front 3/4 View
        </text>

        {/* ═══ POWER FLOW ARROWS (only when clutch engaged and wheel turning) ═══ */}
        {clutchEngaged && safeTireRpm > 1 && (
          <g opacity={0.3}>
            {[0, 1, 2, 3, 4].map(i => {
              const x = 100 + i * 130;
              return (
                <polygon key={`arrow${i}`} points={`${x},196 ${x + 8},200 ${x},204`} fill="#a3e635">
                  <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
                </polygon>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
};
