import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { type EngineState } from "@/lib/engineSim";
import { sharedSim } from "@/lib/sharedSim";
import { EngineSound } from "@/lib/engineSound";
import { Button } from "@/components/ui/button";

interface GaugeProps {
  label: string;
  value: string | number;
  unit: string;
  testId: string;
  highlight?: boolean;
}

function Gauge({ label, value, unit, testId, highlight }: GaugeProps) {
  return (
    <div className="flex flex-col items-center justify-center py-2 px-1" data-testid={testId}>
      <span className="text-[9px] tracking-wider uppercase opacity-70 leading-tight text-center font-mono">{label}</span>
      <span className={`text-[18px] font-mono font-bold leading-tight tabular-nums ${highlight ? "opacity-100" : ""}`} data-testid={`value-${testId}`}>{value}</span>
      <span className="text-[8px] tracking-wide uppercase opacity-60 leading-tight font-mono">{unit}</span>
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

function fmt(v: number | null, fallback: string = "---"): string {
  return v !== null ? String(v) : fallback;
}

export default function Dashboard() {
  const simRef = useRef(sharedSim);
  const soundRef = useRef<EngineSound | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [throttle, setThrottle] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    soundRef.current = new EngineSound();
    return () => { soundRef.current?.destroy(); soundRef.current = null; };
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;
    const newState = simRef.current.update(delta);
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
      const ok = soundRef.current.init();
      if (ok) {
        soundRef.current.setEnabled(true);
        setSoundOn(true);
      }
    } else {
      soundRef.current.setEnabled(false);
      setSoundOn(false);
    }
  }, [soundOn]);

  const handleLaunch = useCallback(() => {
    if (state?.quarterMileActive) {
      simRef.current.resetQuarterMile();
      setThrottle(0);
    } else {
      simRef.current.startQuarterMile();
    }
  }, [state?.quarterMileActive]);

  if (!state) return null;

  const qmFinished = state.quarterMileET !== null;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col select-none" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden" data-testid="gauge-scroll-area">
        <div className="flex items-center justify-between px-3 pt-2 pb-1 gap-2">
          <span className="text-[10px] tracking-[0.3em] uppercase opacity-60 font-mono">B16A2 DOHC VTEC</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSoundToggle}
              className="text-[10px] tracking-wider uppercase opacity-70 font-mono border border-white/25 px-2 py-0.5"
              data-testid="button-sound-toggle"
            >
              {soundOn ? "SOUND ON" : "SOUND OFF"}
            </button>
            <Link href="/ecu" className="text-[10px] tracking-wider uppercase opacity-70 font-mono border border-white/25 px-2 py-0.5" data-testid="link-ecu">
              ECU TUNE
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-0" data-testid="gauge-grid">

          <SectionHeader title="Engine" />
          <Gauge label="RPM" value={state.rpm} unit="rev/min" testId="gauge-rpm" />
          <Gauge label="Throttle" value={state.throttlePosition} unit="%" testId="gauge-throttle" />
          <Gauge label="Torque" value={state.torque} unit="ft-lb" testId="gauge-torque" />
          <Gauge label="HP" value={state.horsepower} unit="hp" testId="gauge-hp" />
          <Gauge label="VTEC" value={state.vtecActive ? "ON" : "OFF"} unit={state.vtecActive ? ">5500" : "<5500"} testId="gauge-vtec" highlight={state.vtecActive} />
          <Gauge label="Eng Load" value={state.engineLoad} unit="%" testId="gauge-eng-load" />
          <Gauge label="Crank" value={state.crankAngle} unit="deg" testId="gauge-crank" />
          <Gauge label="Stroke" value={state.strokePhase} unit="phase" testId="gauge-stroke" />

          <SectionHeader title="Combustion" />
          <Gauge label="Cyl Press" value={state.cylinderPressure} unit="psi" testId="gauge-cyl-press" />
          <Gauge label="AFR" value={state.airFuelRatio} unit="ratio" testId="gauge-afr" />
          <Gauge label="Ign Timing" value={state.ignitionTiming} unit="°btdc" testId="gauge-ign" />
          <Gauge label="Spark Adv" value={state.sparkAdvance} unit="deg" testId="gauge-spark" />
          <Gauge label="Inj Pulse" value={state.fuelInjectionPulse} unit="ms" testId="gauge-inj" />
          <Gauge label="Vol Eff" value={state.volumetricEfficiency} unit="%" testId="gauge-vol-eff" />
          <Gauge label="Fuel Rate" value={state.fuelConsumption} unit="g/s" testId="gauge-fuel" />
          <Gauge label="Fuel Press" value={state.fuelPressure} unit="psi" testId="gauge-fuel-press" />

          <SectionHeader title="Intake / Exhaust" />
          <Gauge label="MAP" value={state.intakeManifoldPressure} unit="kpa" testId="gauge-map" />
          <Gauge label="Vacuum" value={state.intakeVacuum} unit="inHg" testId="gauge-vacuum" />
          <Gauge label="Intake V" value={state.intakeValveLift} unit="mm" testId="gauge-intake-v" />
          <Gauge label="Exhaust V" value={state.exhaustValveLift} unit="mm" testId="gauge-exhaust-v" />
          <Gauge label="EGT" value={state.exhaustGasTemp} unit="°F" testId="gauge-egt" />
          <Gauge label="Int Air T" value={state.intakeAirTemp} unit="°F" testId="gauge-int-air-temp" />
          <Gauge label="Cat Temp" value={state.catalystTemp} unit="°F" testId="gauge-cat-temp" />
          <Gauge label="O2 Sensor" value={state.o2SensorVoltage} unit="V" testId="gauge-o2" />

          <SectionHeader title="Fluids / Electrical" />
          <Gauge label="Coolant" value={state.coolantTemp} unit="°F" testId="gauge-coolant" />
          <Gauge label="Oil Temp" value={state.oilTemp} unit="°F" testId="gauge-oil-temp" />
          <Gauge label="Oil Press" value={state.oilPressure} unit="psi" testId="gauge-oil-press" />
          <Gauge label="Battery" value={state.batteryVoltage} unit="V" testId="gauge-battery" />

          <SectionHeader title="Drivetrain" />
          <Gauge label="Gear" value={state.currentGearDisplay} unit={`ratio ${state.currentGearRatio}`} testId="gauge-gear" />
          <Gauge label="D-Shaft" value={state.driveshaftRpm} unit="rpm" testId="gauge-dshaft" />
          <Gauge label="Clutch" value={state.clutchStatus} unit="status" testId="gauge-clutch" />
          <Gauge label="Whl Torq" value={state.wheelTorque} unit="ft-lb" testId="gauge-whl-torq" />
          <Gauge label="Whl Force" value={state.wheelForce} unit="lbs" testId="gauge-whl-force" />
          <Gauge label="Knock" value={state.knockCount} unit="events" testId="gauge-knock" />

          <SectionHeader title="Traction" />
          <Gauge label="Frt Load" value={state.frontAxleLoad} unit="lbs" testId="gauge-frt-load" />
          <Gauge label="Rear Load" value={state.rearAxleLoad} unit="lbs" testId="gauge-rear-load" />
          <Gauge label="Wt Trans" value={state.weightTransfer} unit="lbs" testId="gauge-wt-trans" />
          <Gauge label="Tire Slip" value={state.tireSlipPercent} unit="%" testId="gauge-tire-slip" />
          <Gauge label="Trac Lmt" value={state.tractionLimit} unit="lbs" testId="gauge-trac-lmt" />
          <Gauge label="Tire Temp" value={state.tireTemp} unit="°F" testId="gauge-tire-temp" />

          <SectionHeader title="Forces" />
          <Gauge label="Drag" value={state.dragForce} unit="lbs" testId="gauge-drag-force" />
          <Gauge label="Rolling R" value={state.rollingResistance} unit="lbs" testId="gauge-rolling" />
          <Gauge label="Net Force" value={state.netForce} unit="lbs" testId="gauge-net-force" />
          <Gauge label="Accel" value={state.accelerationG} unit="g" testId="gauge-accel" />

          <SectionHeader title="Quarter Mile" />
          <Gauge label="Speed" value={state.speedMph} unit="mph" testId="gauge-speed" />
          <Gauge label="Speed" value={state.speedKmh} unit="km/h" testId="gauge-speed-kmh" />
          <Gauge label="Distance" value={state.distanceFt} unit="ft" testId="gauge-distance" />
          <Gauge label="Distance" value={state.distanceMeters} unit="m" testId="gauge-distance-m" />
          <Gauge label="Tire RPM" value={state.tireRpm} unit="rev/min" testId="gauge-tire-rpm" />
          <Gauge label="Elapsed" value={state.elapsedTime} unit="sec" testId="gauge-elapsed" />
          <Gauge label="1/4 ET" value={fmt(state.quarterMileET)} unit="sec" testId="gauge-qm-et" highlight={qmFinished} />
          <Gauge label="Trap Spd" value={fmt(state.trapSpeed)} unit="mph" testId="gauge-trap-speed" highlight={qmFinished} />

          <SectionHeader title="Split Times" />
          <Gauge label="60 ft" value={fmt(state.sixtyFootTime)} unit="sec" testId="gauge-60ft" />
          <Gauge label="330 ft" value={fmt(state.threeThirtyTime)} unit="sec" testId="gauge-330ft" />
          <Gauge label="1/8 Mile" value={fmt(state.eighthMileTime)} unit="sec" testId="gauge-eighth" />
          <Gauge label="1000 ft" value={fmt(state.thousandFootTime)} unit="sec" testId="gauge-1000ft" />

          <SectionHeader title="ECU Status" />
          <Gauge label="Boost" value={state.boostPsi} unit="psi" testId="gauge-boost" highlight={state.turboEnabled || state.superchargerEnabled} />
          <Gauge label="Fan" value={state.fanStatus ? "ON" : "OFF"} unit="status" testId="gauge-fan" />
          <Gauge label="Fuel Map" value={state.closedLoopStatus} unit="loop" testId="gauge-cl-status" />
          <Gauge label="Launch" value={state.launchControlActive ? "ON" : "OFF"} unit="ctrl" testId="gauge-launch-ctrl" />
          <Gauge label="Trac Ctrl" value={state.tractionControlActive ? "ON" : "OFF"} unit="status" testId="gauge-tc-status" />
          <Gauge label="Knock Ret" value={state.knockRetardActive} unit="deg" testId="gauge-knock-ret" />
          <Gauge label="Fuel Cut" value={state.fuelCutActive ? "YES" : "NO"} unit="status" testId="gauge-fuel-cut" />
          <Gauge label="Rev Limit" value={state.revLimitActive ? "YES" : "NO"} unit="status" testId="gauge-rev-limit" />
          <Gauge label="S/C Active" value={state.superchargerEnabled ? "ON" : "OFF"} unit="status" testId="gauge-sc-active" highlight={state.superchargerEnabled} />
          <Gauge label="Nitrous" value={state.nitrousActive ? "ON" : "OFF"} unit="status" testId="gauge-nitrous" highlight={state.nitrousActive} />

          <SectionHeader title="Peak Performance" />
          <Gauge label="Peak G" value={state.peakAccelG} unit="g" testId="gauge-peak-g" />
          <Gauge label="Peak WHP" value={state.peakWheelHp} unit="hp" testId="gauge-peak-whp" />

          <div className="col-span-4 h-4" />
        </div>
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

        <Button
          onClick={handleLaunch}
          variant="outline"
          className="w-full mt-2 text-[11px] tracking-[0.2em] uppercase font-mono bg-transparent text-white/90 border-white/30"
          data-testid="button-launch"
        >
          {state.quarterMileActive ? (qmFinished ? `FINISHED ${state.quarterMileET}s — TAP TO RESET` : "RUNNING — TAP TO RESET") : "LAUNCH 1/4 MILE"}
        </Button>
      </div>
    </div>
  );
}
