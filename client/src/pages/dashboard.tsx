import { useState, useEffect, useRef, useCallback } from "react";
import { createEngineSimulation, type EngineState } from "@/lib/engineSim";

interface GaugeProps {
  label: string;
  value: string | number;
  unit: string;
  testId: string;
}

function Gauge({ label, value, unit, testId }: GaugeProps) {
  return (
    <div className="flex flex-col items-center justify-center p-1" data-testid={testId}>
      <span className="text-[9px] tracking-wider uppercase opacity-40 leading-tight text-center font-mono">{label}</span>
      <span className="text-[18px] font-mono font-bold leading-tight tabular-nums" data-testid={`value-${testId}`}>{value}</span>
      <span className="text-[8px] tracking-wide uppercase opacity-30 leading-tight font-mono">{unit}</span>
    </div>
  );
}

export default function Dashboard() {
  const simRef = useRef(createEngineSimulation());
  const [state, setState] = useState<EngineState | null>(null);
  const [throttle, setThrottle] = useState(0);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef<number>(0);

  const tick = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;
    const newState = simRef.current.update(delta);
    setState(newState);
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

  if (!state) return null;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col select-none overflow-hidden" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="text-center pt-2 pb-1">
        <div className="text-[10px] tracking-[0.3em] uppercase opacity-30">Single Cylinder 4-Stroke</div>
      </div>

      <div className="flex-1 grid grid-cols-4 grid-rows-5 gap-0" data-testid="gauge-grid">
        <Gauge label="RPM" value={state.rpm} unit="rev/min" testId="gauge-rpm" />
        <Gauge label="Throttle" value={state.throttlePosition} unit="%" testId="gauge-throttle" />
        <Gauge label="Crank" value={state.crankAngle} unit="deg" testId="gauge-crank" />
        <Gauge label="Stroke" value={state.strokePhase} unit="phase" testId="gauge-stroke" />

        <Gauge label="Cyl Press" value={state.cylinderPressure} unit="psi" testId="gauge-cyl-press" />
        <Gauge label="MAP" value={state.intakeManifoldPressure} unit="kpa" testId="gauge-map" />
        <Gauge label="EGT" value={state.exhaustGasTemp} unit="°F" testId="gauge-egt" />
        <Gauge label="AFR" value={state.airFuelRatio} unit="ratio" testId="gauge-afr" />

        <Gauge label="Coolant" value={state.coolantTemp} unit="°F" testId="gauge-coolant" />
        <Gauge label="Oil Temp" value={state.oilTemp} unit="°F" testId="gauge-oil-temp" />
        <Gauge label="Oil Press" value={state.oilPressure} unit="psi" testId="gauge-oil-press" />
        <Gauge label="Ign Timing" value={state.ignitionTiming} unit="°btdc" testId="gauge-ign" />

        <Gauge label="Intake V" value={state.intakeValveLift} unit="mm" testId="gauge-intake-v" />
        <Gauge label="Exhaust V" value={state.exhaustValveLift} unit="mm" testId="gauge-exhaust-v" />
        <Gauge label="Spark Adv" value={state.sparkAdvance} unit="deg" testId="gauge-spark" />
        <Gauge label="Inj Pulse" value={state.fuelInjectionPulse} unit="ms" testId="gauge-inj" />

        <Gauge label="Vol Eff" value={state.volumetricEfficiency} unit="%" testId="gauge-vol-eff" />
        <Gauge label="Torque" value={state.torque} unit="ft-lb" testId="gauge-torque" />
        <Gauge label="HP" value={state.horsepower} unit="hp" testId="gauge-hp" />
        <Gauge label="Fuel Rate" value={state.fuelConsumption} unit="g/s" testId="gauge-fuel" />
      </div>

      <div className="px-4 pb-4 pt-1">
        <div className="flex items-center gap-3">
          <span className="text-[9px] tracking-wider uppercase opacity-40 font-mono w-16">Throttle</span>
          <input
            type="range"
            min="0"
            max="100"
            value={throttle}
            onChange={handleThrottle}
            className="flex-1 h-1 appearance-none bg-white/10 rounded-none outline-none cursor-pointer"
            style={{
              WebkitAppearance: "none",
              background: `linear-gradient(to right, white ${throttle}%, rgba(255,255,255,0.1) ${throttle}%)`,
            }}
            data-testid="input-throttle"
          />
          <span className="text-[11px] font-mono tabular-nums w-8 text-right opacity-60" data-testid="text-throttle-value">{Math.round(throttle)}%</span>
        </div>
      </div>
    </div>
  );
}
