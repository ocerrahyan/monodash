import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { Link } from "wouter";
import { type EngineState } from "@/lib/engineSim";
import { sharedSim } from "@/lib/sharedSim";
import { EngineSound } from "@/lib/engineSound";
import { Button } from "@/components/ui/button";
import { FWDDrivetrainVisual } from "../components/FWDDrivetrainVisual";
import { DrivetrainView3D } from "@/components/DrivetrainView3D";
import { useAiMode } from "@/lib/aiMode";
import { fetchAiCorrections, defaultCorrections, type AiCorrectionFactors } from "@/lib/aiPhysicsClient";

// Drag and Drop Context for gauges
interface DragContextType {
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  onDrop: (targetId: string) => void;
}
const DragContext = createContext<DragContextType | null>(null);

function useDrag() {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error("useDrag must be used within DragContext");
  return ctx;
}

function useActiveCount() {
  const [count, setCount] = useState<number>(0);
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    let id = sessionStorage.getItem("sim_session_id");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("sim_session_id", id);
    }
    sessionIdRef.current = id;

    const beat = async () => {
      try {
        const res = await fetch("/api/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current }),
        });
        if (res.ok) {
          const data = await res.json();
          setCount(data.activeCount);
        }
      } catch {}
    };

    beat();
    const interval = setInterval(beat, 30_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        beat();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return count;
}

interface GaugeProps {
  label: string;
  value: string | number;
  unit: string;
  testId: string;
  highlight?: boolean;
  gaugeId: string;
}

function Gauge({ label, value, unit, testId, highlight, gaugeId }: GaugeProps) {
  const { draggedId, setDraggedId, onDrop } = useDrag();
  const [isDragOver, setIsDragOver] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', gaugeId);
    setDraggedId(gaugeId);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    isDraggingRef.current = false;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && draggedId !== gaugeId) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (draggedId && draggedId !== gaugeId) {
      onDrop(gaugeId);
    }
  };

  // Touch support for iOS/mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    longPressRef.current = setTimeout(() => {
      isDraggingRef.current = true;
      setDraggedId(gaugeId);
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(50);
    }, 400);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) {
      // Cancel long press if moved too much
      if (longPressRef.current && touchStartRef.current) {
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartRef.current.y);
        if (dx > 10 || dy > 10) {
          clearTimeout(longPressRef.current);
          longPressRef.current = null;
        }
      }
      return;
    }
    
    // Find element under touch point
    const touch = e.touches[0];
    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const gaugeBelow = elemBelow?.closest('[data-gauge-id]') as HTMLElement | null;
    if (gaugeBelow) {
      const targetId = gaugeBelow.dataset.gaugeId;
      if (targetId && targetId !== gaugeId) {
        onDrop(targetId);
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    if (isDraggingRef.current) {
      setDraggedId(null);
      isDraggingRef.current = false;
    }
    touchStartRef.current = null;
  };

  const isBeingDragged = draggedId === gaugeId;

  return (
    <div 
      className={`flex flex-col items-center justify-center py-2 px-1 cursor-grab active:cursor-grabbing transition-all duration-150 ${
        isBeingDragged ? 'opacity-50 scale-95' : ''
      } ${isDragOver ? 'bg-white/10 scale-105' : ''}`}
      data-testid={testId}
      data-gauge-id={gaugeId}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <span className="text-[9px] tracking-wider uppercase opacity-70 leading-tight text-center font-mono">{label}</span>
      <span className={`text-[18px] font-mono font-bold leading-tight tabular-nums ${highlight ? "opacity-100" : ""}`} data-testid={`value-${testId}`}>{value}</span>
      <span className="text-[8px] tracking-wide uppercase opacity-60 leading-tight font-mono">{unit}</span>
    </div>
  );
}

interface BoostGaugeProps {
  boostPsi: number;
  maxBoost?: number;
  turboEnabled: boolean;
  superchargerEnabled: boolean;
}

function BoostGauge({ boostPsi, maxBoost = 20, turboEnabled, superchargerEnabled }: BoostGaugeProps) {
  const isActive = turboEnabled || superchargerEnabled;
  // Map boost from -15 (vacuum) to maxBoost PSI to angle (-135 to +135 degrees)
  const minBoost = -15;
  const clampedBoost = Math.max(minBoost, Math.min(boostPsi, maxBoost));
  const normalizedValue = (clampedBoost - minBoost) / (maxBoost - minBoost);
  const angle = -135 + normalizedValue * 270; // -135 to +135 degrees
  
  return (
    <div className="flex flex-col items-center justify-center py-1 px-1" data-testid="gauge-boost-dial">
      <span className="text-[9px] tracking-wider uppercase opacity-70 leading-tight text-center font-mono">BOOST</span>
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 15 75 A 42 42 0 1 1 85 75"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Colored segments: vacuum (blue) -> 0 (white) -> boost (red/orange) */}
          {/* Vacuum zone -15 to 0 */}
          <path
            d="M 15 75 A 42 42 0 0 1 50 8"
            fill="none"
            stroke="rgba(59,130,246,0.4)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Boost zone 0 to max */}
          <path
            d="M 50 8 A 42 42 0 0 1 85 75"
            fill="none"
            stroke={isActive ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Zero marker */}
          <line x1="50" y1="12" x2="50" y2="18" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
          {/* Tick marks */}
          {[-15, -10, -5, 5, 10, 15, 20].map((tick) => {
            const tickNorm = (tick - minBoost) / (maxBoost - minBoost);
            const tickAngle = (-135 + tickNorm * 270) * Math.PI / 180;
            const x1 = 50 + Math.cos(tickAngle) * 38;
            const y1 = 50 + Math.sin(tickAngle) * 38;
            const x2 = 50 + Math.cos(tickAngle) * 42;
            const y2 = 50 + Math.sin(tickAngle) * 42;
            return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />;
          })}
          {/* Needle */}
          <g transform={`rotate(${angle}, 50, 50)`} style={{ transition: 'transform 0.15s ease-out' }}>
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="16"
              stroke={boostPsi > 0 && isActive ? "#ef4444" : "#ffffff"}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="50" cy="50" r="4" fill={boostPsi > 0 && isActive ? "#ef4444" : "#ffffff"} />
          </g>
          {/* Center cap */}
          <circle cx="50" cy="50" r="3" fill="#000" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        </svg>
        {/* Digital readout */}
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className={`text-[11px] font-mono font-bold tabular-nums ${boostPsi > 0 && isActive ? 'text-red-400' : 'text-white/80'}`}>
            {boostPsi.toFixed(1)}
          </span>
        </div>
      </div>
      <span className="text-[8px] tracking-wide uppercase opacity-60 leading-tight font-mono">PSI</span>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="col-span-4 flex items-center gap-2 pt-4 pb-1 px-2">
      <div className="h-px flex-1 bg-white/20" />
      <span className="text-[9px] tracking-[0.3em] uppercase opacity-60 font-mono whitespace-nowrap">{title}</span>
      <div className="h-px flex-1 bg-white/20" />
    </div>
  );
}

// Porsche-style Tachometer with smooth needle
interface PorscheTachProps {
  rpm: number;
  redline?: number;
  maxRpm?: number;
}

function PorscheTach({ rpm, redline = 8000, maxRpm = 9000 }: PorscheTachProps) {
  const safeRpm = typeof rpm === 'number' && !isNaN(rpm) ? rpm : 0;
  const [displayRpm, setDisplayRpm] = useState(safeRpm);
  
  // Smooth interpolation using useEffect
  useEffect(() => {
    let animationId: number;
    const animate = () => {
      setDisplayRpm(prev => {
        const diff = safeRpm - prev;
        if (Math.abs(diff) < 5) return safeRpm;
        return prev + diff * 0.2;
      });
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [safeRpm]);
  
  // Gauge sweep: starts at bottom-left (-225°), ends at bottom-right (45°) = 270° sweep
  // 0 RPM = -225° (7 o'clock), max RPM = 45° (5 o'clock)
  const minAngle = -225;
  const maxAngle = 45;
  const rpmNormalized = Math.min(Math.max(displayRpm / maxRpm, 0), 1);
  const needleAngle = minAngle + rpmNormalized * (maxAngle - minAngle);
  
  const redlineNormalized = redline / maxRpm;
  const redlineStartAngle = minAngle + redlineNormalized * (maxAngle - minAngle);
  
  // Generate tick marks
  const ticks = [];
  for (let i = 0; i <= maxRpm; i += 1000) {
    const tickNorm = i / maxRpm;
    // Offset by -90° because SVG rotation 0° is at 3 o'clock, we want it relative to 12 o'clock
    const tickAngle = ((minAngle + tickNorm * (maxAngle - minAngle)) - 90) * Math.PI / 180;
    const isRedzone = i >= redline;
    const isMajor = i % 2000 === 0;
    
    const innerR = isMajor ? 70 : 74;
    const outerR = 82;
    const x1 = 100 + Math.cos(tickAngle) * innerR;
    const y1 = 100 + Math.sin(tickAngle) * innerR;
    const x2 = 100 + Math.cos(tickAngle) * outerR;
    const y2 = 100 + Math.sin(tickAngle) * outerR;
    
    ticks.push(
      <line key={`tick-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={isRedzone ? '#dc2626' : '#e5e5e5'} strokeWidth={isMajor ? 3 : 1.5} />
    );
    
    if (isMajor) {
      const labelR = 58;
      const lx = 100 + Math.cos(tickAngle) * labelR;
      const ly = 100 + Math.sin(tickAngle) * labelR;
      ticks.push(
        <text key={`label-${i}`} x={lx} y={ly} fill={isRedzone ? '#dc2626' : '#e5e5e5'} fontSize="13" fontWeight="bold" fontFamily="Arial, sans-serif" textAnchor="middle" dominantBaseline="middle">
          {i / 1000}
        </text>
      );
    }
  }
  
  // Redline arc
  const redlineArcStartAngle = (redlineStartAngle - 90) * Math.PI / 180;
  const redlineArcEndAngle = (maxAngle - 90) * Math.PI / 180;
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Outer bezel */}
          <circle cx="100" cy="100" r="96" fill="none" stroke="#505050" strokeWidth="4" />
          <circle cx="100" cy="100" r="92" fill="#0a0a0a" />
          <circle cx="100" cy="100" r="88" fill="none" stroke="#222" strokeWidth="2" />
          
          {/* Redline zone arc */}
          <path
            d={`M ${100 + Math.cos(redlineArcStartAngle) * 85} ${100 + Math.sin(redlineArcStartAngle) * 85} A 85 85 0 0 1 ${100 + Math.cos(redlineArcEndAngle) * 85} ${100 + Math.sin(redlineArcEndAngle) * 85}`}
            fill="none" stroke="rgba(220, 38, 38, 0.4)" strokeWidth="10" strokeLinecap="butt"
          />
          
          {/* Tick marks and labels */}
          {ticks}
          
          {/* Center label */}
          <text x="100" y="145" fill="#666" fontSize="9" fontFamily="Arial, sans-serif" textAnchor="middle">RPM x1000</text>
          
          {/* Needle - rotates around center, pointing UP at 0° */}
          <g transform={`rotate(${needleAngle}, 100, 100)`}>
            {/* Needle shadow */}
            <polygon points="100,18 94,105 100,112 106,105" fill="rgba(0,0,0,0.4)" />
            {/* Main needle body */}
            <polygon points="100,20 95,100 100,110 105,100" fill="#dc2626" />
            {/* Needle highlight */}
            <polygon points="100,22 98,85 100,90 102,85" fill="#ff6666" />
          </g>
          
          {/* Center cap */}
          <circle cx="100" cy="100" r="14" fill="#333" />
          <circle cx="100" cy="100" r="10" fill="#1a1a1a" stroke="#555" strokeWidth="1" />
          <circle cx="100" cy="100" r="4" fill="#dc2626" />
        </svg>
        
        {/* Digital RPM readout */}
        <div className="absolute inset-x-0 bottom-6 text-center">
          <span className="text-xl font-mono font-bold tabular-nums text-white">{Math.round(displayRpm)}</span>
        </div>
      </div>
      <span className="text-[10px] tracking-widest uppercase text-white/60 font-mono mt-1">TACHOMETER</span>
    </div>
  );
}

// Porsche-style Wheel Speed gauge (cyan needle — shows tire surface speed including slip)
interface PorscheWheelSpeedoProps {
  wheelSpeedMph: number;
  maxSpeed?: number;
}

function PorscheWheelSpeedo({ wheelSpeedMph, maxSpeed = 160 }: PorscheWheelSpeedoProps) {
  const safeSpeed = typeof wheelSpeedMph === 'number' && !isNaN(wheelSpeedMph) ? wheelSpeedMph : 0;
  const [displaySpeed, setDisplaySpeed] = useState(safeSpeed);

  // Smooth interpolation
  useEffect(() => {
    let animationId: number;
    const animate = () => {
      setDisplaySpeed(prev => {
        const diff = safeSpeed - prev;
        if (Math.abs(diff) < 0.3) return safeSpeed;
        return prev + diff * 0.15;
      });
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [safeSpeed]);

  // Same sweep as tach: -225° to 45°
  const minAngle = -225;
  const maxAngle = 45;
  const speedNormalized = Math.min(Math.max(displaySpeed / maxSpeed, 0), 1);
  const needleAngle = minAngle + speedNormalized * (maxAngle - minAngle);

  // Generate tick marks (every 10 MPH, major every 20)
  const ticks = [];
  for (let i = 0; i <= maxSpeed; i += 10) {
    const tickNorm = i / maxSpeed;
    const tickAngle = ((minAngle + tickNorm * (maxAngle - minAngle)) - 90) * Math.PI / 180;
    const isMajor = i % 20 === 0;

    const innerR = isMajor ? 70 : 74;
    const outerR = 82;
    const x1 = 100 + Math.cos(tickAngle) * innerR;
    const y1 = 100 + Math.sin(tickAngle) * innerR;
    const x2 = 100 + Math.cos(tickAngle) * outerR;
    const y2 = 100 + Math.sin(tickAngle) * outerR;

    ticks.push(
      <line key={`tick-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5e5e5" strokeWidth={isMajor ? 3 : 1.5} />
    );

    if (isMajor) {
      const labelR = 58;
      const lx = 100 + Math.cos(tickAngle) * labelR;
      const ly = 100 + Math.sin(tickAngle) * labelR;
      ticks.push(
        <text key={`label-${i}`} x={lx} y={ly} fill="#e5e5e5" fontSize="12" fontWeight="bold" fontFamily="Arial, sans-serif" textAnchor="middle" dominantBaseline="middle">
          {i}
        </text>
      );
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Outer bezel */}
          <circle cx="100" cy="100" r="96" fill="none" stroke="#505050" strokeWidth="4" />
          <circle cx="100" cy="100" r="92" fill="#0a0a0a" />
          <circle cx="100" cy="100" r="88" fill="none" stroke="#222" strokeWidth="2" />

          {/* Tick marks and labels */}
          {ticks}

          {/* Center label */}
          <text x="100" y="145" fill="#0e7490" fontSize="9" fontFamily="Arial, sans-serif" textAnchor="middle">WHEEL MPH</text>

          {/* Needle */}
          <g transform={`rotate(${needleAngle}, 100, 100)`}>
            {/* Needle shadow */}
            <polygon points="100,18 94,105 100,112 106,105" fill="rgba(0,0,0,0.4)" />
            {/* Main needle body — cyan */}
            <polygon points="100,20 95,100 100,110 105,100" fill="#06b6d4" />
            {/* Needle highlight */}
            <polygon points="100,22 98,85 100,90 102,85" fill="#67e8f9" />
          </g>

          {/* Center cap */}
          <circle cx="100" cy="100" r="14" fill="#333" />
          <circle cx="100" cy="100" r="10" fill="#1a1a1a" stroke="#555" strokeWidth="1" />
          <circle cx="100" cy="100" r="4" fill="#06b6d4" />
        </svg>

        {/* Digital speed readout */}
        <div className="absolute inset-x-0 bottom-6 text-center">
          <span className="text-xl font-mono font-bold tabular-nums text-cyan-400">{Math.round(displaySpeed)}</span>
        </div>
      </div>
      <span className="text-[10px] tracking-widest uppercase text-cyan-400/60 font-mono mt-1">WHEEL SPEED</span>
    </div>
  );
}

// Porsche-style Speedometer with smooth needle
interface PorscheSpeedoProps {
  speedMph: number;
  maxSpeed?: number;
}

function PorscheSpeedo({ speedMph, maxSpeed = 160 }: PorscheSpeedoProps) {
  const safeSpeed = typeof speedMph === 'number' && !isNaN(speedMph) ? speedMph : 0;
  const [displaySpeed, setDisplaySpeed] = useState(safeSpeed);
  
  // Smooth interpolation
  useEffect(() => {
    let animationId: number;
    const animate = () => {
      setDisplaySpeed(prev => {
        const diff = safeSpeed - prev;
        if (Math.abs(diff) < 0.3) return safeSpeed;
        return prev + diff * 0.15;
      });
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [safeSpeed]);
  
  // Same sweep as tach: -225° to 45°
  const minAngle = -225;
  const maxAngle = 45;
  const speedNormalized = Math.min(Math.max(displaySpeed / maxSpeed, 0), 1);
  const needleAngle = minAngle + speedNormalized * (maxAngle - minAngle);
  
  // Generate tick marks (every 10 MPH, major every 20)
  const ticks = [];
  for (let i = 0; i <= maxSpeed; i += 10) {
    const tickNorm = i / maxSpeed;
    const tickAngle = ((minAngle + tickNorm * (maxAngle - minAngle)) - 90) * Math.PI / 180;
    const isMajor = i % 20 === 0;
    
    const innerR = isMajor ? 70 : 74;
    const outerR = 82;
    const x1 = 100 + Math.cos(tickAngle) * innerR;
    const y1 = 100 + Math.sin(tickAngle) * innerR;
    const x2 = 100 + Math.cos(tickAngle) * outerR;
    const y2 = 100 + Math.sin(tickAngle) * outerR;
    
    ticks.push(
      <line key={`tick-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e5e5e5" strokeWidth={isMajor ? 3 : 1.5} />
    );
    
    if (isMajor) {
      const labelR = 58;
      const lx = 100 + Math.cos(tickAngle) * labelR;
      const ly = 100 + Math.sin(tickAngle) * labelR;
      ticks.push(
        <text key={`label-${i}`} x={lx} y={ly} fill="#e5e5e5" fontSize="12" fontWeight="bold" fontFamily="Arial, sans-serif" textAnchor="middle" dominantBaseline="middle">
          {i}
        </text>
      );
    }
  }
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Outer bezel */}
          <circle cx="100" cy="100" r="96" fill="none" stroke="#505050" strokeWidth="4" />
          <circle cx="100" cy="100" r="92" fill="#0a0a0a" />
          <circle cx="100" cy="100" r="88" fill="none" stroke="#222" strokeWidth="2" />
          
          {/* Tick marks and labels */}
          {ticks}
          
          {/* Center label */}
          <text x="100" y="145" fill="#666" fontSize="10" fontFamily="Arial, sans-serif" textAnchor="middle">MPH</text>
          
          {/* Needle */}
          <g transform={`rotate(${needleAngle}, 100, 100)`}>
            {/* Needle shadow */}
            <polygon points="100,18 94,105 100,112 106,105" fill="rgba(0,0,0,0.4)" />
            {/* Main needle body */}
            <polygon points="100,20 95,100 100,110 105,100" fill="#f97316" />
            {/* Needle highlight */}
            <polygon points="100,22 98,85 100,90 102,85" fill="#fdba74" />
          </g>
          
          {/* Center cap */}
          <circle cx="100" cy="100" r="14" fill="#333" />
          <circle cx="100" cy="100" r="10" fill="#1a1a1a" stroke="#555" strokeWidth="1" />
          <circle cx="100" cy="100" r="4" fill="#f97316" />
        </svg>
        
        {/* Digital speed readout */}
        <div className="absolute inset-x-0 bottom-6 text-center">
          <span className="text-xl font-mono font-bold tabular-nums text-white">{Math.round(displaySpeed)}</span>
        </div>
      </div>
      <span className="text-[10px] tracking-widest uppercase text-white/60 font-mono mt-1">SPEEDOMETER</span>
    </div>
  );
}

// Combined Porsche Gauge Cluster
interface PorscheGaugeClusterProps {
  rpm: number;
  speedMph: number;
  wheelSpeedMph: number;
  redline?: number;
}

function PorscheGaugeCluster({ rpm, speedMph, wheelSpeedMph, redline = 8000 }: PorscheGaugeClusterProps) {
  return (
    <div className="col-span-4 flex justify-center items-center gap-4 py-4 px-2">
      <PorscheWheelSpeedo wheelSpeedMph={wheelSpeedMph} />
      <PorscheTach rpm={rpm} redline={redline} />
      <PorscheSpeedo speedMph={speedMph} />
    </div>
  );
}

interface WheelVisualProps {
  tireRpm: number;
  slipPct: number;
  speedMph: number;
  tireWidthMm: number;
  tireAspectRatio: number;
  rimDiameterIn: number;
  isLaunching: boolean;
  distanceFt: number;
  currentGear: number | string;
  boostPsi: number;
  turboEnabled: boolean;
}

function WheelVisual({ tireRpm = 0, slipPct = 0, speedMph = 0, tireWidthMm = 195, tireAspectRatio = 55, rimDiameterIn = 15, isLaunching = false, distanceFt = 0, currentGear = 0, boostPsi = 0, turboEnabled = false }: WheelVisualProps) {
  const rotationRef = useRef(0);
  const roadOffsetRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const [rotation, setRotation] = useState(0);
  const [roadOffset, setRoadOffset] = useState(0);
  
  // Safely handle numeric values
  const safeBoostPsi = typeof boostPsi === 'number' && !isNaN(boostPsi) ? boostPsi : 0;
  const safeDistanceFt = typeof distanceFt === 'number' && !isNaN(distanceFt) ? distanceFt : 0;
  const safeTireRpm = typeof tireRpm === 'number' && !isNaN(tireRpm) ? tireRpm : 0;
  const safeSlipPct = typeof slipPct === 'number' && !isNaN(slipPct) ? slipPct : 0;
  const safeSpeedMph = typeof speedMph === 'number' && !isNaN(speedMph) ? speedMph : 0;

  // Calculate ACCURATE wheel dimensions from tire specs
  // For 195/55R15: sidewall = 195 * 0.55 = 107.25mm
  // Total diameter = 15" * 25.4 + 107.25 * 2 = 381 + 214.5 = 595.5mm = 23.44"
  const sidewallMm = tireWidthMm * (tireAspectRatio / 100);  // 107.25mm for 195/55
  const rimDiameterMm = rimDiameterIn * 25.4;  // 381mm for 15"
  const totalDiameterMm = rimDiameterMm + (sidewallMm * 2);  // 595.5mm
  const totalDiameterIn = totalDiameterMm / 25.4;  // 23.44"
  
  // Ratios for visual scaling
  const rimRatio = rimDiameterMm / totalDiameterMm;  // 0.64 (64% is rim, 36% is tire)
  const sidewallRatio = (sidewallMm * 2) / totalDiameterMm;  // 0.36
  
  // Visual sizes - scaled to fit in container
  // Keep proportions accurate: if total is 155px, rim should be rimRatio of that
  const outerSize = 155;  // Total tire diameter in pixels — slightly larger for SVG detail
  const rimSize = Math.round(outerSize * rimRatio);  // ~99px for 15" rim in 23.44" tire
  const tireThickness = (outerSize - rimSize) / 2;  // ~28px sidewall thickness
  
  // Calculate tire circumference for accurate speed-to-RPM conversion
  const tireCircumferenceFt = (totalDiameterIn * Math.PI) / 12;
  
  // Calculate what tire RPM SHOULD be based on actual vehicle speed (no slip)
  // RPM = (speed in ft/min) / circumference = (mph * 5280 / 60) / circumference
  const expectedTireRpm = (safeSpeedMph * 88) / tireCircumferenceFt;

  // Update rotation and road movement
  useEffect(() => {
    let animationFrame: number;
    
    const animate = () => {
      const now = performance.now();
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;
      
      // Determine if we should animate tire rotation
      // Only spin when: car is moving OR there's actual wheelspin (slip > 5%)
      const isMoving = safeSpeedMph > 0.5;
      const hasWheelspin = safeSlipPct > 5;
      
      if (isMoving || hasWheelspin) {
        // TIRE ROTATION: Based on actual tire RPM from simulation
        // This includes wheelspin - tire spins faster than it should for the speed
        const tireDegreesPerSec = (safeTireRpm / 60) * 360;
        const tireDelta = tireDegreesPerSec * (deltaMs / 1000);
        rotationRef.current = (rotationRef.current + tireDelta) % 360;
        setRotation(rotationRef.current);
      }
      
      // ROAD MOVEMENT: Based on what the tire rotation WOULD be at this speed with NO slip
      // This is the key: road moves at "expected" speed, tire spins at "actual" speed
      // The visual difference IS the wheelspin
      const expectedDegreesPerSec = (expectedTireRpm / 60) * 360;
      // Convert tire rotation to road movement: 360 degrees = one tire circumference
      // Scale for visual: 360 degrees of tire rotation = ~80px of road movement
      const roadDegreesPerPx = 360 / 80;
      const roadDelta = (expectedDegreesPerSec / roadDegreesPerPx) * (deltaMs / 1000);
      roadOffsetRef.current = (roadOffsetRef.current + roadDelta) % 40;
      setRoadOffset(roadOffsetRef.current);
      
      animationFrame = requestAnimationFrame(animate);
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [safeTireRpm, safeSpeedMph, isLaunching, safeSlipPct, expectedTireRpm]);

  // Show slip effects when tire is spinning faster than road movement
  // With budget street tires (D=0.80), even B16A2's modest power causes slip
  const isSlipping = safeSlipPct > 5;
  const heavySlip = safeSlipPct > 20;
  const extremeSlip = safeSlipPct > 40;
  
  // Spoke opacity - blur when tire is spinning fast (only when moving or slipping)
  const shouldShowSpin = safeSpeedMph > 0.5 || safeSlipPct > 5;
  const effectiveTireRpm = shouldShowSpin ? safeTireRpm : 0;
  const spokeOpacity = effectiveTireRpm > 600 ? Math.max(0.1, 1 - (effectiveTireRpm - 600) / 1000) : 1;

  return (
    <div className="flex flex-col items-center py-3 col-span-4" data-testid="wheel-visual">
      {/* Top row: Gear, Boost gauge, Distance */}
      <div className="w-full flex justify-between items-center mb-2 px-2">
        {/* Gear Indicator */}
        <div className="flex flex-col items-center">
          <span className="text-[8px] tracking-wider uppercase opacity-50 font-mono">GEAR</span>
          <span className="text-[32px] font-mono font-black leading-none tabular-nums text-white">
            {currentGear === 0 ? 'N' : currentGear}
          </span>
        </div>
        
        {/* Mini Boost Gauge with sweeping needle */}
        <div className="flex flex-col items-center">
          <span className="text-[8px] tracking-wider uppercase opacity-50 font-mono">BOOST</span>
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Background arc */}
              <path
                d="M 15 75 A 42 42 0 1 1 85 75"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Vacuum zone -15 to 0 (left half) - blue */}
              <path
                d="M 15 75 A 42 42 0 0 1 50 8"
                fill="none"
                stroke="rgba(59,130,246,0.3)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Boost zone 0 to 35 (right half) - red gradient based on boost */}
              <path
                d="M 50 8 A 42 42 0 0 1 85 75"
                fill="none"
                stroke={turboEnabled && safeBoostPsi > 0 ? `rgba(239,68,68,${Math.min(0.8, 0.2 + safeBoostPsi / 40)})` : 'rgba(255,255,255,0.08)'}
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Tick marks */}
              {[-15, -10, -5, 0, 10, 20, 30].map((tick) => {
                const minB = -15, maxB = 35;
                const tickNorm = (tick - minB) / (maxB - minB);
                const tickAngle = (-135 + tickNorm * 270) * Math.PI / 180;
                const x1 = 50 + Math.cos(tickAngle) * 36;
                const y1 = 50 + Math.sin(tickAngle) * 36;
                const x2 = 50 + Math.cos(tickAngle) * 42;
                const y2 = 50 + Math.sin(tickAngle) * 42;
                return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />;
              })}
              {/* Zero marker - brighter */}
              {(() => {
                const zeroNorm = (0 - (-15)) / (35 - (-15));
                const zeroAngle = (-135 + zeroNorm * 270) * Math.PI / 180;
                const x1 = 50 + Math.cos(zeroAngle) * 34;
                const y1 = 50 + Math.sin(zeroAngle) * 34;
                const x2 = 50 + Math.cos(zeroAngle) * 42;
                const y2 = 50 + Math.sin(zeroAngle) * 42;
                return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.7)" strokeWidth="2" />;
              })()}
              {/* Sweeping needle */}
              {(() => {
                const minB = -15, maxB = 35;
                const clampedBoost = Math.max(minB, Math.min(safeBoostPsi, maxB));
                const needleNorm = (clampedBoost - minB) / (maxB - minB);
                const needleAngle = -135 + needleNorm * 270;
                const isPositive = safeBoostPsi > 0 && turboEnabled;
                return (
                  <g transform={`rotate(${needleAngle}, 50, 50)`} style={{ transition: 'transform 0.1s ease-out' }}>
                    <line
                      x1="50" y1="50" x2="50" y2="14"
                      stroke={isPositive ? '#ef4444' : '#ffffff'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="50" cy="50" r="5" fill={isPositive ? '#ef4444' : '#ffffff'} />
                  </g>
                );
              })()}
              {/* Center cap */}
              <circle cx="50" cy="50" r="3" fill="#000" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            </svg>
            {/* Digital readout */}
            <div className="absolute inset-x-0 bottom-1 text-center">
              <span className={`text-[12px] font-mono font-bold tabular-nums ${safeBoostPsi > 0 && turboEnabled ? 'text-red-400' : 'text-white/70'}`}>
                {safeBoostPsi.toFixed(1)}
              </span>
            </div>
          </div>
          <span className="text-[7px] tracking-wide uppercase opacity-50 font-mono -mt-1">PSI</span>
        </div>
        
        {/* Distance */}
        <div className="flex flex-col items-center">
          <span className="text-[8px] tracking-wider uppercase opacity-50 font-mono">DISTANCE</span>
          <span className="text-[24px] font-mono font-bold tabular-nums text-amber-400 leading-none">{safeDistanceFt.toFixed(0)}</span>
          <span className="text-[8px] tracking-wide uppercase opacity-50 font-mono">FT</span>
        </div>
      </div>
      <div className="relative" style={{ width: 210, height: 195 }}>
        {/* Smoke effects - show when slipping during launch */}
        {isSlipping && (
          <>
            <div 
              className="absolute rounded-full bg-white/20 blur-md"
              style={{
                width: 30 + safeSlipPct * 0.5,
                height: 20 + safeSlipPct * 0.3,
                left: 85 - safeSlipPct * 0.3,
                bottom: 35,
                opacity: 0.3 + (safeSlipPct / 100) * 0.4,
                animation: 'smoke-drift 0.5s ease-out infinite',
              }}
            />
            {heavySlip && (
              <div 
                className="absolute rounded-full bg-white/15 blur-lg"
                style={{
                  width: 40 + safeSlipPct * 0.4,
                  height: 25,
                  left: 70,
                  bottom: 30,
                  opacity: 0.2 + (safeSlipPct / 100) * 0.3,
                  animation: 'smoke-drift 0.7s ease-out infinite',
                  animationDelay: '0.2s',
                }}
              />
            )}
            {extremeSlip && (
              <div 
                className="absolute rounded-full bg-white/10 blur-xl"
                style={{ width: 50, height: 30, left: 60, bottom: 25, opacity: 0.3, animation: 'smoke-drift 0.9s ease-out infinite', animationDelay: '0.4s' }}
              />
            )}
          </>
        )}
        
        {/* Wheel assembly — SVG side-profile */}
        <div 
          className="absolute"
          style={{ width: outerSize, height: outerSize, left: (200 - outerSize) / 2, top: 5 }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full" style={{ overflow: 'visible' }}>
            <defs>
              {/* Tire rubber gradient — slight sheen on top */}
              <radialGradient id="tireRubber" cx="40%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#3a3a3a" />
                <stop offset="40%" stopColor="#222" />
                <stop offset="100%" stopColor="#181818" />
              </radialGradient>
              {/* Wheel face gradient — brushed alloy look */}
              <radialGradient id="wheelFace" cx="45%" cy="40%" r="55%">
                <stop offset="0%" stopColor="#c0c0c0" />
                <stop offset="30%" stopColor="#a0a0a0" />
                <stop offset="70%" stopColor="#888" />
                <stop offset="100%" stopColor="#666" />
              </radialGradient>
              {/* Barrel/dish shadow */}
              <radialGradient id="barrelShadow" cx="50%" cy="50%" r="50%">
                <stop offset="60%" stopColor="#555" />
                <stop offset="100%" stopColor="#333" />
              </radialGradient>
              {/* Center cap gradient */}
              <radialGradient id="hubCap" cx="40%" cy="35%" r="55%">
                <stop offset="0%" stopColor="#bbb" />
                <stop offset="50%" stopColor="#888" />
                <stop offset="100%" stopColor="#555" />
              </radialGradient>
              {/* Lip highlight */}
              <linearGradient id="rimLip" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d0d0d0" />
                <stop offset="50%" stopColor="#999" />
                <stop offset="100%" stopColor="#777" />
              </linearGradient>
            </defs>

            {/* === TIRE === */}
            {/* Outer tread surface */}
            <circle cx="100" cy="100" r="96" fill="url(#tireRubber)" stroke="#111" strokeWidth="1.5" />
            
            {/* Tread grooves — circumferential lines */}
            {[88, 91, 94].map((r) => (
              <circle key={`tread-${r}`} cx="100" cy="100" r={r} fill="none" stroke="#1a1a1a" strokeWidth="0.8" strokeDasharray="6 3" />
            ))}
            
            {/* Lateral tread sipes (cross-grooves around the circumference) */}
            {Array.from({ length: 36 }).map((_, i) => {
              const angle = (i * 10) * Math.PI / 180;
              const x1 = 100 + Math.cos(angle) * 86;
              const y1 = 100 + Math.sin(angle) * 86;
              const x2 = 100 + Math.cos(angle) * 96;
              const y2 = 100 + Math.sin(angle) * 96;
              return <line key={`sipe-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1a1a1a" strokeWidth="0.5" opacity="0.5" />;
            })}

            {/* Inner sidewall circle — defines the boundary between tire and wheel opening */}
            {/* rimRadius is proportional: for 195/55R15, rim is 64% of total diameter */}
            {(() => {
              // Proportional rim radius within our 96px outer radius
              const rimOuterR = 96 * rimRatio;  // ~61.5 for 195/55R15
              const sidewallWidth = 96 - rimOuterR; // ~34.5px — the visible tire sidewall
              
              return (
                <>
                  {/* Sidewall surface — the ring between tread and rim edge */}
                  {/* Sidewall is slightly darker than tread with subtle text area */}
                  <circle cx="100" cy="100" r={rimOuterR + 2} fill="none" stroke="#1f1f1f" strokeWidth={sidewallWidth * 2 - 4} opacity="0.3" />
                  
                  {/* Sidewall profile line — subtle raised ridge where sidewall meets tread */}
                  <circle cx="100" cy="100" r={96 - sidewallWidth * 0.15} fill="none" stroke="#333" strokeWidth="1" opacity="0.5" />
                  
                  {/* Sidewall profile line — bead area near rim */}
                  <circle cx="100" cy="100" r={rimOuterR + sidewallWidth * 0.15} fill="none" stroke="#333" strokeWidth="0.8" opacity="0.4" />
                  
                  {/* Sidewall brand text simulation — raised lettering effect */}
                  <text
                    x="100" y={100 - rimOuterR - sidewallWidth * 0.55}
                    fill="#333" fontSize="5.5" fontFamily="Arial, sans-serif" fontWeight="bold"
                    textAnchor="middle" dominantBaseline="middle"
                    style={{ letterSpacing: '1px' }}
                  >
                    {tireWidthMm}/{tireAspectRatio}R{rimDiameterIn}
                  </text>
                </>
              );
            })()}

            {/* === WHEEL (rotating group) === */}
            <g transform={`rotate(${rotation}, 100, 100)`}>
              {(() => {
                const rimR = 96 * rimRatio;       // outer edge of rim (~61.5)
                const lipWidth = rimR * 0.05;      // rim lip thickness
                const innerRimR = rimR - lipWidth; // inside the lip
                const hubR = rimR * 0.22;          // center hub
                const boltR = rimR * 0.16;         // lug nut circle
                const spokeW = rimR * 0.13;        // spoke width at hub
                const numSpokes = 5;

                return (
                  <>
                    {/* Barrel/dish — dark recessed area behind spokes */}
                    <circle cx="100" cy="100" r={innerRimR} fill="url(#barrelShadow)" />
                    
                    {/* Ventilation holes between spokes — dark openings showing brake disc */}
                    {Array.from({ length: numSpokes }).map((_, i) => {
                      const midAngle = ((i * 360 / numSpokes) + (360 / numSpokes / 2)) * Math.PI / 180;
                      const holeR = innerRimR * 0.32;
                      const holeDist = innerRimR * 0.58;
                      const hx = 100 + Math.cos(midAngle) * holeDist;
                      const hy = 100 + Math.sin(midAngle) * holeDist;
                      return (
                        <ellipse
                          key={`hole-${i}`}
                          cx={hx} cy={hy}
                          rx={holeR} ry={holeR * 0.65}
                          transform={`rotate(${i * 360 / numSpokes + 360 / numSpokes / 2}, ${hx}, ${hy})`}
                          fill="#222" stroke="#444" strokeWidth="0.5"
                          opacity={spokeOpacity}
                        />
                      );
                    })}

                    {/* Spokes — tapered from hub to rim lip */}
                    {Array.from({ length: numSpokes }).map((_, i) => {
                      const angle = (i * 360 / numSpokes) * Math.PI / 180;
                      // Hub attachment points
                      const hubOffsetAngle = Math.atan2(spokeW * 0.5, hubR + 2);
                      const h1x = 100 + Math.cos(angle - hubOffsetAngle) * (hubR + 2);
                      const h1y = 100 + Math.sin(angle - hubOffsetAngle) * (hubR + 2);
                      const h2x = 100 + Math.cos(angle + hubOffsetAngle) * (hubR + 2);
                      const h2y = 100 + Math.sin(angle + hubOffsetAngle) * (hubR + 2);
                      // Rim edge points — wider at the rim
                      const rimOffsetAngle = Math.atan2(spokeW * 0.7, innerRimR - 1);
                      const r1x = 100 + Math.cos(angle - rimOffsetAngle) * (innerRimR - 1);
                      const r1y = 100 + Math.sin(angle - rimOffsetAngle) * (innerRimR - 1);
                      const r2x = 100 + Math.cos(angle + rimOffsetAngle) * (innerRimR - 1);
                      const r2y = 100 + Math.sin(angle + rimOffsetAngle) * (innerRimR - 1);
                      
                      return (
                        <g key={`spoke-${i}`} opacity={spokeOpacity}>
                          {/* Spoke body */}
                          <polygon
                            points={`${h1x},${h1y} ${r1x},${r1y} ${r2x},${r2y} ${h2x},${h2y}`}
                            fill="url(#wheelFace)" stroke="#777" strokeWidth="0.5"
                          />
                          {/* Spoke center highlight line */}
                          <line
                            x1={100 + Math.cos(angle) * (hubR + 4)}
                            y1={100 + Math.sin(angle) * (hubR + 4)}
                            x2={100 + Math.cos(angle) * (innerRimR - 3)}
                            y2={100 + Math.sin(angle) * (innerRimR - 3)}
                            stroke="#ccc" strokeWidth="0.8" opacity="0.4"
                          />
                        </g>
                      );
                    })}

                    {/* Rim lip — polished outer ring */}
                    <circle cx="100" cy="100" r={rimR} fill="none" stroke="url(#rimLip)" strokeWidth={lipWidth * 2} />
                    <circle cx="100" cy="100" r={rimR + lipWidth * 0.5} fill="none" stroke="#aaa" strokeWidth="0.5" opacity="0.6" />
                    <circle cx="100" cy="100" r={rimR - lipWidth * 0.5} fill="none" stroke="#999" strokeWidth="0.5" opacity="0.4" />

                    {/* Center hub */}
                    <circle cx="100" cy="100" r={hubR} fill="url(#hubCap)" stroke="#777" strokeWidth="0.8" />
                    
                    {/* Hub cap detail — raised center with H logo area */}
                    <circle cx="100" cy="100" r={hubR * 0.65} fill="#888" stroke="#999" strokeWidth="0.5" />
                    <circle cx="100" cy="100" r={hubR * 0.45} fill="#777" stroke="#aaa" strokeWidth="0.3" />
                    {/* "H" emblem hint */}
                    <text x="100" y="100.5" fill="#bbb" fontSize={hubR * 0.5} fontWeight="bold" fontFamily="Arial" textAnchor="middle" dominantBaseline="middle">H</text>

                    {/* Lug nuts */}
                    {Array.from({ length: 4 }).map((_, i) => {
                      const nutAngle = ((i * 90) + 45) * Math.PI / 180;
                      const nx = 100 + Math.cos(nutAngle) * boltR;
                      const ny = 100 + Math.sin(nutAngle) * boltR;
                      return (
                        <circle key={`lug-${i}`} cx={nx} cy={ny} r={1.8} fill="#999" stroke="#666" strokeWidth="0.5" />
                      );
                    })}
                  </>
                );
              })()}
            </g>

            {/* Slip glow overlay on tire */}
            {isSlipping && (
              <circle
                cx="100" cy="100" r="96"
                fill="none"
                stroke={heavySlip ? 'rgba(255,80,30,0.25)' : 'rgba(255,150,50,0.15)'}
                strokeWidth="6"
              />
            )}
          </svg>
        </div>
        
        {/* Road with moving stripes */}
        <div 
          className="absolute overflow-hidden"
          style={{ height: 12, width: 190, left: 10, bottom: 32, background: '#1a1a1a', borderRadius: 2 }}
        >
          {/* Moving lane markings - shows actual ground speed */}
          <div 
            className="absolute h-full flex gap-4"
            style={{ transform: `translateX(-${roadOffset}px)`, width: 400 }}
          >
            {Array.from({ length: 15 }).map((_, i) => (
              <div 
                key={i}
                className="h-1 w-6 bg-yellow-500/60"
                style={{ marginTop: 5 }}
              />
            ))}
          </div>
        </div>
        
        {/* Tire contact shadow */}
        <div 
          className="absolute bg-black/40 rounded-full blur-sm"
          style={{ width: 45, height: 8, left: 82, bottom: 30 }}
        />
        
        {/* Tire marks when slipping */}
        {isSlipping && isLaunching && (
          <div 
            className="absolute bg-zinc-700/60"
            style={{ height: 6, width: Math.min(80, safeSlipPct * 1.5), left: 105 - Math.min(40, safeSlipPct * 0.75), bottom: 33, borderRadius: 2 }}
          />
        )}
        
        {/* Status display */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
          <span className={`text-[9px] font-mono tabular-nums ${isSlipping ? (heavySlip ? 'text-red-400' : 'text-yellow-400') : 'text-white/60'}`}>
            {safeSlipPct.toFixed(1)}% SLIP
          </span>
          <span className="text-[9px] font-mono tabular-nums text-white/60">
            {safeSpeedMph.toFixed(0)} MPH
          </span>
        </div>
        
        {/* Tire size indicator */}
        <div className="absolute -bottom-4 left-0 right-0 text-center">
          <span className="text-[8px] font-mono text-white/40">
            {tireWidthMm}/{tireAspectRatio}R{rimDiameterIn} ({totalDiameterIn.toFixed(1)}")
          </span>
        </div>
      </div>
    </div>
  );
}

function fmt(v: number | null, fallback: string = "---"): string {
  return v !== null ? String(v) : fallback;
}

// Default gauge order - used when no custom order is saved
const defaultGaugeOrder = [
  // Engine
  'rpm', 'throttle', 'torque', 'hp', 'vtec', 'eng-load', 'crank', 'boost-dial',
  // Combustion
  'cyl-press', 'afr', 'ign', 'spark', 'inj', 'vol-eff', 'fuel', 'fuel-press',
  // Intake/Exhaust
  'map', 'vacuum', 'intake-v', 'exhaust-v', 'egt', 'int-air-temp', 'cat-temp', 'o2',
  // Fluids
  'coolant', 'oil-temp', 'oil-press', 'battery',
  // Drivetrain
  'gear', 'dshaft', 'clutch', 'clutch-slip', 'whl-torq', 'whl-force', 'knock',
  // Traction
  'frt-load', 'rear-load', 'wt-trans', 'tire-slip', 'trac-lmt', 'tire-temp', 'patch',
  // Forces
  'drag-force', 'rolling', 'net-force', 'accel',
  // Quarter Mile
  'speed', 'speed-kmh', 'distance', 'distance-m', 'tire-rpm', 'elapsed', 'qm-et', 'trap-speed',
  // Split Times
  '60ft', '330ft', 'eighth', '1000ft',
  // ECU Status
  'boost', 'fan', 'cl-status', 'launch-ctrl', 'tc-status', 'knock-ret', 'fuel-cut', 'rev-limit', 'sc-active', 'nitrous',
  // Peak
  'peak-g', 'peak-whp',
];

interface ResultRowProps {
  label: string;
  value: string | number | null;
  unit: string;
  testId: string;
  large?: boolean;
}

function ResultRow({ label, value, unit, testId, large }: ResultRowProps) {
  return (
    <div className="flex items-baseline justify-between py-0.5" data-testid={testId}>
      <span className="text-[10px] tracking-wider uppercase opacity-70 font-mono">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`${large ? "text-[22px]" : "text-[16px]"} font-mono font-bold tabular-nums`}>{value ?? "---"}</span>
        <span className="text-[9px] tracking-wide uppercase opacity-60 font-mono">{unit}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const simRef = useRef(sharedSim);
  const soundRef = useRef<EngineSound | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [throttle, setThrottle] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const soundInitialized = useRef(false);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef<number>(0);
  const soundFadedRef = useRef(false);
  const finishStateRef = useRef<EngineState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeCount = useActiveCount();
  const [aiMode, toggleAi] = useAiMode();
  const [aiNotes, setAiNotes] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Drag and drop state for gauges
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [gaugeOrder, setGaugeOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('gaugeOrder');
    return saved ? JSON.parse(saved) : [];
  });

  const handleDrop = useCallback((targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    
    setGaugeOrder(prev => {
      // Get all gauge IDs from current layout if not set
      const allGauges = prev.length > 0 ? prev : defaultGaugeOrder;
      const fromIndex = allGauges.indexOf(draggedId);
      const toIndex = allGauges.indexOf(targetId);
      
      if (fromIndex === -1 || toIndex === -1) return prev;
      
      const newOrder = [...allGauges];
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, draggedId);
      
      localStorage.setItem('gaugeOrder', JSON.stringify(newOrder));
      return newOrder;
    });
  }, [draggedId]);

  const dragContextValue = { draggedId, setDraggedId, onDrop: handleDrop };

  useEffect(() => {
    if (!aiMode) {
      simRef.current.setAiCorrections({ gripMultiplier: 1, weightTransferMultiplier: 1, slipMultiplier: 1, dragMultiplier: 1, tractionMultiplier: 1 });
      setAiNotes("");
      if (aiPollRef.current) { clearInterval(aiPollRef.current); aiPollRef.current = null; }
      return;
    }

    const pollAi = async () => {
      const s = simRef.current.update(0);
      const cfg = simRef.current.getEcuConfig();
      setAiLoading(true);
      const corrections = await fetchAiCorrections({
        rpm: s.rpm, throttle: s.throttlePosition / 100, speedMph: s.speedMph,
        currentGear: typeof s.currentGearDisplay === 'number' ? s.currentGearDisplay : 0,
        torque: s.torque, horsepower: s.horsepower, boostPsi: s.boostPsi,
        tireSlipPercent: s.tireSlipPercent, accelerationG: s.accelerationG,
        weightTransfer: s.weightTransfer, frontAxleLoad: s.frontAxleLoad,
        wheelForce: s.wheelForce, tractionLimit: s.tractionLimit,
        ecuConfig: {
          vehicleMassLbs: cfg.vehicleMassLb, tireGripCoeff: cfg.tireGripCoeff,
          turboEnabled: cfg.turboEnabled, superchargerEnabled: cfg.superchargerEnabled,
          nitrousEnabled: cfg.nitrousEnabled, nitrousHpAdder: cfg.nitrousHpAdder,
          dragCoefficient: cfg.dragCoefficient, frontalAreaM2: cfg.frontalAreaM2,
          tireDiameterInches: cfg.tireDiameterIn,
        },
      });
      simRef.current.setAiCorrections(corrections);
      setAiNotes(corrections.aiNotes || "");
      setAiLoading(false);
    };

    pollAi();
    aiPollRef.current = setInterval(pollAi, 4000);
    return () => { if (aiPollRef.current) clearInterval(aiPollRef.current); };
  }, [aiMode]);

  useEffect(() => {
    soundRef.current = new EngineSound();
    
    // Auto-enable sound on first user interaction (required by browsers)
    const enableSound = () => {
      if (soundRef.current && !soundInitialized.current) {
        const ok = soundRef.current.init();
        if (ok) {
          soundRef.current.setEnabled(true);
          soundInitialized.current = true;
          setSoundOn(true);  // Update React state to reflect sound is on
        }
      }
      document.removeEventListener('click', enableSound);
      document.removeEventListener('touchstart', enableSound);
      document.removeEventListener('keydown', enableSound);
    };
    
    document.addEventListener('click', enableSound);
    document.addEventListener('touchstart', enableSound);
    document.addEventListener('keydown', enableSound);
    
    return () => {
      document.removeEventListener('click', enableSound);
      document.removeEventListener('touchstart', enableSound);
      document.removeEventListener('keydown', enableSound);
      soundRef.current?.destroy();
      soundRef.current = null;
    };
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    let delta = now - lastTimeRef.current;
    lastTimeRef.current = now;
    // Clamp delta: prevents physics blowup from tab-switch, GC pause, or heavy render
    // The sim also sub-steps internally, but clamping here is first line of defense
    if (delta > 200) delta = 16; // treat huge gaps as single normal frame
    if (delta < 0) delta = 16;   // clock went backwards (rare)
    const newState = simRef.current.update(delta);

    if (newState.quarterMileET !== null && newState.quarterMileActive) {
      if (!soundFadedRef.current) {
        soundFadedRef.current = true;
        soundRef.current?.fadeOut(800);
      }
      if (!finishStateRef.current) {
        finishStateRef.current = { ...newState };
        setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
      }
    }

    setState(newState);
    if (soundRef.current && soundRef.current.isEnabled()) {
      const config = simRef.current.getEcuConfig();
      soundRef.current.update(
        newState.rpm, newState.throttlePosition / 100, newState.vtecActive,
        newState.fuelCutActive, newState.revLimitActive,
        config.antiLagEnabled, newState.launchControlActive,
        newState.boostPsi, newState.turboEnabled,
        newState.tireSlipPercent, newState.currentGearDisplay,
        newState.quarterMileActive
      );
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  const handleThrottle = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) / 100;
    setThrottle(val * 100);
    simRef.current.setThrottle(val);
  }, []);

  const handleSoundToggle = useCallback(() => {
    if (!soundRef.current) return;
    if (!soundOn) {
      if (!soundInitialized.current) {
        const ok = soundRef.current.init();
        if (ok) {
          soundInitialized.current = true;
        }
      }
      if (soundInitialized.current) {
        soundRef.current.setEnabled(true);
        setSoundOn(true);
      }
    } else {
      soundRef.current.setEnabled(false);
      setSoundOn(false);
    }
  }, [soundOn]);

  // Stage the car (clutch in, ready to rev)
  const handleStage = useCallback(() => {
    simRef.current.startQuarterMile();
  }, []);

  // Dump the clutch and launch!
  const handleLaunch = useCallback(() => {
    simRef.current.launchCar();
  }, []);

  // Reset after run
  const handleReset = useCallback(() => {
    simRef.current.resetQuarterMile();
    setThrottle(0);
    soundFadedRef.current = false;
    finishStateRef.current = null;
    if (soundRef.current) {
      soundRef.current.cancelFade();
      if (soundOn) {
        soundRef.current.setEnabled(true);
      }
    }
  }, [soundOn]);

  if (!state) return null;

  const qmFinished = state.quarterMileET !== null;
  const fs = finishStateRef.current;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col select-none" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden" data-testid="gauge-scroll-area">
        <div className="flex items-center justify-between px-3 pt-2 pb-1 gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] tracking-[0.3em] uppercase opacity-60 font-mono">B16A2 DOHC VTEC</span>
            {/* Live Users Indicator - inline with title */}
            {activeCount > 0 && (
              <div className="flex items-center gap-1.5" data-testid="live-users-indicator">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-pulse-live absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                </span>
                <span className="text-[8px] tracking-wider uppercase font-mono text-white/60" data-testid="text-live-count">
                  {activeCount} LIVE
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAi}
              className={`text-[10px] tracking-wider uppercase font-mono border px-2 py-0.5 ${aiMode ? "border-green-500/60 text-green-400 opacity-100" : "border-white/25 opacity-70"}`}
              data-testid="button-ai-toggle"
            >
              {aiMode ? (aiLoading ? "AI..." : "AI ON") : "CODE"}
            </button>
            <button
              onClick={handleSoundToggle}
              className="text-[10px] tracking-wider uppercase opacity-70 font-mono border border-white/25 px-2 py-0.5"
              data-testid="button-sound-toggle"
            >
              {soundOn ? "SND" : "SND"}
            </button>
            <Link href="/ecu" className="text-[10px] tracking-wider uppercase opacity-70 font-mono border border-white/25 px-2 py-0.5" data-testid="link-ecu">
              ECU
            </Link>
            {gaugeOrder.length > 0 && (
              <button
                onClick={() => {
                  localStorage.removeItem('gaugeOrder');
                  setGaugeOrder([]);
                }}
                className="text-[10px] tracking-wider uppercase opacity-50 font-mono border border-white/15 px-2 py-0.5"
                data-testid="button-reset-layout"
                title="Reset gauge layout"
              >
                ⟲
              </button>
            )}
          </div>
        </div>

        {qmFinished && fs && (
          <div className="mx-3 mb-2 border border-white/30 p-3" data-testid="results-overlay">
            <div className="text-center mb-3">
              <span className="text-[10px] tracking-[0.4em] uppercase opacity-60 font-mono">QUARTER MILE RESULTS</span>
            </div>
            <ResultRow label="1/4 Mile ET" value={fs.quarterMileET} unit="sec" testId="result-et" large />
            <ResultRow label="Trap Speed" value={fs.trapSpeed} unit="mph" testId="result-trap" large />
            <div className="h-px bg-white/15 my-2" />
            <ResultRow label="60 ft" value={fs.sixtyFootTime} unit="sec" testId="result-60ft" />
            <ResultRow label="330 ft" value={fs.threeThirtyTime} unit="sec" testId="result-330ft" />
            <ResultRow label="1/8 Mile" value={fs.eighthMileTime} unit="sec" testId="result-eighth" />
            <ResultRow label="1000 ft" value={fs.thousandFootTime} unit="sec" testId="result-1000ft" />
            <div className="h-px bg-white/15 my-2" />
            <ResultRow label="Peak RPM" value={fs.peakRpm} unit="rpm" testId="result-rpm" />
            <ResultRow label="Peak WHP" value={fs.peakWheelHp} unit="hp" testId="result-whp" />
            <ResultRow label="Peak G" value={fs.peakAccelG} unit="g" testId="result-g" />
            <ResultRow label="Peak Boost" value={fs.peakBoostPsi} unit="psi" testId="result-boost" />
            <ResultRow label="Top Speed" value={fs.peakSpeedMph} unit="mph" testId="result-speed" />
            <ResultRow label="Final Gear" value={fs.currentGearDisplay} unit="" testId="result-gear" />
            <ResultRow label="Peak Slip" value={fs.peakSlipPercent} unit="%" testId="result-slip" />
            <div className="mt-3">
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full text-[11px] tracking-[0.2em] uppercase font-mono bg-transparent text-white/90 border-white/30"
                data-testid="button-new-run"
              >
                NEW RUN
              </Button>
            </div>
          </div>
        )}

        {/* Porsche Gauge Cluster */}
        <PorscheGaugeCluster rpm={state.rpm} speedMph={state.speedMph} wheelSpeedMph={state.wheelSpeedMph} redline={8000} />

        {/* Tire Visual */}
        <WheelVisual 
          tireRpm={state.tireRpm} 
          slipPct={state.tireSlipPercent}
          speedMph={state.speedMph}
          tireWidthMm={195}
          tireAspectRatio={55}
          rimDiameterIn={15}
          isLaunching={state.quarterMileLaunched}
          distanceFt={state.distanceFt}
          currentGear={state.currentGearDisplay}
          boostPsi={state.boostPsi}
          turboEnabled={state.turboEnabled}
        />

          {/* FWD Drivetrain Visual (Front 3/4 View) */}
          <div className="flex flex-col items-center py-2 col-span-4">
            <FWDDrivetrainVisual
              tireRpm={state.tireRpm}
              driveshaftRpm={state.driveshaftRpm}
              currentGear={state.currentGearDisplay}
              currentGearRatio={state.currentGearRatio}
              tireWidthMm={195}
              tireAspectRatio={55}
              rimDiameterIn={15}
              slipPct={state.tireSlipPercent}
              clutchStatus={state.clutchStatus}
              rpm={state.rpm}
            />
          </div>

          {/* 3D Interactive Drivetrain View */}
          <div className="flex flex-col items-center py-2 col-span-4">
            <DrivetrainView3D
              tireRpm={state.tireRpm}
              rpm={state.rpm}
              clutchStatus={state.clutchStatus}
              clutchSlipPct={state.clutchSlipPct}
              currentGear={state.currentGearDisplay}
              currentGearRatio={state.currentGearRatio}
              slipPct={state.tireSlipPercent}
              drivetrainType={state.drivetrainType}
            />
          </div>

        <DragContext.Provider value={dragContextValue}>
          <div className="grid grid-cols-4 gap-0" data-testid="gauge-grid">
            {(() => {
              // Define all gauge configurations
              const gaugeConfigs: Record<string, { label: string; value: string | number; unit: string; testId: string; highlight?: boolean; section?: string }> = {
                // Engine section
                'rpm': { label: 'RPM', value: state.rpm, unit: 'rev/min', testId: 'gauge-rpm', section: 'Engine' },
                'throttle': { label: 'Throttle', value: state.throttlePosition, unit: '%', testId: 'gauge-throttle' },
                'torque': { label: 'Torque', value: state.torque, unit: 'ft-lb', testId: 'gauge-torque' },
                'hp': { label: 'HP', value: state.horsepower, unit: 'hp', testId: 'gauge-hp' },
                'vtec': { label: 'VTEC', value: state.vtecActive ? 'ON' : 'OFF', unit: state.vtecActive ? '>5500' : '<5500', testId: 'gauge-vtec', highlight: state.vtecActive },
                'eng-load': { label: 'Eng Load', value: state.engineLoad, unit: '%', testId: 'gauge-eng-load' },
                'crank': { label: 'Crank', value: state.crankAngle, unit: 'deg', testId: 'gauge-crank' },
                // Combustion
                'cyl-press': { label: 'Cyl Press', value: state.cylinderPressure, unit: 'psi', testId: 'gauge-cyl-press', section: 'Combustion' },
                'afr': { label: 'AFR', value: state.airFuelRatio, unit: 'ratio', testId: 'gauge-afr' },
                'ign': { label: 'Ign Timing', value: state.ignitionTiming, unit: '°btdc', testId: 'gauge-ign' },
                'spark': { label: 'Spark Adv', value: state.sparkAdvance, unit: 'deg', testId: 'gauge-spark' },
                'inj': { label: 'Inj Pulse', value: state.fuelInjectionPulse, unit: 'ms', testId: 'gauge-inj' },
                'vol-eff': { label: 'Vol Eff', value: state.volumetricEfficiency, unit: '%', testId: 'gauge-vol-eff' },
                'fuel': { label: 'Fuel Rate', value: state.fuelConsumption, unit: 'g/s', testId: 'gauge-fuel' },
                'fuel-press': { label: 'Fuel Press', value: state.fuelPressure, unit: 'psi', testId: 'gauge-fuel-press' },
                // Intake/Exhaust
                'map': { label: 'MAP', value: state.intakeManifoldPressure, unit: 'kpa', testId: 'gauge-map', section: 'Intake / Exhaust' },
                'vacuum': { label: 'Vacuum', value: state.intakeVacuum, unit: 'inHg', testId: 'gauge-vacuum' },
                'intake-v': { label: 'Intake V', value: state.intakeValveLift, unit: 'mm', testId: 'gauge-intake-v' },
                'exhaust-v': { label: 'Exhaust V', value: state.exhaustValveLift, unit: 'mm', testId: 'gauge-exhaust-v' },
                'egt': { label: 'EGT', value: state.exhaustGasTemp, unit: '°F', testId: 'gauge-egt' },
                'int-air-temp': { label: 'Int Air T', value: state.intakeAirTemp, unit: '°F', testId: 'gauge-int-air-temp' },
                'cat-temp': { label: 'Cat Temp', value: state.catalystTemp, unit: '°F', testId: 'gauge-cat-temp' },
                'o2': { label: 'O2 Sensor', value: state.o2SensorVoltage, unit: 'V', testId: 'gauge-o2' },
                // Fluids
                'coolant': { label: 'Coolant', value: state.coolantTemp, unit: '°F', testId: 'gauge-coolant', section: 'Fluids / Electrical' },
                'oil-temp': { label: 'Oil Temp', value: state.oilTemp, unit: '°F', testId: 'gauge-oil-temp' },
                'oil-press': { label: 'Oil Press', value: state.oilPressure, unit: 'psi', testId: 'gauge-oil-press' },
                'battery': { label: 'Battery', value: state.batteryVoltage, unit: 'V', testId: 'gauge-battery' },
                // Drivetrain
                'gear': { label: 'Gear', value: state.currentGearDisplay, unit: `ratio ${state.currentGearRatio}`, testId: 'gauge-gear', section: 'Drivetrain' },
                'dshaft': { label: 'D-Shaft', value: state.driveshaftRpm, unit: 'rpm', testId: 'gauge-dshaft' },
                'clutch': { label: 'Clutch', value: state.clutchStatus, unit: 'status', testId: 'gauge-clutch' },
                'clutch-slip': { label: 'Clutch Slip', value: state.clutchSlipPct, unit: '%', testId: 'gauge-clutch-slip' },
                'whl-torq': { label: 'Whl Torq', value: state.wheelTorque, unit: 'ft-lb', testId: 'gauge-whl-torq' },
                'whl-force': { label: 'Whl Force', value: state.wheelForce, unit: 'lbs', testId: 'gauge-whl-force' },
                'knock': { label: 'Knock', value: state.knockCount, unit: 'events', testId: 'gauge-knock' },
                // Traction
                'frt-load': { label: 'Frt Load', value: state.frontAxleLoad, unit: 'lbs', testId: 'gauge-frt-load', section: 'Traction' },
                'rear-load': { label: 'Rear Load', value: state.rearAxleLoad, unit: 'lbs', testId: 'gauge-rear-load' },
                'wt-trans': { label: 'Wt Trans', value: state.weightTransfer, unit: 'lbs', testId: 'gauge-wt-trans' },
                'tire-slip': { label: 'Tire Slip', value: state.tireSlipPercent, unit: '%', testId: 'gauge-tire-slip' },
                'trac-lmt': { label: 'Trac Lmt', value: state.tractionLimit, unit: 'lbs', testId: 'gauge-trac-lmt' },
                'tire-temp': { label: 'Tire Temp', value: state.tireTemp, unit: state.tireTempOptimal ? '°F OK' : '°F', testId: 'gauge-tire-temp' },
                'patch': { label: 'Patch', value: state.contactPatchArea, unit: 'in²', testId: 'gauge-contact-patch' },
                // Forces
                'drag-force': { label: 'Drag', value: state.dragForce, unit: 'lbs', testId: 'gauge-drag-force', section: 'Forces' },
                'rolling': { label: 'Rolling R', value: state.rollingResistance, unit: 'lbs', testId: 'gauge-rolling' },
                'net-force': { label: 'Net Force', value: state.netForce, unit: 'lbs', testId: 'gauge-net-force' },
                'accel': { label: 'Accel', value: state.accelerationG, unit: 'g', testId: 'gauge-accel' },
                // Quarter Mile
                'speed': { label: 'Speed', value: state.speedMph, unit: 'mph', testId: 'gauge-speed', section: 'Quarter Mile' },
                'speed-kmh': { label: 'Speed', value: state.speedKmh, unit: 'km/h', testId: 'gauge-speed-kmh' },
                'distance': { label: 'Distance', value: state.distanceFt, unit: 'ft', testId: 'gauge-distance' },
                'distance-m': { label: 'Distance', value: state.distanceMeters, unit: 'm', testId: 'gauge-distance-m' },
                'tire-rpm': { label: 'Tire RPM', value: state.tireRpm, unit: 'rev/min', testId: 'gauge-tire-rpm' },
                'elapsed': { label: 'Elapsed', value: state.elapsedTime, unit: 'sec', testId: 'gauge-elapsed' },
                'qm-et': { label: '1/4 ET', value: fmt(state.quarterMileET), unit: 'sec', testId: 'gauge-qm-et', highlight: qmFinished },
                'trap-speed': { label: 'Trap Spd', value: fmt(state.trapSpeed), unit: 'mph', testId: 'gauge-trap-speed', highlight: qmFinished },
                // Split Times
                '60ft': { label: '60 ft', value: fmt(state.sixtyFootTime), unit: 'sec', testId: 'gauge-60ft', section: 'Split Times' },
                '330ft': { label: '330 ft', value: fmt(state.threeThirtyTime), unit: 'sec', testId: 'gauge-330ft' },
                'eighth': { label: '1/8 Mile', value: fmt(state.eighthMileTime), unit: 'sec', testId: 'gauge-eighth' },
                '1000ft': { label: '1000 ft', value: fmt(state.thousandFootTime), unit: 'sec', testId: 'gauge-1000ft' },
                // ECU Status
                'boost': { label: 'Boost', value: state.boostPsi, unit: 'psi', testId: 'gauge-boost', highlight: state.turboEnabled || state.superchargerEnabled, section: 'ECU Status' },
                'fan': { label: 'Fan', value: state.fanStatus ? 'ON' : 'OFF', unit: 'status', testId: 'gauge-fan' },
                'cl-status': { label: 'Fuel Map', value: state.closedLoopStatus, unit: 'loop', testId: 'gauge-cl-status' },
                'launch-ctrl': { label: 'Launch', value: state.launchControlActive ? 'ON' : 'OFF', unit: 'ctrl', testId: 'gauge-launch-ctrl' },
                'tc-status': { label: 'Trac Ctrl', value: state.tractionControlActive ? 'ON' : 'OFF', unit: 'status', testId: 'gauge-tc-status' },
                'knock-ret': { label: 'Knock Ret', value: state.knockRetardActive, unit: 'deg', testId: 'gauge-knock-ret' },
                'fuel-cut': { label: 'Fuel Cut', value: state.fuelCutActive ? 'YES' : 'NO', unit: 'status', testId: 'gauge-fuel-cut' },
                'rev-limit': { label: 'Rev Limit', value: state.revLimitActive ? 'YES' : 'NO', unit: 'status', testId: 'gauge-rev-limit' },
                'sc-active': { label: 'S/C Active', value: state.superchargerEnabled ? 'ON' : 'OFF', unit: 'status', testId: 'gauge-sc-active', highlight: state.superchargerEnabled },
                'nitrous': { label: 'Nitrous', value: state.nitrousActive ? 'ON' : 'OFF', unit: 'status', testId: 'gauge-nitrous', highlight: state.nitrousActive },
                // Peak
                'peak-g': { label: 'Peak G', value: state.peakAccelG, unit: 'g', testId: 'gauge-peak-g', section: 'Peak Performance' },
                'peak-whp': { label: 'Peak WHP', value: state.peakWheelHp, unit: 'hp', testId: 'gauge-peak-whp' },
              };

              // Use saved order or default
              const order = gaugeOrder.length > 0 ? gaugeOrder : defaultGaugeOrder;
              let lastSection = '';
              
              return order.map((id) => {
                const config = gaugeConfigs[id];
                if (!config) return null;
                
                const elements: React.ReactNode[] = [];
                
                // Add section header if this gauge starts a new section
                if (config.section && config.section !== lastSection) {
                  lastSection = config.section;
                  elements.push(<SectionHeader key={`section-${config.section}`} title={config.section} />);
                }
                
                // Special handling for boost-dial (BoostGauge component)
                if (id === 'boost-dial') {
                  elements.push(
                    <BoostGauge 
                      key={id}
                      boostPsi={state.boostPsi} 
                      turboEnabled={state.turboEnabled} 
                      superchargerEnabled={state.superchargerEnabled}
                    />
                  );
                } else {
                  elements.push(
                    <Gauge
                      key={id}
                      gaugeId={id}
                      label={config.label}
                      value={config.value}
                      unit={config.unit}
                      testId={config.testId}
                      highlight={config.highlight}
                    />
                  );
                }
                
                return elements;
              });
            })()}

            {aiMode && aiNotes && (
              <div className="col-span-4 px-3 py-2" data-testid="ai-notes-section">
                <div className="border border-green-500/30 px-2 py-1.5">
                  <span className="text-[8px] tracking-[0.2em] uppercase text-green-400/80 font-mono block mb-1">AI PHYSICS NOTES</span>
                  <span className="text-[9px] font-mono text-green-300/70 leading-tight block" data-testid="text-ai-notes">{aiNotes}</span>
                </div>
              </div>
            )}

            <div className="col-span-4 h-4" />
          </div>
        </DragContext.Provider>
      </div>

      <div className="shrink-0 px-4 pb-3 pt-2 border-t border-white/20 bg-black" data-testid="controls-area">
        <div className="flex items-center gap-3">
          <span className="text-[9px] tracking-wider uppercase opacity-70 font-mono w-16">Throttle</span>
          <input
            type="range"
            min="0"
            max="100"
            value={throttle}
            onChange={handleThrottle}
            className="flex-1 h-1 appearance-none bg-white/20 rounded-none outline-none cursor-pointer disabled:opacity-30"
            style={{
              WebkitAppearance: "none",
              background: `linear-gradient(to right, white ${throttle}%, rgba(255,255,255,0.2) ${throttle}%)`,
            }}
            data-testid="input-throttle"
          />
          <span className="text-[11px] font-mono tabular-nums w-8 text-right opacity-80" data-testid="text-throttle-value">{Math.round(throttle)}%</span>
        </div>

        {/* Clutch status indicator when staging */}
        {state.quarterMileActive && !state.quarterMileLaunched && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className={`text-[10px] tracking-wider uppercase font-mono ${state.clutchIn ? 'text-yellow-400' : 'text-green-400'}`}>
              CLUTCH: {state.clutchIn ? 'IN (DISENGAGED)' : 'OUT (ENGAGED)'}
            </span>
            <span className="text-[10px] tracking-wider uppercase font-mono text-white/50">
              — REV UP THEN LAUNCH!
            </span>
          </div>
        )}

        {!state.quarterMileActive ? (
          // Not staged yet
          <Button
            onClick={handleStage}
            variant="outline"
            className="w-full mt-2 text-[11px] tracking-[0.2em] uppercase font-mono bg-transparent text-white/90 border-white/30"
            data-testid="button-stage"
          >
            STAGE — PULL TO LINE
          </Button>
        ) : !state.quarterMileLaunched ? (
          // Staged, waiting to launch
          <Button
            onClick={handleLaunch}
            variant="outline"
            className="w-full mt-2 text-[11px] tracking-[0.2em] uppercase font-mono bg-green-900/50 text-green-400 border-green-500/50 hover:bg-green-900/70"
            data-testid="button-launch"
          >
            🚦 LAUNCH! (DUMP CLUTCH)
          </Button>
        ) : qmFinished ? (
          // Finished
          <Button
            onClick={handleReset}
            variant="outline"
            className="w-full mt-2 text-[11px] tracking-[0.2em] uppercase font-mono bg-transparent text-white/90 border-white/30"
            data-testid="button-new-run"
          >
            NEW RUN
          </Button>
        ) : (
          // Running
          <Button
            onClick={handleReset}
            variant="outline"
            className="w-full mt-2 text-[11px] tracking-[0.2em] uppercase font-mono bg-red-900/30 text-red-400/80 border-red-500/30"
            data-testid="button-abort"
          >
            RUNNING — TAP TO ABORT
          </Button>
        )}
      </div>
    </div>
  );
}
