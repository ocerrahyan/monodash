import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { type EcuConfig, getDefaultEcuConfig } from "@/lib/engineSim";
import { sharedSim } from "@/lib/sharedSim";
import { getAllPresets, savePreset, deletePreset, type Preset } from "@/lib/presets";

type ConfigKey = keyof EcuConfig;

function EditableNumberInput({ value, onCommit, step, min, className, testId }: {
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  className?: string;
  testId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={editing ? text : String(value)}
      onFocus={() => {
        setEditing(true);
        setText(String(value));
        setTimeout(() => inputRef.current?.select(), 0);
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const parsed = parseFloat(text);
        if (!isNaN(parsed)) {
          let v = parsed;
          if (min !== undefined) v = Math.max(min, v);
          onCommit(v);
        }
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      step={step}
      className={className}
      data-testid={testId}
    />
  );
}

interface ParamRowProps {
  label: string;
  configKey: ConfigKey;
  config: EcuConfig;
  onChange: (key: ConfigKey, value: any) => void;
  unit?: string;
  step?: number;
  min?: number;
  testId: string;
}

function ParamRow({ label, configKey, config, onChange, unit, step = 1, min, testId }: ParamRowProps) {
  const value = config[configKey];

  if (typeof value === "boolean") {
    return (
      <div className="flex items-center justify-between py-1 px-2 border-b border-white/5" data-testid={testId}>
        <span className="text-[10px] tracking-wide uppercase opacity-80 font-mono flex-1">{label}</span>
        <button
          onClick={() => onChange(configKey, !value)}
          className="text-[11px] font-mono tabular-nums px-2 py-0.5 border border-white/30 bg-transparent text-white min-w-[50px] text-center"
        >
          {value ? "ON" : "OFF"}
        </button>
        {unit && <span className="text-[8px] opacity-60 font-mono ml-1 w-10 text-right">{unit}</span>}
      </div>
    );
  }

  if (typeof value === "string") {
    const options = getStringOptions(configKey);
    return (
      <div className="flex items-center justify-between py-1 px-2 border-b border-white/5" data-testid={testId}>
        <span className="text-[10px] tracking-wide uppercase opacity-80 font-mono flex-1">{label}</span>
        <div className="flex gap-1">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(configKey, opt)}
              className={`text-[9px] font-mono px-1.5 py-0.5 border ${value === opt ? "border-white/70 text-white" : "border-white/25 text-white/50"}`}
            >
              {opt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1 px-2 border-b border-white/5" data-testid={testId}>
      <span className="text-[10px] tracking-wide uppercase opacity-80 font-mono flex-1">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            const newVal = (value as number) - step;
            onChange(configKey, min !== undefined ? Math.max(min, newVal) : newVal);
          }}
          className="text-[11px] font-mono px-1.5 py-0.5 border border-white/25 text-white/70 active:text-white"
        >
          -
        </button>
        <EditableNumberInput
          value={value as number}
          onCommit={(v) => onChange(configKey, v)}
          step={step}
          min={min}
          className="bg-transparent text-white text-[11px] font-mono tabular-nums w-16 text-center border border-white/25 py-0.5 outline-none focus:border-white/50"
          testId={`input-${testId}`}
        />
        <button
          onClick={() => onChange(configKey, (value as number) + step)}
          className="text-[11px] font-mono px-1.5 py-0.5 border border-white/25 text-white/70 active:text-white"
        >
          +
        </button>
      </div>
      {unit && <span className="text-[8px] opacity-60 font-mono ml-1 w-12 text-right">{unit}</span>}
    </div>
  );
}

interface ArrayParamRowProps {
  label: string;
  configKey: ConfigKey;
  config: EcuConfig;
  onChange: (key: ConfigKey, value: any) => void;
  unit?: string;
  step?: number;
  labels: string[];
  testId: string;
}

function ArrayParamRow({ label, configKey, config, onChange, unit, step = 0.001, labels, testId }: ArrayParamRowProps) {
  const values = config[configKey] as number[];
  return (
    <div className="py-1 px-2 border-b border-white/5" data-testid={testId}>
      <span className="text-[10px] tracking-wide uppercase opacity-80 font-mono block mb-1">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {values.map((v, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-[7px] opacity-60 font-mono">{labels[i] || `${i + 1}`}</span>
            <EditableNumberInput
              value={v}
              onCommit={(newVal) => {
                const newArr = [...values];
                newArr[i] = newVal;
                onChange(configKey, newArr);
              }}
              step={step}
              className="bg-transparent text-white text-[10px] font-mono tabular-nums w-12 text-center border border-white/25 py-0.5 outline-none focus:border-white/50"
              testId={`input-${testId}-${i}`}
            />
            {unit && <span className="text-[7px] opacity-50 font-mono">{unit}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function getStringOptions(key: ConfigKey): string[] {
  switch (key) {
    case "tireCompound": return ["street", "sport", "semi_slick", "full_slick", "drag_slick"];
    case "drivetrainType": return ["FWD", "RWD", "AWD"];
    case "frontDiffType": return ["open", "lsd", "locked"];
    case "rearDiffType": return ["open", "lsd", "locked"];
    case "centerDiffType": return ["open", "viscous", "torsen", "locked"];
    case "brakePadType": return ["stock", "sport", "race", "carbon"];
    default: return [];
  }
}

function SectionHeader({ title, color }: { title: string; color?: string }) {
  const c = color || "white/20";
  return (
    <div className="flex items-center gap-2 pt-4 pb-1 px-2">
      <div className={`h-px flex-1 bg-${c}`} style={{ backgroundColor: color ? `${color}33` : undefined }} />
      <span className="text-[9px] tracking-[0.3em] uppercase opacity-60 font-mono whitespace-nowrap">{title}</span>
      <div className={`h-px flex-1 bg-${c}`} style={{ backgroundColor: color ? `${color}33` : undefined }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLAPSIBLE SECTION  (for organizing large parameter groups)
// ═══════════════════════════════════════════════════════════════════════════
function CollapsibleSection({
  title, children, defaultOpen = true, color,
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; color?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pt-4 pb-1 px-2 w-full"
      >
        <div className="h-px flex-1 bg-white/20" style={color ? { backgroundColor: `${color}33` } : undefined} />
        <span className="text-[9px] tracking-[0.3em] uppercase opacity-60 font-mono whitespace-nowrap">
          {open ? "▼" : "▶"} {title}
        </span>
        <div className="h-px flex-1 bg-white/20" style={color ? { backgroundColor: `${color}33` } : undefined} />
      </button>
      {open && children}
    </div>
  );
}

export default function VehiclePage() {
  const [config, setConfig] = useState<EcuConfig>(() => sharedSim.getEcuConfig());
  const [presets, setPresets] = useState<Preset[]>(() => getAllPresets());
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const refreshPresets = useCallback(() => setPresets(getAllPresets()), []);

  const handleChange = useCallback((key: ConfigKey, value: any) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      sharedSim.setEcuConfig(next);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    const defaults = getDefaultEcuConfig();
    setConfig(defaults);
    sharedSim.setEcuConfig(defaults);
  }, []);

  const handleLoadPreset = useCallback((preset: Preset) => {
    setConfig({ ...preset.config });
    sharedSim.setEcuConfig({ ...preset.config });
    setActivePreset(preset.name);
    setSaveMsg(`Loaded: ${preset.name}`);
    setTimeout(() => setSaveMsg(""), 2000);
  }, []);

  const handleSavePreset = useCallback(() => {
    if (!saveName.trim()) return;
    savePreset(saveName.trim(), config);
    setActivePreset(saveName.trim());
    setSaveName("");
    setShowSave(false);
    refreshPresets();
    setSaveMsg(`Saved: ${saveName.trim()}`);
    setTimeout(() => setSaveMsg(""), 2000);
  }, [saveName, config, refreshPresets]);

  const handleDeletePreset = useCallback((name: string) => {
    deletePreset(name);
    if (activePreset === name) setActivePreset(null);
    refreshPresets();
  }, [refreshPresets, activePreset]);

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col select-none" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* ── TOP NAV ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/20 gap-2">
        <Link href="/" className="text-[10px] tracking-wider uppercase opacity-70 font-mono">GAUGES</Link>
        <Link href="/ecu" className="text-[10px] tracking-wider uppercase opacity-70 font-mono border border-white/25 px-2 py-0.5">ECU</Link>
        <span className="text-[10px] tracking-[0.3em] uppercase opacity-80 font-mono text-orange-400">VEHICLE</span>
        <button onClick={handleReset} className="text-[10px] tracking-wider uppercase opacity-70 font-mono border border-white/25 px-2 py-0.5">DEFAULTS</button>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">

        {/* ── PRESETS ── */}
        <CollapsibleSection title="Presets" defaultOpen={false}>
          <div className="px-2 pb-2">
            <div className="flex flex-wrap gap-1 mb-2">
              {presets.map((p) => (
                <div key={p.name} className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleLoadPreset(p)}
                    className={`text-[9px] font-mono px-2 py-1 border ${activePreset === p.name ? "border-orange-500/60 text-orange-400 bg-orange-500/10" : "border-white/25 text-white/80"}`}
                  >
                    {p.name.toUpperCase()}
                  </button>
                  {!p.builtIn && (
                    <button onClick={() => handleDeletePreset(p.name)} className="text-[9px] font-mono px-1 py-1 border border-white/15 text-white/40">X</button>
                  )}
                </div>
              ))}
            </div>
            {showSave ? (
              <div className="flex items-center gap-1">
                <input
                  type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); }}
                  placeholder="Preset name..."
                  className="bg-transparent text-white text-[10px] font-mono border border-white/30 px-2 py-1 flex-1 outline-none"
                  autoFocus
                />
                <button onClick={handleSavePreset} className="text-[9px] font-mono px-2 py-1 border border-white/30 text-white/80">SAVE</button>
                <button onClick={() => { setShowSave(false); setSaveName(""); }} className="text-[9px] font-mono px-2 py-1 border border-white/15 text-white/50">CANCEL</button>
              </div>
            ) : (
              <button onClick={() => setShowSave(true)} className="text-[9px] font-mono px-2 py-1 border border-white/25 text-white/70 w-full">SAVE AS NEW</button>
            )}
            {saveMsg && <div className="text-[9px] font-mono text-white/60 mt-1 text-center">{saveMsg}</div>}
          </div>
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── DRIVETRAIN LAYOUT ─────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Drivetrain Layout" color="#f97316">
          <ParamRow label="Drive Type" configKey="drivetrainType" config={config} onChange={handleChange} testId="veh-drivetrain-type" />
          <ParamRow label="Front Diff Type" configKey="frontDiffType" config={config} onChange={handleChange} testId="veh-front-diff" />
          {(config.drivetrainType === 'RWD' || config.drivetrainType === 'AWD') && (
            <ParamRow label="Rear Diff Type" configKey="rearDiffType" config={config} onChange={handleChange} testId="veh-rear-diff" />
          )}
          {config.drivetrainType === 'AWD' && (
            <>
              <ParamRow label="Center Diff Type" configKey="centerDiffType" config={config} onChange={handleChange} testId="veh-center-diff" />
              <ParamRow label="AWD Front Bias" configKey="awdFrontBias" config={config} onChange={handleChange} unit="ratio" step={0.05} min={0.1} testId="veh-awd-bias" />
            </>
          )}
          <ParamRow label="Drivetrain Loss" configKey="drivetrainLossPct" config={config} onChange={handleChange} unit="%" step={1} min={5} testId="veh-dt-loss" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── GEAR RATIOS ──────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Gear Ratios (S4C 5-Speed)" color="#f97316">
          <ArrayParamRow label="Gear Ratios" configKey="gearRatios" config={config} onChange={handleChange} unit="ratio" step={0.01} labels={["1st", "2nd", "3rd", "4th", "5th"]} testId="veh-gear-ratios" />
          <ParamRow label="Final Drive" configKey="finalDriveRatio" config={config} onChange={handleChange} unit="ratio" step={0.05} min={2} testId="veh-final-drive" />
          <ArrayParamRow label="Per-Gear Rev Limits" configKey="gearRevLimits" config={config} onChange={handleChange} unit="rpm" step={100} labels={["1st", "2nd", "3rd", "4th", "5th"]} testId="veh-gear-rev-limits" />
          <ParamRow label="Shift Time" configKey="shiftTimeMs" config={config} onChange={handleChange} unit="ms" step={25} min={50} testId="veh-shift-time" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── CLUTCH ───────────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Clutch (Exedy OEM)" color="#f97316">
          <ParamRow label="Max Torque" configKey="clutchMaxTorqueNm" config={config} onChange={handleChange} unit="Nm" step={10} min={100} testId="veh-clutch-torque" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── TIRES & WHEELS ───────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Tires & Wheels (195/55R15)" color="#22c55e">
          <ParamRow label="Tire Width" configKey="tireWidthMm" config={config} onChange={handleChange} unit="mm" step={5} min={135} testId="veh-tire-width" />
          <ParamRow label="Aspect Ratio" configKey="tireAspectRatio" config={config} onChange={handleChange} unit="%" step={5} min={25} testId="veh-tire-aspect" />
          <ParamRow label="Wheel Diameter" configKey="tireWheelDiameterIn" config={config} onChange={handleChange} unit="in" step={1} min={13} testId="veh-wheel-dia" />
          <ParamRow label="Compound" configKey="tireCompound" config={config} onChange={handleChange} testId="veh-tire-compound" />
          <ParamRow label="Grip %" configKey="tireGripPct" config={config} onChange={handleChange} unit="%" step={5} min={50} testId="veh-tire-grip-pct" />
          <ParamRow label="Temp Sensitivity" configKey="tireTempSensitivity" config={config} onChange={handleChange} unit="x" step={0.1} min={0} testId="veh-tire-temp-sens" />
          <ParamRow label="Tire Mass" configKey="tireMassLb" config={config} onChange={handleChange} unit="lbs" step={1} min={8} testId="veh-tire-mass" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── TRACTION PHYSICS ─────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Traction Physics" color="#22c55e">
          <ParamRow label="Tire Grip Coeff" configKey="tireGripCoeff" config={config} onChange={handleChange} unit="μ" step={0.05} min={0.3} testId="veh-tire-grip" />
          <ParamRow label="Optimal Slip Ratio" configKey="optimalSlipRatio" config={config} onChange={handleChange} unit="ratio" step={0.01} min={0.05} testId="veh-opt-slip" />
          <ParamRow label="Front Weight Bias" configKey="frontWeightBias" config={config} onChange={handleChange} unit="bias" step={0.01} min={0.3} testId="veh-front-bias" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── CHASSIS & BODY ───────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Chassis & Body (EK4/EM1)" color="#3b82f6">
          <ParamRow label="Vehicle Mass" configKey="vehicleMassLb" config={config} onChange={handleChange} unit="lbs" step={10} min={1500} testId="veh-mass" />
          <ParamRow label="Wheelbase" configKey="wheelbaseM" config={config} onChange={handleChange} unit="m" step={0.01} min={2} testId="veh-wheelbase" />
          <ParamRow label="CG Height" configKey="cgHeightM" config={config} onChange={handleChange} unit="m" step={0.01} min={0.2} testId="veh-cg-height" />
          <ParamRow label="Drag Coefficient" configKey="dragCoefficient" config={config} onChange={handleChange} unit="Cd" step={0.01} min={0.1} testId="veh-drag-coeff" />
          <ParamRow label="Frontal Area" configKey="frontalAreaM2" config={config} onChange={handleChange} unit="m²" step={0.05} min={1} testId="veh-frontal-area" />
          <ParamRow label="Rolling Resistance" configKey="rollingResistanceCoeff" config={config} onChange={handleChange} unit="Crr" step={0.001} min={0.005} testId="veh-rolling-resist" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── ENGINE INTERNALS ─────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Engine (B16A2 DOHC VTEC)" color="#ef4444">
          <ParamRow label="Compression Ratio" configKey="compressionRatio" config={config} onChange={handleChange} unit=":1" step={0.1} min={7} testId="veh-compression" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── WEATHER / ENVIRONMENT ────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Weather / Environment" color="#06b6d4">
          <ParamRow label="Ambient Temperature" configKey="ambientTempF" config={config} onChange={handleChange} unit="°F" step={5} min={-20} testId="veh-ambient-temp" />
          <ParamRow label="Humidity" configKey="humidityPct" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="veh-humidity" />
          <ParamRow label="Altitude" configKey="altitudeFt" config={config} onChange={handleChange} unit="ft" step={500} min={0} testId="veh-altitude" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── SUSPENSION GEOMETRY ───────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Suspension Geometry (McPherson / Trailing)" color="#a855f7">
          <ParamRow label="Front Camber" configKey="frontCamberDeg" config={config} onChange={handleChange} unit="°" step={0.25} testId="veh-front-camber" />
          <ParamRow label="Rear Camber" configKey="rearCamberDeg" config={config} onChange={handleChange} unit="°" step={0.25} testId="veh-rear-camber" />
          <ParamRow label="Front Toe" configKey="frontToeDeg" config={config} onChange={handleChange} unit="°" step={0.05} testId="veh-front-toe" />
          <ParamRow label="Rear Toe" configKey="rearToeDeg" config={config} onChange={handleChange} unit="°" step={0.05} testId="veh-rear-toe" />
          <ParamRow label="Front Caster" configKey="frontCasterDeg" config={config} onChange={handleChange} unit="°" step={0.25} min={0} testId="veh-caster" />
          <ParamRow label="KPI" configKey="frontKPIDeg" config={config} onChange={handleChange} unit="°" step={0.5} min={8} testId="veh-kpi" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── SPRINGS ──────────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Springs (Coilover / Stock)" color="#a855f7">
          <ParamRow label="Front Spring Rate" configKey="frontSpringRateKgmm" config={config} onChange={handleChange} unit="kg/mm" step={0.5} min={1} testId="veh-front-spring" />
          <ParamRow label="Rear Spring Rate" configKey="rearSpringRateKgmm" config={config} onChange={handleChange} unit="kg/mm" step={0.5} min={1} testId="veh-rear-spring" />
          <ParamRow label="Front Ride Height" configKey="frontRideHeightMm" config={config} onChange={handleChange} unit="mm" step={5} min={200} testId="veh-front-ride-h" />
          <ParamRow label="Rear Ride Height" configKey="rearRideHeightMm" config={config} onChange={handleChange} unit="mm" step={5} min={200} testId="veh-rear-ride-h" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── DAMPERS ──────────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Dampers (Adjustable)" color="#a855f7">
          <ParamRow label="Front Bump" configKey="frontDamperBump" config={config} onChange={handleChange} unit="clicks" step={1} min={1} testId="veh-front-damp-bump" />
          <ParamRow label="Front Rebound" configKey="frontDamperRebound" config={config} onChange={handleChange} unit="clicks" step={1} min={1} testId="veh-front-damp-rebound" />
          <ParamRow label="Rear Bump" configKey="rearDamperBump" config={config} onChange={handleChange} unit="clicks" step={1} min={1} testId="veh-rear-damp-bump" />
          <ParamRow label="Rear Rebound" configKey="rearDamperRebound" config={config} onChange={handleChange} unit="clicks" step={1} min={1} testId="veh-rear-damp-rebound" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── ANTI-ROLL BARS ───────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Anti-Roll / Sway Bars" color="#a855f7">
          <ParamRow label="Front Sway Bar" configKey="frontSwayBarEnabled" config={config} onChange={handleChange} testId="veh-front-sway-en" />
          <ParamRow label="Front Diameter" configKey="frontSwayBarDiaMm" config={config} onChange={handleChange} unit="mm" step={1} min={15} testId="veh-front-sway-dia" />
          <ParamRow label="Rear Sway Bar" configKey="rearSwayBarEnabled" config={config} onChange={handleChange} testId="veh-rear-sway-en" />
          <ParamRow label="Rear Diameter" configKey="rearSwayBarDiaMm" config={config} onChange={handleChange} unit="mm" step={1} min={10} testId="veh-rear-sway-dia" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── BRAKES ───────────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Brakes (OEM: 262mm F / 239mm R)" color="#ef4444">
          <ParamRow label="Brake Bias Front" configKey="brakeBiasFront" config={config} onChange={handleChange} unit="ratio" step={0.02} min={0.4} testId="veh-brake-bias" />
          <ParamRow label="Front Rotor Dia" configKey="frontRotorDiaMm" config={config} onChange={handleChange} unit="mm" step={10} min={200} testId="veh-front-rotor" />
          <ParamRow label="Rear Rotor Dia" configKey="rearRotorDiaMm" config={config} onChange={handleChange} unit="mm" step={10} min={180} testId="veh-rear-rotor" />
          <ParamRow label="Pad Type" configKey="brakePadType" config={config} onChange={handleChange} testId="veh-brake-pad" />
          <ParamRow label="ABS Enabled" configKey="absEnabled" config={config} onChange={handleChange} testId="veh-abs" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── AERO ─────────────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Aerodynamics" color="#3b82f6" defaultOpen={false}>
          <ParamRow label="Rear Wing" configKey="rearWingEnabled" config={config} onChange={handleChange} testId="veh-rear-wing-en" />
          {config.rearWingEnabled && (
            <ParamRow label="Wing Angle" configKey="rearWingAngleDeg" config={config} onChange={handleChange} unit="°" step={1} min={0} testId="veh-wing-angle" />
          )}
          <ParamRow label="Front Splitter" configKey="frontSplitterEnabled" config={config} onChange={handleChange} testId="veh-splitter-en" />
          <ParamRow label="Front Downforce Cl" configKey="downforceCoefficientFront" config={config} onChange={handleChange} unit="Cl" step={0.01} min={0} testId="veh-df-front" />
          <ParamRow label="Rear Downforce Cl" configKey="downforceCoefficientRear" config={config} onChange={handleChange} unit="Cl" step={0.01} min={0} testId="veh-df-rear" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── WEIGHT DISTRIBUTION ──────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Weight Distribution" color="#3b82f6" defaultOpen={false}>
          <ParamRow label="Ballast" configKey="ballastKg" config={config} onChange={handleChange} unit="kg" step={5} min={0} testId="veh-ballast" />
          <ParamRow label="Ballast Position" configKey="ballastPositionPct" config={config} onChange={handleChange} unit="F→R" step={0.1} min={0} testId="veh-ballast-pos" />
          <ParamRow label="Driver Weight" configKey="driverWeightKg" config={config} onChange={handleChange} unit="kg" step={5} min={40} testId="veh-driver-weight" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── STEERING ─────────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Steering (Honda EK Rack)" color="#3b82f6" defaultOpen={false}>
          <ParamRow label="Steering Ratio" configKey="steeringRatio" config={config} onChange={handleChange} unit=":1" step={0.5} min={10} testId="veh-steer-ratio" />
          <ParamRow label="Max Lock Angle" configKey="steeringLockDeg" config={config} onChange={handleChange} unit="°" step={1} min={20} testId="veh-steer-lock" />
          <ParamRow label="Power Steering" configKey="powerSteeringEnabled" config={config} onChange={handleChange} testId="veh-power-steer" />
        </CollapsibleSection>

        <div className="h-6" />
      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="shrink-0 px-3 py-2 border-t border-white/10 bg-black flex items-center justify-between gap-2">
        <span className="text-[9px] tracking-wider uppercase opacity-30 font-mono">{saveMsg || "VEHICLE & DRIVETRAIN CONFIG"}</span>
        <button onClick={handleReset} className="text-[9px] tracking-wider uppercase opacity-40 font-mono border border-white/15 px-2 py-0.5">RESET ALL</button>
      </div>
    </div>
  );
}
