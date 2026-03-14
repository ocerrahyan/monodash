import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { B16A2_TORQUE_MAP, getStockTorqueMap, getStockTorqueMapForEngine, getCylinderScaling } from "@/lib/engineSim";
import { useTheme } from '@/lib/theme';

// ── Types ──
export interface DynoCurveEditorProps {
  /** Current custom torque map (null = stock) */
  customMap: [number, number][] | null;
  /** Called when user modifies a point */
  onChange: (map: [number, number][]) => void;
  /** Reset to stock */
  onReset: () => void;
  /** Current RPM from engine sim (for crosshair) */
  currentRpm?: number;
  /** Current torque from engine sim */
  currentTorque?: number;
  /** Current HP from engine sim */
  currentHp?: number;
  /** Current boost pressure (psi) */
  boostPsi?: number;
  /** Turbo enabled flag */
  turboEnabled?: boolean;
  /** Supercharger enabled flag */
  superchargerEnabled?: boolean;
  /** Nitrous HP adder */
  nitrousHpAdder?: number;
  /** Nitrous enabled flag */
  nitrousEnabled?: boolean;
  /** Current engine ID for stock torque map lookup */
  engineId?: string;
  /** Current engine redline RPM */
  redlineRpm?: number;
  /** Current fuel cut RPM (overrev limit) */
  fuelCutRpm?: number;
  /** Current number of cylinders (for cylinder scaling) */
  numCylinders?: number;
}

// ── Constants ──
const PADDING = { top: 30, right: 55, bottom: 38, left: 50 };
const RPM_MIN = 500;
// RPM_MAX is now dynamic based on engine redline

const TORQUE_COLOR = "#f59e0b";   // Amber
const HP_COLOR = "#ef4444";        // Red
const EFFECTIVE_TORQUE_COLOR = "#fbbf24"; // Bright amber for boosted
const EFFECTIVE_HP_COLOR = "#f87171";     // Bright red for boosted
const STOCK_COLOR = "#555";        // Dim for stock reference
const GRID_COLOR = "#1a1a2e";
const CROSSHAIR_COLOR = "#3b82f6"; // Blue
const TOUCH_HIT_RADIUS = 22;      // Large invisible touch target

function rpmToX(rpm: number, w: number, rpmMax: number): number {
  return PADDING.left + ((rpm - RPM_MIN) / (rpmMax - RPM_MIN)) * (w - PADDING.left - PADDING.right);
}
function xToRpm(x: number, w: number, rpmMax: number): number {
  return RPM_MIN + ((x - PADDING.left) / (w - PADDING.left - PADDING.right)) * (rpmMax - RPM_MIN);
}
function makeTorqueToY(minT: number, maxT: number) {
  return (t: number, h: number) =>
    PADDING.top + (1 - (t - minT) / (maxT - minT)) * (h - PADDING.top - PADDING.bottom);
}
function makeYToTorque(minT: number, maxT: number) {
  return (y: number, h: number) =>
    minT + (1 - (y - PADDING.top) / (h - PADDING.top - PADDING.bottom)) * (maxT - minT);
}
function makeHpToY(minHp: number, maxHp: number) {
  return (hp: number, h: number) =>
    PADDING.top + (1 - (hp - minHp) / (maxHp - minHp)) * (h - PADDING.top - PADDING.bottom);
}

/** Interpolate torque at any RPM from a torque map */
function interpolate(map: [number, number][], rpm: number): number {
  if (rpm <= map[0][0]) return map[0][1];
  if (rpm >= map[map.length - 1][0]) return map[map.length - 1][1];
  let i = 0;
  while (i < map.length - 1 && map[i + 1][0] <= rpm) i++;
  if (i >= map.length - 1) return map[map.length - 1][1];
  const [r0, t0] = map[i];
  const [r1, t1] = map[i + 1];
  const frac = (rpm - r0) / (r1 - r0);
  return t0 + (t1 - t0) * frac;
}

/** Build smooth path from map points */
function buildCurvePath(map: [number, number][], w: number, h: number, yFn: (val: number, h: number) => number, transform?: (rpm: number, torque: number) => number, rpmMax: number = 8500): string {
  if (map.length < 2) return "";
  const pts = map.map(([rpm, t]) => {
    const val = transform ? transform(rpm, t) : t;
    return { x: rpmToX(rpm, w, rpmMax), y: yFn(val, h) };
  });
  // Catmull-Rom → cubic bezier for smooth curve
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function DynoCurveEditor({ customMap, onChange, onReset, currentRpm, currentTorque, currentHp, boostPsi = 0, turboEnabled = false, superchargerEnabled = false, nitrousHpAdder = 0, nitrousEnabled = false, engineId = 'b16a2', redlineRpm = 8200, fuelCutRpm = 8400, numCylinders }: DynoCurveEditorProps) {
  const t = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragType, setDragType] = useState<"torque" | "hp" | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ rpm: number; torque: number; hp: number; x: number; y: number } | null>(null);
  const [svgSize, setSvgSize] = useState({ w: 600, h: 300 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(400, entry.contentRect.width);
        const h = Math.max(200, Math.min(350, w * 0.45));
        setSvgSize({ w, h });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Dynamic RPM_MAX based on engine redline/fuel cut + 500 headroom
  const RPM_MAX = useMemo(() => {
    const max = Math.max(redlineRpm + 500, fuelCutRpm + 300, 7000);
    return Math.ceil(max / 500) * 500;
  }, [redlineRpm, fuelCutRpm]);

  const stockMap = useMemo(() => getStockTorqueMapForEngine(engineId), [engineId]);

  // Extend a torque map with extrapolated falloff points beyond its last entry
  // so the graph curve continues to RPM_MAX instead of stopping abruptly
  const extendMap = useCallback((map: [number, number][], rpmLimit: number): [number, number][] => {
    if (map.length < 2) return map;
    const lastRpm = map[map.length - 1][0];
    if (lastRpm >= rpmLimit) return map;
    const lastTorque = map[map.length - 1][1];
    // Use a natural falloff: torque drops ~8% per 500 RPM beyond the last point
    // (valve float, friction, breathing losses at overrev)
    const extended = [...map];
    for (let rpm = lastRpm + 250; rpm <= rpmLimit; rpm += 250) {
      const overRpmRatio = (rpm - lastRpm) / 1000;
      const falloff = Math.max(0.15, 1 - overRpmRatio * 0.16);
      extended.push([rpm, Math.round(lastTorque * falloff * 10) / 10]);
    }
    return extended;
  }, []);
  const activeMap: [number, number][] = customMap || stockMap;
  const isModified = customMap !== null;
  const hasBoostedOutput = (turboEnabled || superchargerEnabled) && boostPsi > 0.5;
  const hasNitrous = nitrousEnabled && nitrousHpAdder > 0;
  // hasCylScaling computed below after cylScale

  // Extended maps that include falloff beyond the last torque map entry to RPM_MAX
  const extendedActiveMap = useMemo(() => extendMap(activeMap, RPM_MAX), [activeMap, RPM_MAX, extendMap]);
  const extendedStockMap = useMemo(() => extendMap(stockMap, RPM_MAX), [stockMap, RPM_MAX, extendMap]);

  // Boost multiplier matching engineSim.ts formula
  const boostMultiplier = (turboEnabled || superchargerEnabled) && boostPsi > 0
    ? 1 + (boostPsi / 14.7) * 0.9
    : 1;

  // Cylinder scaling: adding/removing cylinders scales torque proportionally
  const cylScale = numCylinders ? getCylinderScaling(numCylinders, engineId) : 1;
  const hasCylScaling = cylScale !== 1;

  // Combined flag: show effective curves when ANY modifier is active
  const hasEffectiveOverlay = hasBoostedOutput || hasNitrous || hasCylScaling;

  // Compute effective (boosted + cylinder-scaled) torque map using extended map
  const effectiveMap: [number, number][] = useMemo(() => {
    return extendedActiveMap.map(([rpm, t]) => {
      let eff = t * boostMultiplier * cylScale;
      // Add nitrous torque: hp_adder * 5252 / rpm → torque adder in ft-lb
      if (hasNitrous && rpm > 3000) {
        eff += (nitrousHpAdder * 5252) / rpm;
      }
      return [rpm, eff];
    });
  }, [extendedActiveMap, boostMultiplier, cylScale, hasNitrous, nitrousHpAdder]);

  const { w, h } = svgSize;

  // HP transform: hp = torque * rpm / 5252
  const torqueToHp = useCallback((rpm: number, torque: number) => (torque * rpm) / 5252, []);

  // Dynamic Y-axis scaling — auto-scale to max values with 20% headroom
  const { minTorque, maxTorque, minHp, maxHp, torqueTicks, hpTicks } = useMemo(() => {
    let peakT = 0, peakHp = 0;
    const mapToScan = hasEffectiveOverlay ? effectiveMap : activeMap;
    for (const [rpm, t] of mapToScan) {
      if (t > peakT) peakT = t;
      const hp = (t * rpm) / 5252;
      if (hp > peakHp) peakHp = hp;
    }
    // Also check live values
    if (currentTorque && currentTorque > peakT) peakT = currentTorque;
    if (currentHp && currentHp > peakHp) peakHp = currentHp;

    // Nice rounded max with 15% headroom
    const rawMaxT = peakT * 1.15;
    const rawMaxHp = peakHp * 1.15;

    // Round up to nice intervals
    const tStep = rawMaxT > 500 ? 100 : rawMaxT > 200 ? 50 : rawMaxT > 100 ? 20 : 10;
    const hStep = rawMaxHp > 1000 ? 200 : rawMaxHp > 500 ? 100 : rawMaxHp > 200 ? 50 : rawMaxHp > 100 ? 20 : 10;
    const maxT = Math.ceil(rawMaxT / tStep) * tStep;
    const maxHP = Math.ceil(rawMaxHp / hStep) * hStep;
    const minT = 0;
    const minHP = 0;

    // Generate tick marks
    const tTicks: number[] = [];
    for (let v = tStep; v < maxT; v += tStep) tTicks.push(v);
    const hTicks: number[] = [];
    for (let v = hStep; v < maxHP; v += hStep) hTicks.push(v);

    return { minTorque: minT, maxTorque: maxT, minHp: minHP, maxHp: maxHP, torqueTicks: tTicks, hpTicks: hTicks };
  }, [activeMap, effectiveMap, hasBoostedOutput, hasNitrous, currentTorque, currentHp]);

  // Create dynamic Y mapping functions
  const torqueToY = useMemo(() => makeTorqueToY(minTorque, maxTorque), [minTorque, maxTorque]);
  const yToTorque = useMemo(() => makeYToTorque(minTorque, maxTorque), [minTorque, maxTorque]);
  const hpToY = useMemo(() => makeHpToY(minHp, maxHp), [minHp, maxHp]);

  // Compute peak values for display (from effective map if boosted)
  const peaks = useMemo(() => {
    let peakTorque = 0, peakTorqueRpm = 0, peakHp = 0, peakHpRpm = 0;
    const scanMap = hasEffectiveOverlay ? effectiveMap : activeMap;
    for (const [rpm, t] of scanMap) {
      if (t > peakTorque) { peakTorque = t; peakTorqueRpm = rpm; }
      const hp = (t * rpm) / 5252;
      if (hp > peakHp) { peakHp = hp; peakHpRpm = rpm; }
    }
    return { peakTorque, peakTorqueRpm, peakHp, peakHpRpm };
  }, [activeMap, effectiveMap, hasBoostedOutput, hasNitrous]);

  // ── Dragging logic ──
  const getSvgPoint = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback((idx: number, type: "torque" | "hp") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragIdx(idx);
    setDragType(type);
    (e.target as Element).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const pt = getSvgPoint(e);
    if (!pt) return;

    // Hover tooltip
    const hoverRpm = xToRpm(pt.x, w, RPM_MAX);
    if (hoverRpm >= RPM_MIN && hoverRpm <= RPM_MAX && pt.y >= PADDING.top && pt.y <= h - PADDING.bottom) {
      const t = interpolate(activeMap, hoverRpm);
      const effT = hasEffectiveOverlay ? interpolate(effectiveMap, hoverRpm) : t;
      const hp = (effT * hoverRpm) / 5252;
      setHoverInfo({ rpm: hoverRpm, torque: effT, hp, x: pt.x, y: pt.y });
    } else {
      setHoverInfo(null);
    }

    if (dragIdx === null || dragType === null) return;

    // Create mutable copy if needed
    const map = customMap ? customMap.map(([r, t]): [number, number] => [r, t]) : getStockTorqueMapForEngine(engineId);
    const rpm = map[dragIdx][0]; // RPM stays fixed

    if (dragType === "torque") {
      const newTorque = Math.round(yToTorque(pt.y, h) * 10) / 10;
      map[dragIdx] = [rpm, Math.max(10, Math.min(maxTorque, newTorque))];
    } else {
      // Dragging HP → derive torque: torque = hp * 5252 / rpm
      const targetHp = minHp + (1 - (pt.y - PADDING.top) / (h - PADDING.top - PADDING.bottom)) * (maxHp - minHp);
      const newTorque = Math.round((targetHp * 5252 / rpm) * 10) / 10;
      map[dragIdx] = [rpm, Math.max(10, Math.min(maxTorque, newTorque))];
    }
    onChange(map);
  }, [dragIdx, dragType, customMap, onChange, getSvgPoint, w, h, activeMap, effectiveMap, hasBoostedOutput, hasNitrous, yToTorque, minHp, maxHp, maxTorque, engineId]);

  const handlePointerUp = useCallback(() => {
    setDragIdx(null);
    setDragType(null);
  }, []);

  // ── Grid lines ──
  const rpmTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let r = 1000; r < RPM_MAX; r += 1000) ticks.push(r);
    return ticks;
  }, [RPM_MAX]);

  // ── Paths (use extended maps so curves continue beyond torque map's last RPM) ──
  const stockTorquePath = buildCurvePath(extendedStockMap, w, h, torqueToY, undefined, RPM_MAX);
  const stockHpPath = buildCurvePath(extendedStockMap, w, h, hpToY, torqueToHp, RPM_MAX);
  const activeTorquePath = buildCurvePath(extendedActiveMap, w, h, torqueToY, undefined, RPM_MAX);
  const activeHpPath = buildCurvePath(extendedActiveMap, w, h, hpToY, torqueToHp, RPM_MAX);

  // Effective (boosted) curves
  const effectiveTorquePath = hasEffectiveOverlay ? buildCurvePath(effectiveMap, w, h, torqueToY, undefined, RPM_MAX) : "";
  const effectiveHpPath = hasEffectiveOverlay ? buildCurvePath(effectiveMap, w, h, hpToY, torqueToHp, RPM_MAX) : "";

  // ── Difference area (filled between stock and custom) ──
  const diffArea = useMemo(() => {
    if (!isModified) return "";
    // Sample at every RPM point in the active map
    const rpmPoints = activeMap.map(([r]) => r);
    // Build top (custom) path forward and bottom (stock) path backward
    let topPath = "";
    let bottomPath = "";
    for (let i = 0; i < rpmPoints.length; i++) {
      const rpm = rpmPoints[i];
      const x = rpmToX(rpm, w, RPM_MAX);
      const customT = activeMap[i][1];
      const stockT = interpolate(stockMap, rpm);
      const yCustom = torqueToY(customT, h);
      const yStock = torqueToY(stockT, h);
      topPath += (i === 0 ? "M" : "L") + `${x},${yCustom}`;
      bottomPath = `L${x},${yStock}` + bottomPath;
    }
    // Close the first point of bottom path with M
    const firstRpm = rpmPoints[0];
    const firstStockT = interpolate(stockMap, firstRpm);
    bottomPath = `L${rpmToX(firstRpm, w, RPM_MAX)},${torqueToY(firstStockT, h)}` + bottomPath.slice(bottomPath.indexOf("L", 1));
    return topPath + bottomPath + "Z";
  }, [isModified, activeMap, stockMap, w, h, RPM_MAX]);

  return (
    <div ref={containerRef} className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="flex items-center gap-3">
          <span className="text-[10px] tracking-[0.25em] uppercase opacity-50 font-mono" style={{ color: t.textDim }}>DYNO CURVE EDITOR</span>
          {isModified && (
            <span className="text-[9px] tracking-wider uppercase text-amber-400/80 font-mono">● MODIFIED</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isModified && (
            <button
              onClick={onReset}
              className="text-[9px] tracking-wider uppercase font-mono px-2 py-0.5 transition-colors"
              style={{ border: `1px solid ${t.border}`, color: t.textMuted }}
            >
              ↩ STOCK
            </button>
          )}
        </div>
      </div>

      {/* Peak Power / Torque Rating Badges */}
      <div className="flex items-stretch gap-2 px-1 mb-2">
        <div className="flex-1 rounded-lg border px-3 py-1.5" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
          <div className="text-[8px] tracking-[0.2em] uppercase font-mono" style={{ color: TORQUE_COLOR, opacity: 0.6 }}>PEAK TORQUE</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[20px] font-mono font-bold tabular-nums" style={{ color: TORQUE_COLOR }}>{peaks.peakTorque.toFixed(1)}</span>
            <span className="text-[10px] font-mono" style={{ color: TORQUE_COLOR, opacity: 0.6 }}>ft-lb</span>
          </div>
          <div className="text-[9px] font-mono" style={{ color: TORQUE_COLOR, opacity: 0.5 }}>@ {peaks.peakTorqueRpm} RPM</div>
        </div>
        <div className="flex-1 rounded-lg border px-3 py-1.5" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
          <div className="text-[8px] tracking-[0.2em] uppercase font-mono" style={{ color: HP_COLOR, opacity: 0.6 }}>PEAK HORSEPOWER</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[20px] font-mono font-bold tabular-nums" style={{ color: HP_COLOR }}>{peaks.peakHp.toFixed(1)}</span>
            <span className="text-[10px] font-mono" style={{ color: HP_COLOR, opacity: 0.6 }}>hp</span>
          </div>
          <div className="text-[9px] font-mono" style={{ color: HP_COLOR, opacity: 0.5 }}>@ {peaks.peakHpRpm} RPM</div>
        </div>
        {hasEffectiveOverlay && (() => {
          let effPeakTq = 0, effPeakTqRpm = 0, effPeakHp = 0, effPeakHpRpm = 0;
          for (const [rpm, t] of effectiveMap) {
            if (t > effPeakTq) { effPeakTq = t; effPeakTqRpm = rpm; }
            const hp = (t * rpm) / 5252;
            if (hp > effPeakHp) { effPeakHp = hp; effPeakHpRpm = rpm; }
          }
          return (
            <div className="flex-1 rounded-lg border px-3 py-1.5" style={{ borderColor: 'rgba(163,230,53,0.3)', background: 'rgba(163,230,53,0.06)' }}>
              <div className="text-[8px] tracking-[0.2em] uppercase font-mono" style={{ color: '#a3e635', opacity: 0.6 }}>
                EFFECTIVE PEAK
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[20px] font-mono font-bold tabular-nums" style={{ color: '#a3e635' }}>{effPeakHp.toFixed(1)}</span>
                <span className="text-[10px] font-mono" style={{ color: '#a3e635', opacity: 0.6 }}>hp</span>
              </div>
              <div className="text-[9px] font-mono" style={{ color: '#a3e635', opacity: 0.5 }}>
                {effPeakTq.toFixed(1)} ft-lb @ {effPeakTqRpm} | HP @ {effPeakHpRpm}
              </div>
            </div>
          );
        })()}
      </div>

      {/* SVG Graph */}
      <svg
        ref={svgRef}
        width={w}
        height={h}
        className="select-none"
        style={{ background: t.bg, borderRadius: 8, border: `1px solid ${t.border}`, cursor: dragIdx !== null ? "grabbing" : "crosshair", touchAction: "none" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => { handlePointerUp(); setHoverInfo(null); }}
      >
        {/* Grid lines */}
        {rpmTicks.map(rpm => {
          const x = rpmToX(rpm, w, RPM_MAX);
          return (
            <g key={`grid-rpm-${rpm}`}>
              <line x1={x} y1={PADDING.top} x2={x} y2={h - PADDING.bottom} stroke={t.borderFaint} strokeWidth={1} />
              <text x={x} y={h - PADDING.bottom + 14} fill={t.textDim} fontSize={9} textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                {rpm >= 1000 ? `${rpm / 1000}k` : rpm}
              </text>
            </g>
          );
        })}
        {torqueTicks.map(tv => {
          const y = torqueToY(tv, h);
          return (
            <g key={`grid-t-${tv}`}>
              <line x1={PADDING.left} y1={y} x2={w - PADDING.right} y2={y} stroke={t.borderFaint} strokeWidth={1} />
              <text x={PADDING.left - 6} y={y + 3} fill={TORQUE_COLOR} fontSize={8} textAnchor="end" fontFamily="'JetBrains Mono', monospace" opacity={0.5}>
                {tv}
              </text>
            </g>
          );
        })}
        {hpTicks.map(hp => {
          const y = hpToY(hp, h);
          return (
            <text key={`grid-hp-${hp}`} x={w - PADDING.right + 6} y={y + 3} fill={HP_COLOR} fontSize={8} textAnchor="start" fontFamily="'JetBrains Mono', monospace" opacity={0.5}>
              {hp}
            </text>
          );
        })}

        {/* Axis labels */}
        <text x={PADDING.left - 6} y={PADDING.top - 10} fill={TORQUE_COLOR} fontSize={8} textAnchor="end" fontFamily="'JetBrains Mono', monospace" opacity={0.7}>
          ft-lb
        </text>
        <text x={w - PADDING.right + 6} y={PADDING.top - 10} fill={HP_COLOR} fontSize={8} textAnchor="start" fontFamily="'JetBrains Mono', monospace" opacity={0.7}>
          hp
        </text>
        <text x={w / 2} y={h - 4} fill={t.textDim} fontSize={8} textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
          RPM
        </text>

        {/* Axes */}
        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={h - PADDING.bottom} stroke={t.border} strokeWidth={1} />
        <line x1={PADDING.left} y1={h - PADDING.bottom} x2={w - PADDING.right} y2={h - PADDING.bottom} stroke={t.border} strokeWidth={1} />
        <line x1={w - PADDING.right} y1={PADDING.top} x2={w - PADDING.right} y2={h - PADDING.bottom} stroke={t.border} strokeWidth={1} />

        {/* Stock reference curves (dashed, dim) */}
        {isModified && (
          <>
            <path d={stockTorquePath} fill="none" stroke={STOCK_COLOR} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
            <path d={stockHpPath} fill="none" stroke={STOCK_COLOR} strokeWidth={1} strokeDasharray="4,3" opacity={0.4} />
          </>
        )}

        {/* Difference fill area (torque) */}
        {isModified && diffArea && (
          <path d={diffArea} fill={TORQUE_COLOR} opacity={0.08} />
        )}

        {/* Active torque curve (base map) */}
        <path d={activeTorquePath} fill="none" stroke={TORQUE_COLOR} strokeWidth={hasEffectiveOverlay ? 1 : 2} opacity={hasEffectiveOverlay ? 0.4 : 0.9} strokeDasharray={hasEffectiveOverlay ? "3,2" : undefined} />
        {/* Active HP curve (base map) */}
        <path d={activeHpPath} fill="none" stroke={HP_COLOR} strokeWidth={hasEffectiveOverlay ? 1 : 2} opacity={hasEffectiveOverlay ? 0.4 : 0.9} strokeDasharray={hasEffectiveOverlay ? "3,2" : undefined} />

        {/* Effective (boosted/nitrous) curves — bright and bold */}
        {hasEffectiveOverlay && (
          <>
            <path d={effectiveTorquePath} fill="none" stroke={EFFECTIVE_TORQUE_COLOR} strokeWidth={2.5} opacity={0.95} />
            <path d={effectiveHpPath} fill="none" stroke={EFFECTIVE_HP_COLOR} strokeWidth={2.5} opacity={0.95} />
          </>
        )}

        {/* VTEC engagement line */}
        {(() => {
          const vtecRpm = 5500;
          const x = rpmToX(vtecRpm, w, RPM_MAX);
          return (
            <g>
              <line x1={x} y1={PADDING.top} x2={x} y2={h - PADDING.bottom} stroke="#22c55e" strokeWidth={1} strokeDasharray="3,4" opacity={0.4} />
              <text x={x + 3} y={PADDING.top + 10} fill="#22c55e" fontSize={7} fontFamily="'JetBrains Mono', monospace" opacity={0.5}>
                VTEC
              </text>
            </g>
          );
        })()}

        {/* Draggable torque control points */}
        {activeMap.map(([rpm, torque], idx) => {
          const x = rpmToX(rpm, w, RPM_MAX);
          const yT = torqueToY(torque, h);
          const hp = (torque * rpm) / 5252;
          const yH = hpToY(hp, h);
          const isDragging = dragIdx === idx;

          return (
            <g key={`pt-${rpm}`}>
              {/* Vertical connector line between torque and HP point */}
              <line x1={x} y1={yT} x2={x} y2={yH} stroke={t.border} strokeWidth={0.5} strokeDasharray="2,2" />

              {/* ── Large invisible touch target for TORQUE point ── */}
              <circle
                cx={x} cy={yT} r={TOUCH_HIT_RADIUS}
                fill="transparent"
                stroke="none"
                style={{ cursor: "ns-resize", touchAction: "none" }}
                onPointerDown={handlePointerDown(idx, "torque")}
              />
              {/* Visual torque dot */}
              <circle
                cx={x} cy={yT} r={isDragging && dragType === "torque" ? 8 : 5}
                fill={isDragging && dragType === "torque" ? TORQUE_COLOR : t.bg}
                stroke={TORQUE_COLOR}
                strokeWidth={isDragging && dragType === "torque" ? 2.5 : 1.5}
                style={{ pointerEvents: "none", transition: "r 0.1s" }}
              />

              {/* ── Large invisible touch target for HP point ── */}
              <circle
                cx={x} cy={yH} r={TOUCH_HIT_RADIUS}
                fill="transparent"
                stroke="none"
                style={{ cursor: "ns-resize", touchAction: "none" }}
                onPointerDown={handlePointerDown(idx, "hp")}
              />
              {/* Visual HP dot */}
              <circle
                cx={x} cy={yH} r={isDragging && dragType === "hp" ? 8 : 4}
                fill={isDragging && dragType === "hp" ? HP_COLOR : t.bg}
                stroke={HP_COLOR}
                strokeWidth={isDragging && dragType === "hp" ? 2.5 : 1.5}
                style={{ pointerEvents: "none", transition: "r 0.1s" }}
              />

              {/* Value label on hover/drag */}
              {isDragging && (
                <>
                  <rect x={x - 28} y={yT - 22} width={56} height={16} rx={3} fill={t.navBg} stroke={TORQUE_COLOR} strokeWidth={0.5} opacity={0.9} />
                  <text x={x} y={yT - 11} fill={TORQUE_COLOR} fontSize={9} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                    {torque.toFixed(1)}
                  </text>
                  <rect x={x - 28} y={yH + 6} width={56} height={16} rx={3} fill={t.navBg} stroke={HP_COLOR} strokeWidth={0.5} opacity={0.9} />
                  <text x={x} y={yH + 17} fill={HP_COLOR} fontSize={9} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                    {hp.toFixed(1)}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Live RPM crosshair */}
        {currentRpm !== undefined && currentRpm > RPM_MIN && (
          (() => {
            const x = rpmToX(currentRpm, w, RPM_MAX);
            const t = currentTorque ?? interpolate(activeMap, currentRpm);
            const hp = currentHp ?? (t * currentRpm) / 5252;
            const yT = torqueToY(t, h);
            const yH = hpToY(hp, h);
            return (
              <g opacity={0.7}>
                <line x1={x} y1={PADDING.top} x2={x} y2={h - PADDING.bottom} stroke={CROSSHAIR_COLOR} strokeWidth={1} strokeDasharray="2,3" />
                <circle cx={x} cy={yT} r={3} fill={CROSSHAIR_COLOR} opacity={0.8} />
                <circle cx={x} cy={yH} r={3} fill={CROSSHAIR_COLOR} opacity={0.8} />
                <text x={x} y={h - PADDING.bottom + 28} fill={CROSSHAIR_COLOR} fontSize={8} textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                  {Math.round(currentRpm)}
                </text>
              </g>
            );
          })()
        )}

        {/* Hover tooltip */}
        {hoverInfo && dragIdx === null && (
          <g>
            <line x1={hoverInfo.x} y1={PADDING.top} x2={hoverInfo.x} y2={h - PADDING.bottom} stroke={t.border} strokeWidth={0.5} strokeDasharray="2,2" />
            <rect
              x={Math.min(hoverInfo.x + 8, w - 110)}
              y={Math.max(PADDING.top, hoverInfo.y - 36)}
              width={100} height={32} rx={4}
              fill={t.navBg} stroke={t.border} strokeWidth={0.5} opacity={0.95}
            />
            <text
              x={Math.min(hoverInfo.x + 14, w - 104)}
              y={Math.max(PADDING.top + 12, hoverInfo.y - 22)}
              fill={TORQUE_COLOR} fontSize={9} fontFamily="'JetBrains Mono', monospace"
            >
              {hoverInfo.torque.toFixed(1)} ft-lb
            </text>
            <text
              x={Math.min(hoverInfo.x + 14, w - 104)}
              y={Math.max(PADDING.top + 24, hoverInfo.y - 10)}
              fill={HP_COLOR} fontSize={9} fontFamily="'JetBrains Mono', monospace"
            >
              {hoverInfo.hp.toFixed(1)} hp @ {Math.round(hoverInfo.rpm)}
            </text>
          </g>
        )}

        {/* Legend */}
        <g transform={`translate(${PADDING.left + 8}, ${PADDING.top + 6})`}>
          <rect x={-4} y={-4} width={hasEffectiveOverlay ? 130 : isModified ? 120 : 80} height={hasEffectiveOverlay ? 50 : isModified ? 38 : 26} rx={3} fill={t.bg} stroke={t.border} strokeWidth={0.5} opacity={0.9} />
          <line x1={0} y1={4} x2={16} y2={4} stroke={TORQUE_COLOR} strokeWidth={2} />
          <text x={20} y={7} fill={TORQUE_COLOR} fontSize={8} fontFamily="'JetBrains Mono', monospace" opacity={0.8}>TORQUE</text>
          <line x1={0} y1={16} x2={16} y2={16} stroke={HP_COLOR} strokeWidth={2} />
          <text x={20} y={19} fill={HP_COLOR} fontSize={8} fontFamily="'JetBrains Mono', monospace" opacity={0.8}>HORSEPOWER</text>
          {isModified && (
            <>
              <line x1={0} y1={28} x2={16} y2={28} stroke={STOCK_COLOR} strokeWidth={1} strokeDasharray="4,3" />
              <text x={20} y={31} fill={STOCK_COLOR} fontSize={8} fontFamily="'JetBrains Mono', monospace" opacity={0.6}>STOCK REF</text>
            </>
          )}
          {hasEffectiveOverlay && (
            <>
              <line x1={0} y1={isModified ? 40 : 28} x2={16} y2={isModified ? 40 : 28} stroke={EFFECTIVE_TORQUE_COLOR} strokeWidth={2.5} />
              <text x={20} y={isModified ? 43 : 31} fill={EFFECTIVE_TORQUE_COLOR} fontSize={8} fontFamily="'JetBrains Mono', monospace" opacity={0.9}>
                {turboEnabled ? 'TURBO' : superchargerEnabled ? 'S/C' : ''}{hasNitrous ? (turboEnabled || superchargerEnabled ? '+NOS' : 'NOS') : ''} ({Math.round(boostPsi)}psi)
              </text>
            </>
          )}
        </g>
      </svg>

      {/* Instructions */}
      <div className="flex items-center justify-between mt-1 px-1">
        <span className="text-[8px] font-mono" style={{ color: t.textDim }}>
          Drag ● points up/down to adjust • Amber = torque • Red = HP • Blue crosshair = live RPM
        </span>
        {isModified && (
          <span className="text-[8px] font-mono text-amber-400/50">
            Changes applied to simulation in real-time
          </span>
        )}
      </div>
    </div>
  );
}
