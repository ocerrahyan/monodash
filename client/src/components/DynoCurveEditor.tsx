import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { B16A2_TORQUE_MAP, getStockTorqueMap } from "@/lib/engineSim";

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
}

// ── Constants ──
const PADDING = { top: 30, right: 55, bottom: 38, left: 50 };
const MIN_TORQUE = 20;
const MAX_TORQUE = 180;
const MIN_HP = 0;
const MAX_HP = 200;
const RPM_MIN = 500;
const RPM_MAX = 8500;

const TORQUE_COLOR = "#f59e0b";   // Amber
const HP_COLOR = "#ef4444";        // Red
const STOCK_COLOR = "#555";        // Dim for stock reference
const GRID_COLOR = "#1a1a2e";
const CROSSHAIR_COLOR = "#3b82f6"; // Blue

function rpmToX(rpm: number, w: number): number {
  return PADDING.left + ((rpm - RPM_MIN) / (RPM_MAX - RPM_MIN)) * (w - PADDING.left - PADDING.right);
}
function xToRpm(x: number, w: number): number {
  return RPM_MIN + ((x - PADDING.left) / (w - PADDING.left - PADDING.right)) * (RPM_MAX - RPM_MIN);
}
function torqueToY(t: number, h: number): number {
  return PADDING.top + (1 - (t - MIN_TORQUE) / (MAX_TORQUE - MIN_TORQUE)) * (h - PADDING.top - PADDING.bottom);
}
function yToTorque(y: number, h: number): number {
  return MIN_TORQUE + (1 - (y - PADDING.top) / (h - PADDING.top - PADDING.bottom)) * (MAX_TORQUE - MIN_TORQUE);
}
function hpToY(hp: number, h: number): number {
  return PADDING.top + (1 - (hp - MIN_HP) / (MAX_HP - MIN_HP)) * (h - PADDING.top - PADDING.bottom);
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
function buildCurvePath(map: [number, number][], w: number, h: number, yFn: (val: number, h: number) => number, transform?: (rpm: number, torque: number) => number): string {
  if (map.length < 2) return "";
  const pts = map.map(([rpm, t]) => {
    const val = transform ? transform(rpm, t) : t;
    return { x: rpmToX(rpm, w), y: yFn(val, h) };
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

export function DynoCurveEditor({ customMap, onChange, onReset, currentRpm, currentTorque, currentHp }: DynoCurveEditorProps) {
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

  const stockMap = useMemo(() => getStockTorqueMap(), []);
  const activeMap: [number, number][] = customMap || stockMap;
  const isModified = customMap !== null;

  const { w, h } = svgSize;

  // HP transform: hp = torque * rpm / 5252
  const torqueToHp = useCallback((rpm: number, torque: number) => (torque * rpm) / 5252, []);

  // Compute peak values for display
  const peaks = useMemo(() => {
    let peakTorque = 0, peakTorqueRpm = 0, peakHp = 0, peakHpRpm = 0;
    for (const [rpm, t] of activeMap) {
      if (t > peakTorque) { peakTorque = t; peakTorqueRpm = rpm; }
      const hp = (t * rpm) / 5252;
      if (hp > peakHp) { peakHp = hp; peakHpRpm = rpm; }
    }
    return { peakTorque, peakTorqueRpm, peakHp, peakHpRpm };
  }, [activeMap]);

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
    const hoverRpm = xToRpm(pt.x, w);
    if (hoverRpm >= RPM_MIN && hoverRpm <= RPM_MAX && pt.y >= PADDING.top && pt.y <= h - PADDING.bottom) {
      const t = interpolate(activeMap, hoverRpm);
      const hp = (t * hoverRpm) / 5252;
      setHoverInfo({ rpm: hoverRpm, torque: t, hp, x: pt.x, y: pt.y });
    } else {
      setHoverInfo(null);
    }

    if (dragIdx === null || dragType === null) return;

    // Create mutable copy if needed
    const map = customMap ? customMap.map(([r, t]): [number, number] => [r, t]) : getStockTorqueMap();
    const rpm = map[dragIdx][0]; // RPM stays fixed

    if (dragType === "torque") {
      const newTorque = Math.round(yToTorque(pt.y, h) * 10) / 10;
      map[dragIdx] = [rpm, Math.max(10, Math.min(180, newTorque))];
    } else {
      // Dragging HP → derive torque: torque = hp * 5252 / rpm
      const targetHp = MIN_HP + (1 - (pt.y - PADDING.top) / (h - PADDING.top - PADDING.bottom)) * (MAX_HP - MIN_HP);
      const newTorque = Math.round((targetHp * 5252 / rpm) * 10) / 10;
      map[dragIdx] = [rpm, Math.max(10, Math.min(180, newTorque))];
    }
    onChange(map);
  }, [dragIdx, dragType, customMap, onChange, getSvgPoint, w, h, activeMap]);

  const handlePointerUp = useCallback(() => {
    setDragIdx(null);
    setDragType(null);
  }, []);

  // ── Grid lines ──
  const rpmTicks = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];
  const torqueTicks = [40, 60, 80, 100, 120, 140, 160];
  const hpTicks = [0, 40, 80, 120, 160, 200];

  // ── Paths ──
  const stockTorquePath = buildCurvePath(stockMap, w, h, torqueToY);
  const stockHpPath = buildCurvePath(stockMap, w, h, hpToY, torqueToHp);
  const activeTorquePath = buildCurvePath(activeMap, w, h, torqueToY);
  const activeHpPath = buildCurvePath(activeMap, w, h, hpToY, torqueToHp);

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
      const x = rpmToX(rpm, w);
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
    bottomPath = `L${rpmToX(firstRpm, w)},${torqueToY(firstStockT, h)}` + bottomPath.slice(bottomPath.indexOf("L", 1));
    return topPath + bottomPath + "Z";
  }, [isModified, activeMap, stockMap, w, h]);

  return (
    <div ref={containerRef} className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-1">
        <div className="flex items-center gap-3">
          <span className="text-[10px] tracking-[0.25em] uppercase opacity-50 font-mono">DYNO CURVE EDITOR</span>
          {isModified && (
            <span className="text-[9px] tracking-wider uppercase text-amber-400/80 font-mono">● MODIFIED</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Peak readouts */}
          <span className="text-[9px] font-mono" style={{ color: TORQUE_COLOR, opacity: 0.8 }}>
            Peak {peaks.peakTorque.toFixed(1)} ft-lb @ {peaks.peakTorqueRpm}
          </span>
          <span className="text-[9px] font-mono" style={{ color: HP_COLOR, opacity: 0.8 }}>
            Peak {peaks.peakHp.toFixed(1)} hp @ {peaks.peakHpRpm}
          </span>
          {isModified && (
            <button
              onClick={onReset}
              className="text-[9px] tracking-wider uppercase font-mono border border-white/20 px-2 py-0.5 text-white/60 hover:text-white hover:border-white/40 transition-colors"
            >
              ↩ STOCK
            </button>
          )}
        </div>
      </div>

      {/* SVG Graph */}
      <svg
        ref={svgRef}
        width={w}
        height={h}
        className="select-none"
        style={{ background: "#0a0a14", borderRadius: 8, border: "1px solid #1a1a2e", cursor: dragIdx !== null ? "grabbing" : "crosshair" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => { handlePointerUp(); setHoverInfo(null); }}
      >
        {/* Grid lines */}
        {rpmTicks.map(rpm => {
          const x = rpmToX(rpm, w);
          return (
            <g key={`grid-rpm-${rpm}`}>
              <line x1={x} y1={PADDING.top} x2={x} y2={h - PADDING.bottom} stroke={GRID_COLOR} strokeWidth={1} />
              <text x={x} y={h - PADDING.bottom + 14} fill="#555" fontSize={9} textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
                {rpm >= 1000 ? `${rpm / 1000}k` : rpm}
              </text>
            </g>
          );
        })}
        {torqueTicks.map(t => {
          const y = torqueToY(t, h);
          return (
            <g key={`grid-t-${t}`}>
              <line x1={PADDING.left} y1={y} x2={w - PADDING.right} y2={y} stroke={GRID_COLOR} strokeWidth={1} />
              <text x={PADDING.left - 6} y={y + 3} fill={TORQUE_COLOR} fontSize={8} textAnchor="end" fontFamily="'JetBrains Mono', monospace" opacity={0.5}>
                {t}
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
        <text x={w / 2} y={h - 4} fill="#555" fontSize={8} textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
          RPM
        </text>

        {/* Axes */}
        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={h - PADDING.bottom} stroke="#333" strokeWidth={1} />
        <line x1={PADDING.left} y1={h - PADDING.bottom} x2={w - PADDING.right} y2={h - PADDING.bottom} stroke="#333" strokeWidth={1} />
        <line x1={w - PADDING.right} y1={PADDING.top} x2={w - PADDING.right} y2={h - PADDING.bottom} stroke="#333" strokeWidth={1} />

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

        {/* Active torque curve */}
        <path d={activeTorquePath} fill="none" stroke={TORQUE_COLOR} strokeWidth={2} opacity={0.9} />
        {/* Active HP curve */}
        <path d={activeHpPath} fill="none" stroke={HP_COLOR} strokeWidth={2} opacity={0.9} />

        {/* VTEC engagement line */}
        {(() => {
          const vtecRpm = 5500;
          const x = rpmToX(vtecRpm, w);
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
          const x = rpmToX(rpm, w);
          const yT = torqueToY(torque, h);
          const hp = (torque * rpm) / 5252;
          const yH = hpToY(hp, h);
          const isDragging = dragIdx === idx;

          return (
            <g key={`pt-${rpm}`}>
              {/* Vertical connector line between torque and HP point */}
              <line x1={x} y1={yT} x2={x} y2={yH} stroke="#333" strokeWidth={0.5} strokeDasharray="2,2" />

              {/* Torque point */}
              <circle
                cx={x} cy={yT} r={isDragging && dragType === "torque" ? 7 : 5}
                fill={isDragging && dragType === "torque" ? TORQUE_COLOR : "#0a0a14"}
                stroke={TORQUE_COLOR}
                strokeWidth={isDragging && dragType === "torque" ? 2.5 : 1.5}
                style={{ cursor: "ns-resize", transition: "r 0.1s" }}
                onPointerDown={handlePointerDown(idx, "torque")}
              />

              {/* HP point */}
              <circle
                cx={x} cy={yH} r={isDragging && dragType === "hp" ? 7 : 4}
                fill={isDragging && dragType === "hp" ? HP_COLOR : "#0a0a14"}
                stroke={HP_COLOR}
                strokeWidth={isDragging && dragType === "hp" ? 2.5 : 1.5}
                style={{ cursor: "ns-resize", transition: "r 0.1s" }}
                onPointerDown={handlePointerDown(idx, "hp")}
              />

              {/* Value label on hover/drag */}
              {isDragging && (
                <>
                  <rect x={x - 28} y={yT - 22} width={56} height={16} rx={3} fill="#000" stroke={TORQUE_COLOR} strokeWidth={0.5} opacity={0.9} />
                  <text x={x} y={yT - 11} fill={TORQUE_COLOR} fontSize={9} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight="bold">
                    {torque.toFixed(1)}
                  </text>
                  <rect x={x - 28} y={yH + 6} width={56} height={16} rx={3} fill="#000" stroke={HP_COLOR} strokeWidth={0.5} opacity={0.9} />
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
            const x = rpmToX(currentRpm, w);
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
            <line x1={hoverInfo.x} y1={PADDING.top} x2={hoverInfo.x} y2={h - PADDING.bottom} stroke="#444" strokeWidth={0.5} strokeDasharray="2,2" />
            <rect
              x={Math.min(hoverInfo.x + 8, w - 110)}
              y={Math.max(PADDING.top, hoverInfo.y - 36)}
              width={100} height={32} rx={4}
              fill="#111" stroke="#333" strokeWidth={0.5} opacity={0.95}
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
          <rect x={-4} y={-4} width={isModified ? 120 : 80} height={isModified ? 38 : 26} rx={3} fill="#0a0a14" stroke="#222" strokeWidth={0.5} opacity={0.9} />
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
        </g>
      </svg>

      {/* Instructions */}
      <div className="flex items-center justify-between mt-1 px-1">
        <span className="text-[8px] font-mono text-white/30">
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
