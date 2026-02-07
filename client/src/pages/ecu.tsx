import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { type EcuConfig, getDefaultEcuConfig } from "@/lib/engineSim";
import { sharedSim } from "@/lib/sharedSim";
import { getAllPresets, savePreset, deletePreset, type Preset } from "@/lib/presets";
import { useAiMode } from "@/lib/aiMode";

type ConfigKey = keyof EcuConfig;

function EditableNumberInput({ value, onCommit, step, min, max, className, testId }: {
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
  testId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setText(String(value));
    }
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
      onChange={(e) => {
        setText(e.target.value);
      }}
      onBlur={() => {
        setEditing(false);
        const parsed = parseFloat(text);
        if (!isNaN(parsed)) {
          let v = parsed;
          if (min !== undefined) v = Math.max(min, v);
          if (max !== undefined) v = Math.min(max, v);
          onCommit(v);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
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
  max?: number;
  testId: string;
}

function ParamRow({ label, configKey, config, onChange, unit, step = 1, min, max, testId }: ParamRowProps) {
  const value = config[configKey];

  if (typeof value === "boolean") {
    return (
      <div className="flex items-center justify-between py-1 px-2 border-b border-white/5" data-testid={testId}>
        <span className="text-[10px] tracking-wide uppercase opacity-80 font-mono flex-1">{label}</span>
        <button
          onClick={() => onChange(configKey, !value)}
          className="text-[11px] font-mono tabular-nums px-2 py-0.5 border border-white/30 bg-transparent text-white min-w-[50px] text-center"
          data-testid={`toggle-${testId}`}
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
              data-testid={`option-${testId}-${opt}`}
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
          data-testid={`dec-${testId}`}
        >
          -
        </button>
        <EditableNumberInput
          value={value as number}
          onCommit={(v) => onChange(configKey, v)}
          step={step}
          min={min}
          max={max}
          className="bg-transparent text-white text-[11px] font-mono tabular-nums w-16 text-center border border-white/25 py-0.5 outline-none focus:border-white/50"
          testId={`input-${testId}`}
        />
        <button
          onClick={() => {
            const newVal = (value as number) + step;
            onChange(configKey, max !== undefined ? Math.min(max, newVal) : newVal);
          }}
          className="text-[11px] font-mono px-1.5 py-0.5 border border-white/25 text-white/70 active:text-white"
          data-testid={`inc-${testId}`}
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
    case "revLimitType": return ["fuel_cut", "ignition_cut", "both"];
    case "tractionControlMode": return ["mild", "moderate", "aggressive"];
    case "o2SensorType": return ["narrowband", "wideband"];
    case "superchargerType": return ["centrifugal", "roots", "twinscrew"];
    case "tireCompound": return ["street", "sport", "semi_slick", "full_slick", "drag_slick"];
    default: return [];
  }
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 pt-4 pb-1 px-2">
      <div className="h-px flex-1 bg-white/20" />
      <span className="text-[9px] tracking-[0.3em] uppercase opacity-60 font-mono whitespace-nowrap">{title}</span>
      <div className="h-px flex-1 bg-white/20" />
    </div>
  );
}

export default function EcuPage() {
  const [config, setConfig] = useState<EcuConfig>(() => sharedSim.getEcuConfig());
  const [presets, setPresets] = useState<Preset[]>(() => getAllPresets());
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [aiMode, toggleAi] = useAiMode();

  const refreshPresets = useCallback(() => {
    setPresets(getAllPresets());
  }, []);

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
    setActivePreset("Stock B16A2");
  }, []);

  const handleLoadPreset = useCallback((preset: Preset) => {
    const newConfig = { ...preset.config };
    setConfig(newConfig);
    sharedSim.setEcuConfig(newConfig);
    setActivePreset(preset.name);
    setSaveMsg(`Loaded: ${preset.name}`);
    setTimeout(() => setSaveMsg(""), 2000);
  }, []);

  const handleSaveToActive = useCallback(() => {
    if (!activePreset) return;
    savePreset(activePreset, config);
    refreshPresets();
    setSaveMsg(`Saved: ${activePreset}`);
    setTimeout(() => setSaveMsg(""), 2000);
  }, [activePreset, config, refreshPresets]);

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
    setSaveMsg(`Deleted: ${name}`);
    setTimeout(() => setSaveMsg(""), 2000);
  }, [refreshPresets, activePreset]);

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col select-none" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/20 gap-2">
        <Link href="/" className="text-[10px] tracking-wider uppercase opacity-70 font-mono" data-testid="link-dashboard">
          GAUGES
        </Link>
        <button
          onClick={toggleAi}
          className={`text-[10px] tracking-wider uppercase font-mono border px-2 py-0.5 ${aiMode ? "border-green-500/60 text-green-400 opacity-100" : "border-white/25 opacity-70"}`}
          data-testid="button-ai-toggle-ecu"
        >
          {aiMode ? "AI ON" : "CODE"}
        </button>
        <span className="text-[10px] tracking-[0.3em] uppercase opacity-80 font-mono">ECU TUNING</span>
        <button
          onClick={handleReset}
          className="text-[10px] tracking-wider uppercase opacity-70 font-mono border border-white/25 px-2 py-0.5"
          data-testid="button-reset-defaults"
        >
          DEFAULTS
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden" data-testid="ecu-scroll-area">

        <SectionHeader title="Presets" />
        <div className="px-2 pb-2" data-testid="presets-section">
          <div className="flex flex-wrap gap-1 mb-2">
            {presets.map((p) => {
              const isActive = activePreset === p.name;
              return (
                <div key={p.name} className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleLoadPreset(p)}
                    className={`text-[9px] font-mono px-2 py-1 border ${isActive ? "border-green-500/60 text-green-400 bg-green-500/10" : "border-white/25 text-white/80"} active:text-white`}
                    data-testid={`preset-load-${p.name.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    {p.name.toUpperCase()}
                  </button>
                  {!p.builtIn && (
                    <button
                      onClick={() => handleDeletePreset(p.name)}
                      className="text-[9px] font-mono px-1 py-1 border border-white/15 text-white/40 active:text-white"
                      data-testid={`preset-delete-${p.name.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      X
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-1">
            {activePreset && (
              <button
                onClick={handleSaveToActive}
                className="text-[9px] font-mono px-2 py-1 border border-green-500/40 text-green-400/80 active:text-green-300 flex-1"
                data-testid="button-save-to-active"
              >
                SAVE TO "{activePreset.toUpperCase()}"
              </button>
            )}
            {showSave ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSavePreset(); }}
                  placeholder="Preset name..."
                  className="bg-transparent text-white text-[10px] font-mono border border-white/30 px-2 py-1 flex-1 outline-none focus:border-white/60"
                  autoFocus
                  data-testid="input-preset-name"
                />
                <button
                  onClick={handleSavePreset}
                  className="text-[9px] font-mono px-2 py-1 border border-white/30 text-white/80"
                  data-testid="button-preset-save-confirm"
                >
                  SAVE
                </button>
                <button
                  onClick={() => { setShowSave(false); setSaveName(""); }}
                  className="text-[9px] font-mono px-2 py-1 border border-white/15 text-white/50"
                  data-testid="button-preset-save-cancel"
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSave(true)}
                className="text-[9px] font-mono px-2 py-1 border border-white/25 text-white/70 active:text-white flex-1"
                data-testid="button-save-preset"
              >
                SAVE AS NEW
              </button>
            )}
          </div>
          {saveMsg && (
            <div className="text-[9px] font-mono text-white/60 mt-1 text-center" data-testid="text-save-msg">
              {saveMsg}
            </div>
          )}
        </div>

        <SectionHeader title="Rev Limits" />
        <ParamRow label="Redline RPM" configKey="redlineRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={3000} max={12000} testId="ecu-redline" />
        <ParamRow label="Fuel Cut RPM" configKey="fuelCutRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={3000} max={12000} testId="ecu-fuel-cut-rpm" />
        <ParamRow label="Rev Limit Type" configKey="revLimitType" config={config} onChange={handleChange} testId="ecu-rev-limit-type" />
        <ParamRow label="Soft Cut RPM" configKey="softCutRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={3000} max={12000} testId="ecu-soft-cut-rpm" />
        <ParamRow label="Soft Cut Retard" configKey="softCutRetard" config={config} onChange={handleChange} unit="deg" step={1} min={0} max={30} testId="ecu-soft-cut-retard" />
        <ParamRow label="Speed Limiter" configKey="speedLimiterMph" config={config} onChange={handleChange} unit="mph" step={5} min={30} max={200} testId="ecu-speed-limiter" />

        <SectionHeader title="VTEC Control" />
        <ParamRow label="VTEC Engage RPM" configKey="vtecEngageRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={2000} max={9000} testId="ecu-vtec-engage" />
        <ParamRow label="VTEC Disengage RPM" configKey="vtecDisengageRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={2000} max={9000} testId="ecu-vtec-disengage" />
        <ParamRow label="Min Oil Pressure" configKey="vtecOilPressureMin" config={config} onChange={handleChange} unit="psi" step={1} min={10} max={60} testId="ecu-vtec-oil-press" />

        <SectionHeader title="Cam Profile" />
        <ParamRow label="Low Cam Intake Lift" configKey="lowCamIntakeLiftMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={5} max={15} testId="ecu-cam-profile-low-intake-lift" />
        <ParamRow label="Low Cam Exhaust Lift" configKey="lowCamExhaustLiftMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={5} max={15} testId="ecu-cam-profile-low-exhaust-lift" />
        <ParamRow label="Low Cam Intake Duration" configKey="lowCamIntakeDuration" config={config} onChange={handleChange} unit="deg" step={2} min={180} max={320} testId="ecu-cam-profile-low-intake-dur" />
        <ParamRow label="Low Cam Exhaust Duration" configKey="lowCamExhaustDuration" config={config} onChange={handleChange} unit="deg" step={2} min={180} max={320} testId="ecu-cam-profile-low-exhaust-dur" />
        <ParamRow label="VTEC Intake Lift" configKey="vtecIntakeLiftMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={5} max={18} testId="ecu-cam-profile-vtec-intake-lift" />
        <ParamRow label="VTEC Exhaust Lift" configKey="vtecExhaustLiftMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={5} max={18} testId="ecu-cam-profile-vtec-exhaust-lift" />
        <ParamRow label="VTEC Intake Duration" configKey="vtecIntakeDuration" config={config} onChange={handleChange} unit="deg" step={2} min={200} max={340} testId="ecu-cam-profile-vtec-intake-dur" />
        <ParamRow label="VTEC Exhaust Duration" configKey="vtecExhaustDuration" config={config} onChange={handleChange} unit="deg" step={2} min={200} max={340} testId="ecu-cam-profile-vtec-exhaust-dur" />

        <SectionHeader title="Fuel Tuning" />
        <ParamRow label="Injector Size" configKey="injectorSizeCc" config={config} onChange={handleChange} unit="cc" step={10} min={100} max={2000} testId="ecu-injector-size" />
        <ParamRow label="Fuel Pressure" configKey="fuelPressurePsi" config={config} onChange={handleChange} unit="psi" step={1} min={20} max={80} testId="ecu-fuel-pressure" />
        <ParamRow label="AFR Target Idle" configKey="targetAfrIdle" config={config} onChange={handleChange} unit="ratio" step={0.1} min={10} max={18} testId="ecu-afr-idle" />
        <ParamRow label="AFR Target Cruise" configKey="targetAfrCruise" config={config} onChange={handleChange} unit="ratio" step={0.1} min={10} max={18} testId="ecu-afr-cruise" />
        <ParamRow label="AFR Target WOT" configKey="targetAfrWot" config={config} onChange={handleChange} unit="ratio" step={0.1} min={10} max={15} testId="ecu-afr-wot" />
        <ParamRow label="AFR Target VTEC" configKey="targetAfrVtec" config={config} onChange={handleChange} unit="ratio" step={0.1} min={10} max={15} testId="ecu-afr-vtec" />
        <ParamRow label="Cranking Fuel PW" configKey="crankingFuelPw" config={config} onChange={handleChange} unit="ms" step={0.5} min={5} max={30} testId="ecu-cranking-pw" />
        <ParamRow label="Warmup Enrich" configKey="warmupEnrichPct" config={config} onChange={handleChange} unit="%" step={1} min={0} max={50} testId="ecu-warmup-enrich" />
        <ParamRow label="Accel Enrich" configKey="accelEnrichPct" config={config} onChange={handleChange} unit="%" step={1} min={0} max={50} testId="ecu-accel-enrich" />
        <ParamRow label="Decel Fuel Cut" configKey="decelFuelCutRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={500} max={3000} testId="ecu-decel-fuel-cut" />
        <ParamRow label="Closed Loop" configKey="closedLoopEnabled" config={config} onChange={handleChange} testId="ecu-closed-loop" />
        <ParamRow label="CL AFR Target" configKey="closedLoopAfrTarget" config={config} onChange={handleChange} unit="ratio" step={0.1} min={12} max={16} testId="ecu-cl-afr" />

        <SectionHeader title="Ignition Tuning" />
        <ParamRow label="Base Timing" configKey="baseTimingDeg" config={config} onChange={handleChange} unit="deg" step={1} min={0} max={30} testId="ecu-base-timing" />
        <ParamRow label="Max Advance" configKey="maxAdvanceDeg" config={config} onChange={handleChange} unit="deg" step={1} min={10} max={60} testId="ecu-max-advance" />
        <ParamRow label="Idle Timing" configKey="idleTimingDeg" config={config} onChange={handleChange} unit="deg" step={1} min={0} max={25} testId="ecu-idle-timing" />
        <ParamRow label="Knock Retard" configKey="knockRetardDeg" config={config} onChange={handleChange} unit="deg" step={1} min={0} max={20} testId="ecu-knock-retard" />
        <ParamRow label="Knock Sensitivity" configKey="knockSensitivity" config={config} onChange={handleChange} unit="0-10" step={1} min={0} max={10} testId="ecu-knock-sens" />
        <ParamRow label="Knock Recovery" configKey="knockRecoveryRate" config={config} onChange={handleChange} unit="deg/s" step={0.5} min={0} max={10} testId="ecu-knock-recovery" />

        <SectionHeader title="Boost / Wastegate" />
        <ParamRow label="Turbo Enabled" configKey="turboEnabled" config={config} onChange={handleChange} testId="ecu-turbo-enabled" />
        <ParamRow label="Wastegate Duty" configKey="wastegateBaseDuty" config={config} onChange={handleChange} unit="%" step={5} min={0} max={100} testId="ecu-wastegate-duty" />
        <ParamRow label="Boost Target" configKey="boostTargetPsi" config={config} onChange={handleChange} unit="psi" step={1} min={1} max={30} testId="ecu-boost-target" />
        <ParamRow label="Boost Cut" configKey="boostCutPsi" config={config} onChange={handleChange} unit="psi" step={1} min={5} max={40} testId="ecu-boost-cut" />
        <ParamRow label="Anti-Lag" configKey="antiLagEnabled" config={config} onChange={handleChange} testId="ecu-anti-lag" />
        <ParamRow label="Anti-Lag Retard" configKey="antiLagRetard" config={config} onChange={handleChange} unit="deg" step={1} min={0} max={40} testId="ecu-anti-lag-retard" />
        <ArrayParamRow label="Boost by Gear" configKey="boostByGear" config={config} onChange={handleChange} unit="psi" step={1} labels={["1st", "2nd", "3rd", "4th", "5th"]} testId="ecu-boost-gear" />

        <SectionHeader title="Supercharger" />
        <ParamRow label="Supercharger Enabled" configKey="superchargerEnabled" config={config} onChange={handleChange} testId="ecu-supercharger-enabled" />
        <ParamRow label="Supercharger Type" configKey="superchargerType" config={config} onChange={handleChange} testId="ecu-supercharger-type" />
        <ParamRow label="Max Boost PSI" configKey="superchargerMaxBoostPsi" config={config} onChange={handleChange} unit="psi" step={0.5} min={1} max={25} testId="ecu-supercharger-max-boost" />
        <ParamRow label="Efficiency" configKey="superchargerEfficiency" config={config} onChange={handleChange} unit="%" step={1} min={30} max={100} testId="ecu-supercharger-efficiency" />

        <SectionHeader title="Nitrous" />
        <ParamRow label="Nitrous Enabled" configKey="nitrousEnabled" config={config} onChange={handleChange} testId="ecu-nitrous-enabled" />
        <ParamRow label="Shot Size" configKey="nitrousHpAdder" config={config} onChange={handleChange} unit="hp" step={25} min={25} max={2000} testId="ecu-nitrous-shot-size" />
        <ParamRow label="Activation RPM" configKey="nitrousActivationRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={1000} max={8000} testId="ecu-nitrous-activation-rpm" />
        <ParamRow label="Full Throttle Only" configKey="nitrousFullThrottleOnly" config={config} onChange={handleChange} testId="ecu-nitrous-fto" />

        <SectionHeader title="Idle Control" />
        <ParamRow label="Target Idle RPM" configKey="targetIdleRpm" config={config} onChange={handleChange} unit="rpm" step={50} min={500} max={1500} testId="ecu-idle-rpm" />
        <ParamRow label="IACV Position" configKey="idleIacvPosition" config={config} onChange={handleChange} unit="%" step={1} min={0} max={100} testId="ecu-iacv" />
        <ParamRow label="Idle Ign Timing" configKey="idleIgnitionTiming" config={config} onChange={handleChange} unit="deg" step={1} min={0} max={25} testId="ecu-idle-ign" />

        <SectionHeader title="Launch Control" />
        <ParamRow label="Launch Control" configKey="launchControlEnabled" config={config} onChange={handleChange} testId="ecu-launch-ctrl" />
        <ParamRow label="Launch RPM" configKey="launchControlRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={2000} max={8000} testId="ecu-launch-rpm" />
        <ParamRow label="Two-Step" configKey="twoStepEnabled" config={config} onChange={handleChange} testId="ecu-two-step" />
        <ParamRow label="Two-Step RPM" configKey="twoStepRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={2000} max={8000} testId="ecu-two-step-rpm" />
        <ParamRow label="Launch Retard" configKey="launchRetardDeg" config={config} onChange={handleChange} unit="deg" step={1} min={0} max={30} testId="ecu-launch-retard" />
        <ParamRow label="Launch Fuel Cut" configKey="launchFuelCutPct" config={config} onChange={handleChange} unit="%" step={5} min={0} max={80} testId="ecu-launch-fuel-cut" />
        <ParamRow label="Flat Foot Shift" configKey="flatFootShiftEnabled" config={config} onChange={handleChange} testId="ecu-ffs" />
        <ParamRow label="FFS Cut Time" configKey="flatFootShiftCutTime" config={config} onChange={handleChange} unit="ms" step={10} min={50} max={500} testId="ecu-ffs-time" />

        <SectionHeader title="Traction Control" />
        <ParamRow label="Traction Control" configKey="tractionControlEnabled" config={config} onChange={handleChange} testId="ecu-tc-enabled" />
        <ParamRow label="Slip Threshold" configKey="tractionSlipThreshold" config={config} onChange={handleChange} unit="%" step={1} min={1} max={30} testId="ecu-tc-slip" />
        <ParamRow label="TC Retard" configKey="tractionRetardDeg" config={config} onChange={handleChange} unit="deg" step={1} min={0} max={30} testId="ecu-tc-retard" />
        <ParamRow label="TC Fuel Cut" configKey="tractionFuelCutPct" config={config} onChange={handleChange} unit="%" step={5} min={0} max={80} testId="ecu-tc-fuel-cut" />
        <ParamRow label="TC Mode" configKey="tractionControlMode" config={config} onChange={handleChange} testId="ecu-tc-mode" />

        <SectionHeader title="Gear Ratios" />
        <ArrayParamRow label="Gear Ratios" configKey="gearRatios" config={config} onChange={handleChange} unit="ratio" step={0.01} labels={["1st", "2nd", "3rd", "4th", "5th"]} testId="ecu-gear-ratios" />
        <ParamRow label="Final Drive" configKey="finalDriveRatio" config={config} onChange={handleChange} unit="ratio" step={0.05} min={2} max={7} testId="ecu-final-drive" />
        <ArrayParamRow label="Per-Gear Rev Limits" configKey="gearRevLimits" config={config} onChange={handleChange} unit="rpm" step={100} labels={["1st", "2nd", "3rd", "4th", "5th"]} testId="ecu-gear-rev-limits" />

        <SectionHeader title="Tire Setup" />
        <ParamRow label="Tire Width" configKey="tireWidthMm" config={config} onChange={handleChange} unit="mm" step={5} min={135} max={345} testId="ecu-tire-width" />
        <ParamRow label="Aspect Ratio" configKey="tireAspectRatio" config={config} onChange={handleChange} unit="%" step={5} min={25} max={80} testId="ecu-tire-aspect" />
        <ParamRow label="Wheel Dia" configKey="tireWheelDiameterIn" config={config} onChange={handleChange} unit="in" step={1} min={13} max={22} testId="ecu-wheel-dia" />
        <ParamRow label="Compound" configKey="tireCompound" config={config} onChange={handleChange} testId="ecu-tire-compound" />
        <ParamRow label="Grip %" configKey="tireGripPct" config={config} onChange={handleChange} unit="%" step={5} min={50} max={150} testId="ecu-tire-grip-pct" />
        <ParamRow label="Temp Sensitivity" configKey="tireTempSensitivity" config={config} onChange={handleChange} unit="x" step={0.1} min={0} max={3} testId="ecu-tire-temp-sens" />

        <SectionHeader title="Vehicle" />
        <ParamRow label="Vehicle Mass" configKey="vehicleMassLb" config={config} onChange={handleChange} unit="lbs" step={10} min={1500} max={5000} testId="ecu-mass" />
        <ParamRow label="Tire Mass" configKey="tireMassLb" config={config} onChange={handleChange} unit="lbs" step={1} min={8} max={40} testId="ecu-tire-mass" />
        <ParamRow label="Drag Coeff" configKey="dragCoefficient" config={config} onChange={handleChange} unit="cd" step={0.01} min={0.1} max={0.8} testId="ecu-drag-coeff" />
        <ParamRow label="Frontal Area" configKey="frontalAreaM2" config={config} onChange={handleChange} unit="m2" step={0.05} min={1} max={4} testId="ecu-frontal-area" />
        <ParamRow label="Rolling Resist" configKey="rollingResistanceCoeff" config={config} onChange={handleChange} unit="coeff" step={0.001} min={0.005} max={0.05} testId="ecu-rolling-resist" />
        <ParamRow label="Drivetrain Loss" configKey="drivetrainLossPct" config={config} onChange={handleChange} unit="%" step={1} min={5} max={30} testId="ecu-dt-loss" />

        <SectionHeader title="Traction Physics" />
        <ParamRow label="Tire Grip" configKey="tireGripCoeff" config={config} onChange={handleChange} unit="coeff" step={0.05} min={0.3} max={1.5} testId="ecu-tire-grip" />
        <ParamRow label="Wheelbase" configKey="wheelbaseM" config={config} onChange={handleChange} unit="m" step={0.01} min={2} max={4} testId="ecu-wheelbase" />
        <ParamRow label="CG Height" configKey="cgHeightM" config={config} onChange={handleChange} unit="m" step={0.01} min={0.2} max={1.0} testId="ecu-cg-height" />
        <ParamRow label="Front Weight" configKey="frontWeightBias" config={config} onChange={handleChange} unit="bias" step={0.01} min={0.3} max={0.7} testId="ecu-front-bias" />
        <ParamRow label="Opt Slip Ratio" configKey="optimalSlipRatio" config={config} onChange={handleChange} unit="ratio" step={0.01} min={0.05} max={0.25} testId="ecu-opt-slip" />
        <ParamRow label="Shift Time" configKey="shiftTimeMs" config={config} onChange={handleChange} unit="ms" step={25} min={50} max={1000} testId="ecu-shift-time" />

        <SectionHeader title="Cooling" />
        <ParamRow label="Fan On Temp" configKey="fanOnTemp" config={config} onChange={handleChange} unit="F" step={5} min={150} max={250} testId="ecu-fan-on" />
        <ParamRow label="Fan Off Temp" configKey="fanOffTemp" config={config} onChange={handleChange} unit="F" step={5} min={140} max={240} testId="ecu-fan-off" />
        <ParamRow label="Overtemp Warning" configKey="overtempWarning" config={config} onChange={handleChange} unit="F" step={5} min={180} max={280} testId="ecu-overtemp-warn" />
        <ParamRow label="Overtemp Enrich" configKey="overtempEnrichPct" config={config} onChange={handleChange} unit="%" step={1} min={0} max={30} testId="ecu-overtemp-enrich" />

        <SectionHeader title="Sensor Calibration" />
        <ParamRow label="MAP Max" configKey="mapSensorMaxKpa" config={config} onChange={handleChange} unit="kPa" step={5} min={50} max={400} testId="ecu-map-max" />
        <ParamRow label="MAP Min" configKey="mapSensorMinKpa" config={config} onChange={handleChange} unit="kPa" step={1} min={0} max={50} testId="ecu-map-min" />
        <ParamRow label="O2 Sensor Type" configKey="o2SensorType" config={config} onChange={handleChange} testId="ecu-o2-type" />
        <ParamRow label="Coolant Offset" configKey="coolantSensorOffset" config={config} onChange={handleChange} unit="F" step={1} min={-20} max={20} testId="ecu-coolant-offset" />

        <SectionHeader title="Engine" />
        <ParamRow label="Compression" configKey="compressionRatio" config={config} onChange={handleChange} unit=":1" step={0.1} min={7} max={15} testId="ecu-compression" />

        <div className="h-6" />
      </div>

      <div className="shrink-0 px-3 py-2 border-t border-white/10 bg-black flex items-center justify-between gap-2">
        <span className="text-[9px] tracking-wider uppercase opacity-30 font-mono">{saveMsg || "CHANGES APPLY IN REAL-TIME"}</span>
        <button
          onClick={handleReset}
          className="text-[9px] tracking-wider uppercase opacity-40 font-mono border border-white/15 px-2 py-0.5"
          data-testid="button-reset-bottom"
        >
          RESET ALL
        </button>
      </div>
    </div>
  );
}
