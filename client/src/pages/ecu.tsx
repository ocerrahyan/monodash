import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { type EcuConfig, getDefaultEcuConfig } from "@/lib/engineSim";
import { sharedSim } from "@/lib/sharedSim";
import { getAllPresets, savePreset, deletePreset, type Preset, configToShareUrl, exportConfigToFile, importConfigFromFile, pushUndo, undo, redo, canUndo, canRedo, configFromShareUrl } from "@/lib/presets";
import { useAiMode } from "@/lib/aiMode";
import { log } from '@shared/logger';
import { logConfigChange, logPresetLoad, logButtonPress, logFullConfig, logPageNav } from '@/lib/actionLogger';
import { useTheme, useThemeMode, THEME_ICONS } from '@/lib/theme';

type ConfigKey = keyof EcuConfig;

function EditableNumberInput({ value, onCommit, step, min, className, testId, style }: {
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  className?: string;
  testId?: string;
  style?: React.CSSProperties;
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
      style={style}
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
  const t = useTheme();

  if (typeof value === "boolean") {
    return (
      <div className="flex items-center justify-between py-1 px-2" style={{ borderBottom: `1px solid ${t.borderFaint}` }} data-testid={testId}>
        <span className="text-[10px] tracking-wide uppercase font-mono flex-1" style={{ color: t.textMuted }}>{label}</span>
        <button
          onClick={() => onChange(configKey, !value)}
          className="text-[11px] font-mono tabular-nums px-2 py-0.5 min-w-[50px] text-center"
          style={{ border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText }}
          data-testid={`toggle-${testId}`}
        >
          {value ? "ON" : "OFF"}
        </button>
        {unit && <span className="text-[8px] font-mono ml-1 w-10 text-right" style={{ color: t.textDim }}>{unit}</span>}
      </div>
    );
  }

  if (typeof value === "string") {
    const options = getStringOptions(configKey);
    return (
      <div className="flex items-center justify-between py-1 px-2" style={{ borderBottom: `1px solid ${t.borderFaint}` }} data-testid={testId}>
        <span className="text-[10px] tracking-wide uppercase font-mono flex-1" style={{ color: t.textMuted }}>{label}</span>
        <div className="flex gap-1">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(configKey, opt)}
              className="text-[9px] font-mono px-1.5 py-0.5"
              style={{ border: `1px solid ${value === opt ? t.activeBorder : t.inactiveBorder}`, color: value === opt ? t.activeText : t.inactiveText }}
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
    <div className="flex items-center justify-between py-1 px-2" style={{ borderBottom: `1px solid ${t.borderFaint}` }} data-testid={testId}>
      <span className="text-[10px] tracking-wide uppercase font-mono flex-1" style={{ color: t.textMuted }}>{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            const newVal = (value as number) - step;
            onChange(configKey, min !== undefined ? Math.max(min, newVal) : newVal);
          }}
          className="text-[11px] font-mono px-1.5 py-0.5"
          style={{ border: `1px solid ${t.inputBorder}`, color: t.textDim }}
          data-testid={`dec-${testId}`}
        >
          -
        </button>
        <EditableNumberInput
          value={value as number}
          onCommit={(v) => onChange(configKey, v)}
          step={step}
          min={min}
          className="text-[11px] font-mono tabular-nums w-16 text-center py-0.5 outline-none"
          style={{ background: t.inputBg, color: t.inputText, border: `1px solid ${t.inputBorder}` }}
          testId={`input-${testId}`}
        />
        <button
          onClick={() => {
            const newVal = (value as number) + step;
            onChange(configKey, newVal);
          }}
          className="text-[11px] font-mono px-1.5 py-0.5"
          style={{ border: `1px solid ${t.inputBorder}`, color: t.textDim }}
          data-testid={`inc-${testId}`}
        >
          +
        </button>
      </div>
      {unit && <span className="text-[8px] font-mono ml-1 w-12 text-right" style={{ color: t.textDim }}>{unit}</span>}
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
  const t = useTheme();
  return (
    <div className="py-1 px-2" style={{ borderBottom: `1px solid ${t.borderFaint}` }} data-testid={testId}>
      <span className="text-[10px] tracking-wide uppercase font-mono block mb-1" style={{ color: t.textMuted }}>{label}</span>
      <div className="flex gap-1 flex-wrap">
        {values.map((v, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-[7px] font-mono" style={{ color: t.textDim }}>{labels[i] || `${i + 1}`}</span>
            <EditableNumberInput
              value={v}
              onCommit={(newVal) => {
                const newArr = [...values];
                newArr[i] = newVal;
                onChange(configKey, newArr);
              }}
              step={step}
              className="text-[10px] font-mono tabular-nums w-12 text-center py-0.5 outline-none"
              style={{ background: t.inputBg, color: t.inputText, border: `1px solid ${t.inputBorder}` }}
              testId={`input-${testId}-${i}`}
            />
            {unit && <span className="text-[7px] font-mono" style={{ color: t.textDim }}>{unit}</span>}
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
    case "fuelType": return ["gasoline", "e85", "methanol", "flex"];
    case "drivetrainType": return ["FWD", "RWD", "AWD"];
    case "frontDiffType": return ["open", "lsd", "locked"];
    case "rearDiffType": return ["open", "lsd", "locked"];
    case "centerDiffType": return ["open", "viscous", "torsen", "locked"];
    case "ignitionCutType": return ["hard", "soft"];
    case "auxOutput1Function": return ["vtec", "fan", "boost", "nitrous", "shift_light", "off"];
    case "auxOutput2Function": return ["vtec", "fan", "boost", "nitrous", "shift_light", "off"];
    case "canBusBaudRate": return ["250", "500", "1000"];
    case "ecuType": return ["oem_p28", "oem_p72", "hondata_s300", "hondata_kpro", "haltech_elite", "aem_infinity", "megasquirt", "motec_m1"];
    case "tpsType": return ["potentiometer", "hall_effect", "dual_redundant"];
    case "mapSensorType": return ["1bar", "2bar", "3bar", "4bar", "5bar"];
    case "iatSensorType": return ["oem_thermistor", "gm_open_element", "bosch"];
    case "ectSensorType": return ["oem_thermistor", "aftermarket"];
    case "crankSensorType": return ["oem_24tooth", "aftermarket_36minus1", "60minus2", "12tooth"];
    case "camSensorType": return ["oem_1pulse", "aftermarket_4pulse"];
    case "knockSensorType": return ["piezo_flat", "piezo_donut", "wideband_knock"];
    case "throttleResponseCurve": return ["linear", "progressive", "aggressive", "eco"];
    case "injectorType": return ["port_low_impedance", "port_high_impedance", "direct"];
    case "fuelRailType": return ["oem", "high_flow", "dual_feed"];
    case "fuelPumpType": return ["oem_in_tank", "walbro_255", "dw300", "external_surge"];
    case "turboInletFlange": return ["T25", "T3", "T4", "T6", "V_band"];
    case "turboExitFlange": return ["T25", "T3", "V_band", "3inch"];
    case "turboWastegateType": return ["internal", "external_38mm", "external_44mm", "external_60mm"];
    case "turboBearingType": return ["journal", "ball_bearing", "ceramic_ball"];
    case "blowOffValveType": return ["none", "recirculating", "atmosphere", "dual_port"];
    case "boostControllerType": return ["none", "manual_mbc", "electronic_solenoid", "eboost2"];
    case "intercoolerType": return ["none", "fmic", "tmic", "water_air"];
    case "shiftLightColor": return ["red", "blue", "green", "amber"];
    case "fuelMapInterpolation": return ["bilinear", "bicubic"];
    case "ignMapInterpolation": return ["bilinear", "bicubic"];
    case "fuelMapUnits": return ["ms", "multiplier", "lambda"];
    default: return [];
  }
}

function SectionHeader({ title }: { title: string }) {
  const t = useTheme();
  return (
    <div className="flex items-center gap-2 pt-4 pb-1 px-2">
      <div className="h-px flex-1" style={{ background: t.border }} />
      <span className="text-[9px] tracking-[0.3em] uppercase font-mono whitespace-nowrap" style={{ color: t.textDim }}>{title}</span>
      <div className="h-px flex-1" style={{ background: t.border }} />
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
  const [shareMsg, setShareMsg] = useState("");
  const t = useTheme();
  const [themeMode, cycleTheme] = useThemeMode();

  // Load config from share URL on mount
  useEffect(() => {
    const shared = configFromShareUrl();
    if (shared) {
      setConfig(shared);
      sharedSim.setEcuConfig(shared);
      setSaveMsg("Loaded shared config from URL");
      setTimeout(() => setSaveMsg(""), 3000);
    }
    pushUndo(sharedSim.getEcuConfig());
  }, []);

  const refreshPresets = useCallback(() => {
    setPresets(getAllPresets());
  }, []);

  // Log page navigation
  useEffect(() => {
    logPageNav('ecu');
  }, []);

  const handleChange = useCallback((key: ConfigKey, value: any) => {
    setConfig((prev) => {
      logConfigChange(key, prev[key], value, 'ecu');
      const next = { ...prev, [key]: value };
      if (key === "boostTargetPsi") {
        next.boostByGear = next.boostByGear.map(() => value as number);
      }
      sharedSim.setEcuConfig(next);
      pushUndo(next);
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev) { setConfig(prev); sharedSim.setEcuConfig(prev); }
  }, []);
  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) { setConfig(next); sharedSim.setEcuConfig(next); }
  }, []);
  const handleShare = useCallback(() => {
    const url = configToShareUrl(config);
    navigator.clipboard.writeText(url).then(() => {
      setShareMsg("URL copied!");
      setTimeout(() => setShareMsg(""), 2000);
    }).catch(() => {
      setShareMsg("Copy failed");
      setTimeout(() => setShareMsg(""), 2000);
    });
  }, [config]);
  const handleExport = useCallback(() => {
    exportConfigToFile(config, activePreset || 'ecu-config');
  }, [config, activePreset]);
  const handleImport = useCallback(async () => {
    const imported = await importConfigFromFile();
    if (imported) {
      setConfig(imported);
      sharedSim.setEcuConfig(imported);
      pushUndo(imported);
      setSaveMsg("Config imported");
      setTimeout(() => setSaveMsg(""), 2000);
    }
  }, []);

  const handleReset = useCallback(() => {
    const defaults = getDefaultEcuConfig();
    logButtonPress('RESET TO DEFAULTS (ECU)');
    logFullConfig(defaults as unknown as Record<string, unknown>, 'Reset ECU to factory defaults');
    setConfig(defaults);
    sharedSim.setEcuConfig(defaults);
    setActivePreset("Stock B16A2");
  }, []);

  const handleLoadPreset = useCallback((preset: Preset) => {
    logPresetLoad(preset.name, preset.config as unknown as Record<string, unknown>);
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
    <div className="fixed inset-0 flex flex-col select-none" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: t.bg, color: t.text }}>
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b gap-2" style={{ borderColor: t.border }}>
        <Link href="/" className="text-[10px] tracking-wider uppercase font-mono" style={{ color: t.textDim }} data-testid="link-dashboard">
          GAUGES
        </Link>
        <Link href="/vehicle" className="text-[10px] tracking-wider uppercase font-mono border border-orange-500/40 text-orange-400/80 px-2 py-0.5" data-testid="link-vehicle">
          VEHICLE
        </Link>
        <button
          onClick={toggleAi}
          className={`text-[10px] tracking-wider uppercase font-mono border px-2 py-0.5 ${aiMode ? "border-green-500/60 text-green-400 opacity-100" : ""}`}
          style={aiMode ? undefined : { borderColor: t.inputBorder, color: t.textDim }}
          data-testid="button-ai-toggle-ecu"
        >
          {aiMode ? "AI ON" : "CODE"}
        </button>
        <span className="text-[10px] tracking-[0.3em] uppercase font-mono text-green-400" style={{ opacity: 0.8 }}>ECU TUNING</span>
        <div className="flex items-center gap-1">
          <button onClick={handleUndo} disabled={!canUndo()} className="text-[10px] font-mono border px-1.5 py-0.5 hover:opacity-100 disabled:opacity-20" style={{ borderColor: t.borderFaint, color: t.textDim }} title="Undo (Ctrl+Z)">↩</button>
          <button onClick={handleRedo} disabled={!canRedo()} className="text-[10px] font-mono border px-1.5 py-0.5 hover:opacity-100 disabled:opacity-20" style={{ borderColor: t.borderFaint, color: t.textDim }} title="Redo (Ctrl+Y)">↪</button>
          <button onClick={handleShare} className="text-[10px] font-mono border border-cyan-500/30 text-cyan-400/80 px-1.5 py-0.5" title="Copy share URL">🔗</button>
          <button onClick={handleExport} className="text-[10px] font-mono border px-1.5 py-0.5 hover:opacity-100" style={{ borderColor: t.borderFaint, color: t.textDim }} title="Export JSON">⬇</button>
          <button onClick={handleImport} className="text-[10px] font-mono border px-1.5 py-0.5 hover:opacity-100" style={{ borderColor: t.borderFaint, color: t.textDim }} title="Import JSON">⬆</button>
        </div>
        {shareMsg && <span className="text-[9px] font-mono text-cyan-400 animate-pulse">{shareMsg}</span>}
        <button onClick={cycleTheme} className="text-[10px] font-mono border px-2 py-0.5" style={{ borderColor: t.inputBorder, color: t.textDim }} title="Toggle theme">{THEME_ICONS[themeMode]}</button>
        <button
          onClick={handleReset}
          className="text-[10px] tracking-wider uppercase font-mono border px-2 py-0.5"
          style={{ borderColor: t.inputBorder, color: t.textDim }}
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
                    className={`text-[9px] font-mono px-2 py-1 border ${isActive ? "border-green-500/60 text-green-400 bg-green-500/10" : ""} active:text-white`}
                    style={isActive ? undefined : { borderColor: t.inputBorder, color: t.textMuted }}
                    data-testid={`preset-load-${p.name.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    {p.name.toUpperCase()}
                  </button>
                  {!p.builtIn && (
                    <button
                      onClick={() => handleDeletePreset(p.name)}
                      className="text-[9px] font-mono px-1 py-1 border"
                      style={{ borderColor: t.borderFaint, color: t.textDim }}
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
                  className="text-[10px] font-mono border px-2 py-1 flex-1 outline-none"
                  style={{ background: t.inputBg, color: t.inputText, borderColor: t.inputBorder }}
                  autoFocus
                  data-testid="input-preset-name"
                />
                <button
                  onClick={handleSavePreset}
                  className="text-[9px] font-mono px-2 py-1 border"
                  style={{ borderColor: t.inputBorder, color: t.textMuted }}
                  data-testid="button-preset-save-confirm"
                >
                  SAVE
                </button>
                <button
                  onClick={() => { setShowSave(false); setSaveName(""); }}
                  className="text-[9px] font-mono px-2 py-1 border"
                  style={{ borderColor: t.borderFaint, color: t.textDim }}
                  data-testid="button-preset-save-cancel"
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSave(true)}
                className="text-[9px] font-mono px-2 py-1 border flex-1"
                style={{ borderColor: t.inputBorder, color: t.textDim }}
                data-testid="button-save-preset"
              >
                SAVE AS NEW
              </button>
            )}
          </div>
          {saveMsg && (
            <div className="text-[9px] font-mono mt-1 text-center" style={{ color: t.textDim }} data-testid="text-save-msg">
              {saveMsg}
            </div>
          )}
        </div>

        <SectionHeader title="Rev Limits" />
        <ParamRow label="Redline RPM" configKey="redlineRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={3000} testId="ecu-redline" />
        <ParamRow label="Fuel Cut RPM" configKey="fuelCutRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={3000} testId="ecu-fuel-cut-rpm" />
        <ParamRow label="Rev Limit Type" configKey="revLimitType" config={config} onChange={handleChange} testId="ecu-rev-limit-type" />
        <ParamRow label="Soft Cut RPM" configKey="softCutRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={3000} testId="ecu-soft-cut-rpm" />
        <ParamRow label="Soft Cut Retard" configKey="softCutRetard" config={config} onChange={handleChange} unit="deg" step={1} min={0} testId="ecu-soft-cut-retard" />
        <ParamRow label="Speed Limiter" configKey="speedLimiterMph" config={config} onChange={handleChange} unit="mph" step={5} min={30} testId="ecu-speed-limiter" />

        <SectionHeader title="VTEC Control" />
        <ParamRow label="VTEC Engage RPM" configKey="vtecEngageRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={2000} testId="ecu-vtec-engage" />
        <ParamRow label="VTEC Disengage RPM" configKey="vtecDisengageRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={2000} testId="ecu-vtec-disengage" />
        <ParamRow label="Min Oil Pressure" configKey="vtecOilPressureMin" config={config} onChange={handleChange} unit="psi" step={1} min={10} testId="ecu-vtec-oil-press" />

        <SectionHeader title="Cam Profile" />
        <ParamRow label="Low Cam Intake Lift" configKey="lowCamIntakeLiftMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={5} testId="ecu-cam-profile-low-intake-lift" />
        <ParamRow label="Low Cam Exhaust Lift" configKey="lowCamExhaustLiftMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={5} testId="ecu-cam-profile-low-exhaust-lift" />
        <ParamRow label="Low Cam Intake Duration" configKey="lowCamIntakeDuration" config={config} onChange={handleChange} unit="deg" step={2} min={180} testId="ecu-cam-profile-low-intake-dur" />
        <ParamRow label="Low Cam Exhaust Duration" configKey="lowCamExhaustDuration" config={config} onChange={handleChange} unit="deg" step={2} min={180} testId="ecu-cam-profile-low-exhaust-dur" />
        <ParamRow label="VTEC Intake Lift" configKey="vtecIntakeLiftMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={5} testId="ecu-cam-profile-vtec-intake-lift" />
        <ParamRow label="VTEC Exhaust Lift" configKey="vtecExhaustLiftMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={5} testId="ecu-cam-profile-vtec-exhaust-lift" />
        <ParamRow label="VTEC Intake Duration" configKey="vtecIntakeDuration" config={config} onChange={handleChange} unit="deg" step={2} min={200} testId="ecu-cam-profile-vtec-intake-dur" />
        <ParamRow label="VTEC Exhaust Duration" configKey="vtecExhaustDuration" config={config} onChange={handleChange} unit="deg" step={2} min={200} testId="ecu-cam-profile-vtec-exhaust-dur" />

        <SectionHeader title="Fuel Tuning" />
        <ParamRow label="Fuel Type" configKey="fuelType" config={config} onChange={handleChange} testId="ecu-fuel-type" />
        {config.fuelType === 'flex' && (
          <ParamRow label="Ethanol Content" configKey="ethanolContentPct" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="ecu-ethanol-pct" />
        )}
        {(config.fuelType === 'gasoline' || config.fuelType === 'flex') && (
          <ParamRow label="Gasoline Octane" configKey="gasolineOctane" config={config} onChange={handleChange} unit="oct" step={1} min={87} testId="ecu-gasoline-octane" />
        )}
        <ParamRow label="Injector Size" configKey="injectorSizeCc" config={config} onChange={handleChange} unit="cc" step={10} min={100} testId="ecu-injector-size" />
        <ParamRow label="Fuel Pressure" configKey="fuelPressurePsi" config={config} onChange={handleChange} unit="psi" step={1} min={20} testId="ecu-fuel-pressure" />
        <ParamRow label="AFR Target Idle" configKey="targetAfrIdle" config={config} onChange={handleChange} unit="ratio" step={0.1} min={10} testId="ecu-afr-idle" />
        <ParamRow label="AFR Target Cruise" configKey="targetAfrCruise" config={config} onChange={handleChange} unit="ratio" step={0.1} min={10} testId="ecu-afr-cruise" />
        <ParamRow label="AFR Target WOT" configKey="targetAfrWot" config={config} onChange={handleChange} unit="ratio" step={0.1} min={10} testId="ecu-afr-wot" />
        <ParamRow label="AFR Target VTEC" configKey="targetAfrVtec" config={config} onChange={handleChange} unit="ratio" step={0.1} min={10} testId="ecu-afr-vtec" />
        <ParamRow label="Cranking Fuel PW" configKey="crankingFuelPw" config={config} onChange={handleChange} unit="ms" step={0.5} min={5} testId="ecu-cranking-pw" />
        <ParamRow label="Warmup Enrich" configKey="warmupEnrichPct" config={config} onChange={handleChange} unit="%" step={1} min={0} testId="ecu-warmup-enrich" />
        <ParamRow label="Accel Enrich" configKey="accelEnrichPct" config={config} onChange={handleChange} unit="%" step={1} min={0} testId="ecu-accel-enrich" />
        <ParamRow label="Decel Fuel Cut" configKey="decelFuelCutRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={500} testId="ecu-decel-fuel-cut" />
        <ParamRow label="Closed Loop" configKey="closedLoopEnabled" config={config} onChange={handleChange} testId="ecu-closed-loop" />
        <ParamRow label="CL AFR Target" configKey="closedLoopAfrTarget" config={config} onChange={handleChange} unit="ratio" step={0.1} min={12} testId="ecu-cl-afr" />

        <SectionHeader title="Ignition Tuning" />
        <ParamRow label="Base Timing" configKey="baseTimingDeg" config={config} onChange={handleChange} unit="deg" step={1} min={0} testId="ecu-base-timing" />
        <ParamRow label="Max Advance" configKey="maxAdvanceDeg" config={config} onChange={handleChange} unit="deg" step={1} min={10} testId="ecu-max-advance" />
        <ParamRow label="Idle Timing" configKey="idleTimingDeg" config={config} onChange={handleChange} unit="deg" step={1} min={0} testId="ecu-idle-timing" />
        <ParamRow label="Knock Retard" configKey="knockRetardDeg" config={config} onChange={handleChange} unit="deg" step={1} min={0} testId="ecu-knock-retard" />
        <ParamRow label="Knock Sensitivity" configKey="knockSensitivity" config={config} onChange={handleChange} unit="0-10" step={1} min={0} testId="ecu-knock-sens" />
        <ParamRow label="Knock Recovery" configKey="knockRecoveryRate" config={config} onChange={handleChange} unit="deg/s" step={0.5} min={0} testId="ecu-knock-recovery" />

        <SectionHeader title="Boost / Wastegate" />
        <ParamRow label="Turbo Enabled" configKey="turboEnabled" config={config} onChange={handleChange} testId="ecu-turbo-enabled" />
        <ParamRow label="Wastegate Duty" configKey="wastegateBaseDuty" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="ecu-wastegate-duty" />
        <ParamRow label="Boost Target" configKey="boostTargetPsi" config={config} onChange={handleChange} unit="psi" step={1} min={1} testId="ecu-boost-target" />
        <ParamRow label="Boost Cut" configKey="boostCutPsi" config={config} onChange={handleChange} unit="psi" step={1} min={5} testId="ecu-boost-cut" />
        <ParamRow label="Anti-Lag" configKey="antiLagEnabled" config={config} onChange={handleChange} testId="ecu-anti-lag" />
        <ParamRow label="Anti-Lag Retard" configKey="antiLagRetard" config={config} onChange={handleChange} unit="deg" step={1} min={0} testId="ecu-anti-lag-retard" />
        <ParamRow label="Boost by Gear" configKey="boostByGearEnabled" config={config} onChange={handleChange} testId="ecu-boost-by-gear-enabled" />
        {config.boostByGearEnabled && (
          <ArrayParamRow label="Per-Gear Targets" configKey="boostByGear" config={config} onChange={handleChange} unit="psi" step={1} labels={["1st", "2nd", "3rd", "4th", "5th"]} testId="ecu-boost-gear" />
        )}

        <SectionHeader title="Intercooler" />
        <ParamRow label="Intercooler" configKey="intercoolerEnabled" config={config} onChange={handleChange} testId="ecu-intercooler-enabled" />
        {config.intercoolerEnabled && (
          <ParamRow label="IC Efficiency" configKey="intercoolerEfficiencyPct" config={config} onChange={handleChange} unit="%" step={5} min={50} testId="ecu-intercooler-eff" />
        )}

        <SectionHeader title="Supercharger" />
        <ParamRow label="Supercharger Enabled" configKey="superchargerEnabled" config={config} onChange={handleChange} testId="ecu-supercharger-enabled" />
        <ParamRow label="Supercharger Type" configKey="superchargerType" config={config} onChange={handleChange} testId="ecu-supercharger-type" />
        <ParamRow label="Max Boost PSI" configKey="superchargerMaxBoostPsi" config={config} onChange={handleChange} unit="psi" step={0.5} min={1} testId="ecu-supercharger-max-boost" />
        <ParamRow label="Efficiency" configKey="superchargerEfficiency" config={config} onChange={handleChange} unit="%" step={1} min={30} testId="ecu-supercharger-efficiency" />

        <SectionHeader title="Nitrous" />
        <ParamRow label="Nitrous Enabled" configKey="nitrousEnabled" config={config} onChange={handleChange} testId="ecu-nitrous-enabled" />
        <ParamRow label="Shot Size" configKey="nitrousHpAdder" config={config} onChange={handleChange} unit="hp" step={25} min={25} testId="ecu-nitrous-shot-size" />
        <ParamRow label="Activation RPM" configKey="nitrousActivationRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={1000} testId="ecu-nitrous-activation-rpm" />
        <ParamRow label="Full Throttle Only" configKey="nitrousFullThrottleOnly" config={config} onChange={handleChange} testId="ecu-nitrous-fto" />

        <SectionHeader title="Idle Control" />
        <ParamRow label="Target Idle RPM" configKey="targetIdleRpm" config={config} onChange={handleChange} unit="rpm" step={50} min={500} testId="ecu-idle-rpm" />
        <ParamRow label="IACV Position" configKey="idleIacvPosition" config={config} onChange={handleChange} unit="%" step={1} min={0} testId="ecu-iacv" />
        <ParamRow label="Idle Ign Timing" configKey="idleIgnitionTiming" config={config} onChange={handleChange} unit="deg" step={1} min={0} testId="ecu-idle-ign" />

        <SectionHeader title="Launch Control" />
        <ParamRow label="Launch Control" configKey="launchControlEnabled" config={config} onChange={handleChange} testId="ecu-launch-ctrl" />
        <ParamRow label="Launch RPM" configKey="launchControlRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={2000} testId="ecu-launch-rpm" />
        <ParamRow label="Two-Step" configKey="twoStepEnabled" config={config} onChange={handleChange} testId="ecu-two-step" />
        <ParamRow label="Two-Step RPM" configKey="twoStepRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={2000} testId="ecu-two-step-rpm" />
        <ParamRow label="Launch Retard" configKey="launchRetardDeg" config={config} onChange={handleChange} unit="deg" step={1} min={0} testId="ecu-launch-retard" />
        <ParamRow label="Launch Fuel Cut" configKey="launchFuelCutPct" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="ecu-launch-fuel-cut" />
        <ParamRow label="Flat Foot Shift" configKey="flatFootShiftEnabled" config={config} onChange={handleChange} testId="ecu-ffs" />
        <ParamRow label="FFS Cut Time" configKey="flatFootShiftCutTime" config={config} onChange={handleChange} unit="ms" step={10} min={50} testId="ecu-ffs-time" />

        <SectionHeader title="Traction Control" />
        <ParamRow label="Traction Control" configKey="tractionControlEnabled" config={config} onChange={handleChange} testId="ecu-tc-enabled" />
        <ParamRow label="Slip Threshold" configKey="tractionSlipThreshold" config={config} onChange={handleChange} unit="%" step={1} min={1} testId="ecu-tc-slip" />
        <ParamRow label="TC Retard" configKey="tractionRetardDeg" config={config} onChange={handleChange} unit="deg" step={1} min={0} testId="ecu-tc-retard" />
        <ParamRow label="TC Fuel Cut" configKey="tractionFuelCutPct" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="ecu-tc-fuel-cut" />
        <ParamRow label="TC Mode" configKey="tractionControlMode" config={config} onChange={handleChange} testId="ecu-tc-mode" />

        <SectionHeader title="Cooling" />
        <ParamRow label="Fan On Temp" configKey="fanOnTemp" config={config} onChange={handleChange} unit="F" step={5} min={150} testId="ecu-fan-on" />
        <ParamRow label="Fan Off Temp" configKey="fanOffTemp" config={config} onChange={handleChange} unit="F" step={5} min={140} testId="ecu-fan-off" />
        <ParamRow label="Overtemp Warning" configKey="overtempWarning" config={config} onChange={handleChange} unit="F" step={5} min={180} testId="ecu-overtemp-warn" />
        <ParamRow label="Overtemp Enrich" configKey="overtempEnrichPct" config={config} onChange={handleChange} unit="%" step={1} min={0} testId="ecu-overtemp-enrich" />

        <SectionHeader title="Sensor Calibration" />
        <ParamRow label="MAP Max" configKey="mapSensorMaxKpa" config={config} onChange={handleChange} unit="kPa" step={5} min={50} testId="ecu-map-max" />
        <ParamRow label="MAP Min" configKey="mapSensorMinKpa" config={config} onChange={handleChange} unit="kPa" step={1} min={0} testId="ecu-map-min" />
        <ParamRow label="O2 Sensor Type" configKey="o2SensorType" config={config} onChange={handleChange} testId="ecu-o2-type" />
        <ParamRow label="Coolant Offset" configKey="coolantSensorOffset" config={config} onChange={handleChange} unit="F" step={1} min={-20} testId="ecu-coolant-offset" />

        <SectionHeader title="Injector Tuning" />
        <ParamRow label="Dead Time" configKey="injectorDeadTimeMs" config={config} onChange={handleChange} unit="ms" step={0.1} min={0.3} testId="ecu-injector-dead-time" />
        <ParamRow label="Injection Angle" configKey="injectorAngleDeg" config={config} onChange={handleChange} unit="°BTDC" step={5} min={0} testId="ecu-injector-angle" />
        <ParamRow label="Staging Enabled" configKey="injectorStagingEnabled" config={config} onChange={handleChange} testId="ecu-injector-staging" />
        {config.injectorStagingEnabled && (
          <>
            <ParamRow label="Staging RPM" configKey="injectorStagingRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={2000} testId="ecu-staging-rpm" />
            <ParamRow label="Secondary Size" configKey="injectorStagingSizeCc" config={config} onChange={handleChange} unit="cc" step={10} min={200} testId="ecu-staging-size" />
          </>
        )}

        <SectionHeader title="Fuel Pump" />
        <ParamRow label="Prime Duty" configKey="fuelPumpPrimePct" config={config} onChange={handleChange} unit="%" step={5} min={50} testId="ecu-pump-prime" />
        <ParamRow label="Boost Duty" configKey="fuelPumpBoostPct" config={config} onChange={handleChange} unit="%" step={5} min={50} testId="ecu-pump-boost" />
        <ParamRow label="Return Style" configKey="fuelReturnEnabled" config={config} onChange={handleChange} testId="ecu-fuel-return" />

        <SectionHeader title="Ignition Extended" />
        <ParamRow label="Dwell Time" configKey="dwellTimeMs" config={config} onChange={handleChange} unit="ms" step={0.1} min={1} testId="ecu-dwell" />
        <ParamRow label="Voltage Comp" configKey="dwellVoltageComp" config={config} onChange={handleChange} testId="ecu-dwell-comp" />
        <ParamRow label="Plug Gap" configKey="sparkPlugGapMm" config={config} onChange={handleChange} unit="mm" step={0.05} min={0.6} testId="ecu-plug-gap" />
        <ParamRow label="Cut Type" configKey="ignitionCutType" config={config} onChange={handleChange} testId="ecu-ign-cut-type" />

        <SectionHeader title="Lambda / EGO Control" />
        <ParamRow label="Lambda Target" configKey="lambdaTarget" config={config} onChange={handleChange} unit="λ" step={0.01} min={0.7} testId="ecu-lambda" />
        <ParamRow label="EGO Trim Max" configKey="egoTrimMax" config={config} onChange={handleChange} unit="%" step={1} min={5} testId="ecu-ego-max" />
        <ParamRow label="EGO Trim Min" configKey="egoTrimMin" config={config} onChange={handleChange} unit="%" step={1} testId="ecu-ego-min" />
        <ParamRow label="EGO Update Rate" configKey="egoUpdateRateHz" config={config} onChange={handleChange} unit="Hz" step={5} min={1} testId="ecu-ego-rate" />

        <SectionHeader title="Data Logging" />
        <ParamRow label="Logging Enabled" configKey="dataLogEnabled" config={config} onChange={handleChange} testId="ecu-log-enabled" />
        <ParamRow label="Log Rate" configKey="dataLogRateHz" config={config} onChange={handleChange} unit="Hz" step={10} min={10} testId="ecu-log-rate" />

        <SectionHeader title="Aux Outputs" />
        <ParamRow label="Aux Output 1" configKey="auxOutput1Function" config={config} onChange={handleChange} testId="ecu-aux1" />
        <ParamRow label="Aux Output 2" configKey="auxOutput2Function" config={config} onChange={handleChange} testId="ecu-aux2" />
        <ParamRow label="Shift Light RPM" configKey="shiftLightRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={4000} testId="ecu-shift-light" />
        <ParamRow label="Shift Flash RPM" configKey="shiftLightFlashRpm" config={config} onChange={handleChange} unit="rpm" step={100} min={4000} testId="ecu-shift-flash" />

        <SectionHeader title="Custom Shift Points" />
        <ParamRow label="Custom Shift Points" configKey="customShiftPointsEnabled" config={config} onChange={handleChange} testId="ecu-csp-enabled" />
        {config.customShiftPointsEnabled && (
          <>
            <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono">
              <span style={{ color: t.textDim }}>Mode</span>
              <div className="flex gap-1">
                <button
                  className={`px-2 py-0.5 rounded text-[9px] border ${config.customShiftPointsMode === 'rpm' ? 'border-lime-400/60 text-lime-400 bg-lime-400/10' : ''}`}
                  style={config.customShiftPointsMode === 'rpm' ? undefined : { borderColor: t.borderFaint, color: t.textDim }}
                  onClick={() => handleChange('customShiftPointsMode', 'rpm')}
                  data-testid="ecu-csp-mode-rpm"
                >
                  RPM
                </button>
                <button
                  className={`px-2 py-0.5 rounded text-[9px] border ${config.customShiftPointsMode === 'speed' ? 'border-lime-400/60 text-lime-400 bg-lime-400/10' : ''}`}
                  style={config.customShiftPointsMode === 'speed' ? undefined : { borderColor: t.borderFaint, color: t.textDim }}
                  onClick={() => handleChange('customShiftPointsMode', 'speed')}
                  data-testid="ecu-csp-mode-speed"
                >
                  SPEED
                </button>
                <button
                  className={`px-2 py-0.5 rounded text-[9px] border ${config.customShiftPointsMode === 'wheel_speed' ? 'border-lime-400/60 text-lime-400 bg-lime-400/10' : ''}`}
                  style={config.customShiftPointsMode === 'wheel_speed' ? undefined : { borderColor: t.borderFaint, color: t.textDim }}
                  onClick={() => handleChange('customShiftPointsMode', 'wheel_speed')}
                  data-testid="ecu-csp-mode-wheel-speed"
                >
                  WHEEL SPD
                </button>
              </div>
            </div>
            {config.gearRatios.slice(0, -1).map((_, i) => {
              const isRpm = config.customShiftPointsMode === 'rpm';
              const isWheelSpeed = config.customShiftPointsMode === 'wheel_speed';
              const values = isRpm ? config.customShiftPointsRpm : isWheelSpeed ? config.customShiftPointsWheelSpeedMph : config.customShiftPointsMph;
              const configKey = isRpm ? 'customShiftPointsRpm' : isWheelSpeed ? 'customShiftPointsWheelSpeedMph' : 'customShiftPointsMph';
              const currentVal = values[i] ?? (isRpm ? 7800 : 50);
              return (
                <div key={`csp-${i}`} className="flex items-center justify-between px-3 py-1 text-[10px] font-mono">
                  <span style={{ color: t.textDim }}>{i + 1}→{i + 2} Shift</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={currentVal}
                      onChange={(e) => {
                        const newArr = [...values];
                        newArr[i] = parseFloat(e.target.value) || currentVal;
                        handleChange(configKey, newArr);
                      }}
                      step={isRpm ? 100 : 5}
                      min={isRpm ? 3000 : 10}
                      max={isRpm ? 9000 : 200}
                      className="w-[70px] rounded px-1.5 py-0.5 text-right text-[10px] font-mono"
                      style={{ background: t.inputBg, border: '1px solid ' + t.borderFaint, color: t.textMuted }}
                      data-testid={`ecu-csp-${i}`}
                    />
                    <span className="text-[9px]" style={{ color: t.textDim }}>{isRpm ? 'rpm' : 'mph'}</span>
                  </div>
                </div>
              );
            })}
          </>
        )}

        <SectionHeader title="Oil Monitoring" />
        <ParamRow label="Oil Pressure Sensor" configKey="oilPressureSensorEnabled" config={config} onChange={handleChange} testId="ecu-oil-press-en" />
        <ParamRow label="Min Oil Pressure" configKey="oilPressureMinPsi" config={config} onChange={handleChange} unit="psi" step={1} min={5} testId="ecu-oil-press-min" />
        <ParamRow label="Oil Temp Sensor" configKey="oilTempSensorEnabled" config={config} onChange={handleChange} testId="ecu-oil-temp-en" />
        <ParamRow label="Oil Temp Warning" configKey="oilTempWarningF" config={config} onChange={handleChange} unit="°F" step={5} min={200} testId="ecu-oil-temp-warn" />

        <SectionHeader title="EGT Monitoring" />
        <ParamRow label="EGT Sensor" configKey="egtSensorEnabled" config={config} onChange={handleChange} testId="ecu-egt-en" />
        <ParamRow label="EGT Warning" configKey="egtWarningF" config={config} onChange={handleChange} unit="°F" step={50} min={1000} testId="ecu-egt-warn" />
        <ParamRow label="EGT Enrich Threshold" configKey="egtFuelEnrichDeg" config={config} onChange={handleChange} unit="°F" step={50} min={1000} testId="ecu-egt-enrich" />

        <SectionHeader title="Wideband O2" />
        <ParamRow label="AFR Min" configKey="widebandAfrMin" config={config} onChange={handleChange} unit="afr" step={0.5} min={8} testId="ecu-wb-min" />
        <ParamRow label="AFR Max" configKey="widebandAfrMax" config={config} onChange={handleChange} unit="afr" step={0.5} min={14} testId="ecu-wb-max" />
        <ParamRow label="Cal Offset" configKey="widebandCalOffset" config={config} onChange={handleChange} unit="afr" step={0.1} testId="ecu-wb-offset" />

        <SectionHeader title="CAN Bus / Communications" />
        <ParamRow label="CAN Bus Enabled" configKey="canBusEnabled" config={config} onChange={handleChange} testId="ecu-can-en" />
        <ParamRow label="Baud Rate" configKey="canBusBaudRate" config={config} onChange={handleChange} unit="kbps" testId="ecu-can-baud" />
        <ParamRow label="Termination" configKey="canBusTermination" config={config} onChange={handleChange} testId="ecu-can-term" />
        <ParamRow label="Stream Rate" configKey="canBusStreamRateHz" config={config} onChange={handleChange} unit="Hz" step={10} min={10} testId="ecu-can-rate" />
        <ParamRow label="RPM ID" configKey="canBusRpmId" config={config} onChange={handleChange} unit="hex" step={1} min={0} testId="ecu-can-rpm-id" />
        <ParamRow label="TPS ID" configKey="canBusTpsId" config={config} onChange={handleChange} unit="hex" step={1} min={0} testId="ecu-can-tps-id" />
        <ParamRow label="VSS ID" configKey="canBusVssId" config={config} onChange={handleChange} unit="hex" step={1} min={0} testId="ecu-can-vss-id" />
        <ParamRow label="AFR ID" configKey="canBusAfrId" config={config} onChange={handleChange} unit="hex" step={1} min={0} testId="ecu-can-afr-id" />
        <ParamRow label="Boost ID" configKey="canBusBoostId" config={config} onChange={handleChange} unit="hex" step={1} min={0} testId="ecu-can-boost-id" />
        <ParamRow label="Temp ID" configKey="canBusTempId" config={config} onChange={handleChange} unit="hex" step={1} min={0} testId="ecu-can-temp-id" />

        <SectionHeader title="Emissions / OBD-II" />
        <ParamRow label="Catalytic Converter" configKey="catalyticConverterEnabled" config={config} onChange={handleChange} testId="ecu-cat-en" />
        <ParamRow label="Cat Light-Off Temp" configKey="catLightOffTempF" config={config} onChange={handleChange} unit="°F" step={25} min={400} testId="ecu-cat-lightoff" />
        <ParamRow label="Secondary Air Inj" configKey="secondaryAirInjEnabled" config={config} onChange={handleChange} testId="ecu-air-inj" />
        <ParamRow label="EGR Enabled" configKey="egrEnabled" config={config} onChange={handleChange} testId="ecu-egr-en" />
        <ParamRow label="EGR Duty %" configKey="egrDutyPct" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="ecu-egr-duty" />
        <ParamRow label="EVAP Purge" configKey="evapPurgeEnabled" config={config} onChange={handleChange} testId="ecu-evap-purge" />
        <ParamRow label="Purge Duty" configKey="evapPurgeDutyCyclePct" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="ecu-evap-duty" />
        <ParamRow label="O2 Heater" configKey="o2HeaterEnabled" config={config} onChange={handleChange} testId="ecu-o2-heater" />
        <ParamRow label="MIL Clear" configKey="milClearEnabled" config={config} onChange={handleChange} testId="ecu-mil-clear" />

        <SectionHeader title="Engine Management / Sensors" />
        <ParamRow label="ECU Type" configKey="ecuType" config={config} onChange={handleChange} testId="ecu-ecu-type" />
        <ParamRow label="TPS Type" configKey="tpsType" config={config} onChange={handleChange} testId="ecu-tps-type" />
        <ParamRow label="MAP Sensor" configKey="mapSensorType" config={config} onChange={handleChange} testId="ecu-map-sensor" />
        <ParamRow label="IAT Sensor" configKey="iatSensorType" config={config} onChange={handleChange} testId="ecu-iat-sensor" />
        <ParamRow label="ECT Sensor" configKey="ectSensorType" config={config} onChange={handleChange} testId="ecu-ect-sensor" />
        <ParamRow label="Crank Sensor" configKey="crankSensorType" config={config} onChange={handleChange} testId="ecu-crank-sensor" />
        <ParamRow label="Cam Sensor" configKey="camSensorType" config={config} onChange={handleChange} testId="ecu-cam-sensor" />
        <ParamRow label="Knock Sensor" configKey="knockSensorType" config={config} onChange={handleChange} testId="ecu-knock-sensor-type" />
        <ParamRow label="Fuel Press Sensor" configKey="fuelPressureSensorEnabled" config={config} onChange={handleChange} testId="ecu-fuel-press-sensor" />
        <ParamRow label="Ethanol Sensor" configKey="ethAnalyzerEnabled" config={config} onChange={handleChange} testId="ecu-eth-analyzer" />

        <SectionHeader title="Electronic Throttle" />
        <ParamRow label="E-Throttle Enabled" configKey="electronicThrottleEnabled" config={config} onChange={handleChange} testId="ecu-e-throttle" />
        <ParamRow label="Response Curve" configKey="throttleResponseCurve" config={config} onChange={handleChange} testId="ecu-throttle-curve" />
        <ParamRow label="Downshift Blip" configKey="throttleBlipOnDownshift" config={config} onChange={handleChange} testId="ecu-blip" />
        <ParamRow label="Idle Creep" configKey="throttleIdleCreepPct" config={config} onChange={handleChange} unit="%" step={1} min={0} testId="ecu-idle-creep" />
        <ParamRow label="Cruise Control" configKey="cruiseControlEnabled" config={config} onChange={handleChange} testId="ecu-cruise-en" />
        <ParamRow label="Cruise Max MPH" configKey="cruiseControlMaxMph" config={config} onChange={handleChange} unit="mph" step={5} min={50} testId="ecu-cruise-max" />

        <SectionHeader title="Fuel Injection Extended" />
        <ParamRow label="Injector Type" configKey="injectorType" config={config} onChange={handleChange} testId="ecu-inj-type" />
        <ParamRow label="Injector Count" configKey="injectorCount" config={config} onChange={handleChange} unit="#" step={1} min={1} testId="ecu-inj-count" />
        <ParamRow label="Flow @ 43 PSI" configKey="injectorFlowAt43Psi" config={config} onChange={handleChange} unit="cc" step={10} min={100} testId="ecu-inj-flow" />
        <ParamRow label="Max Imbalance" configKey="injectorBalanceMaxPct" config={config} onChange={handleChange} unit="%" step={1} min={1} testId="ecu-inj-balance" />
        <ParamRow label="Fuel Rail" configKey="fuelRailType" config={config} onChange={handleChange} testId="ecu-fuel-rail" />
        <ParamRow label="Fuel Filter" configKey="fuelFilterMicron" config={config} onChange={handleChange} unit="μm" step={5} min={5} testId="ecu-fuel-filter" />
        <ParamRow label="Fuel Pump" configKey="fuelPumpType" config={config} onChange={handleChange} testId="ecu-fuel-pump-type" />
        <ParamRow label="Pump Flow" configKey="fuelPumpFlowLph" config={config} onChange={handleChange} unit="LPH" step={10} min={50} testId="ecu-pump-flow" />
        <ParamRow label="Regulator Base PSI" configKey="fuelRegulatorBasePsi" config={config} onChange={handleChange} unit="PSI" step={1} min={30} testId="ecu-reg-base" />
        <ParamRow label="Rise Ratio" configKey="fuelRegulatorRiseRatio" config={config} onChange={handleChange} unit=":1" step={0.1} min={0.5} testId="ecu-reg-rise" />

        <SectionHeader title="Turbo Extended" />
        <ParamRow label="Turbo Frame" configKey="turboFrameSize" config={config} onChange={handleChange} testId="ecu-turbo-frame" />
        <ParamRow label="Comp Trim" configKey="turboCompressorTrim" config={config} onChange={handleChange} unit="#" step={2} min={40} testId="ecu-comp-trim" />
        <ParamRow label="Turbine Trim" configKey="turboTurbineTrim" config={config} onChange={handleChange} unit="#" step={2} min={50} testId="ecu-turb-trim" />
        <ParamRow label="Comp Inducer" configKey="turboCompressorInducerMm" config={config} onChange={handleChange} unit="mm" step={1} min={30} testId="ecu-comp-inducer" />
        <ParamRow label="Comp Exducer" configKey="turboCompressorExducerMm" config={config} onChange={handleChange} unit="mm" step={1} min={40} testId="ecu-comp-exducer" />
        <ParamRow label="Inlet Flange" configKey="turboInletFlange" config={config} onChange={handleChange} testId="ecu-turbo-inlet" />
        <ParamRow label="Exit Flange" configKey="turboExitFlange" config={config} onChange={handleChange} testId="ecu-turbo-exit" />
        <ParamRow label="Wastegate Type" configKey="turboWastegateType" config={config} onChange={handleChange} testId="ecu-wg-type" />
        <ParamRow label="WG Spring PSI" configKey="turboWastegateSpringPsi" config={config} onChange={handleChange} unit="PSI" step={1} min={3} testId="ecu-wg-spring" />
        <ParamRow label="Bearing Type" configKey="turboBearingType" config={config} onChange={handleChange} testId="ecu-turbo-bearing" />
        <ParamRow label="Housing A/R (Turb)" configKey="turboHousingARTurbine" config={config} onChange={handleChange} unit="A/R" step={0.02} min={0.3} testId="ecu-turbo-ar-turb" />
        <ParamRow label="Housing A/R (Comp)" configKey="turboHousingARCompressor" config={config} onChange={handleChange} unit="A/R" step={0.02} min={0.3} testId="ecu-turbo-ar-comp" />
        <ParamRow label="BOV Type" configKey="blowOffValveType" config={config} onChange={handleChange} testId="ecu-bov-type" />
        <ParamRow label="Boost Controller" configKey="boostControllerType" config={config} onChange={handleChange} testId="ecu-boost-ctrl" />
        <ParamRow label="IC Type" configKey="intercoolerType" config={config} onChange={handleChange} testId="ecu-ic-type" />
        <ParamRow label="IC Piping Dia" configKey="intercoolerPipingDiaMm" config={config} onChange={handleChange} unit="mm" step={5} min={38} testId="ecu-ic-pipe" />

        <SectionHeader title="Dash / Gauges" />
        <ParamRow label="Tach Range" configKey="tachometerRange" config={config} onChange={handleChange} unit="RPM" step={1000} min={6000} testId="ecu-tach-range" />
        <ParamRow label="Speedo Range" configKey="speedometerRange" config={config} onChange={handleChange} unit="MPH" step={10} min={100} testId="ecu-speedo-range" />
        <ParamRow label="Shift Light" configKey="shiftLightEnabled" config={config} onChange={handleChange} testId="ecu-shift-light-en" />
        <ParamRow label="Shift Light Color" configKey="shiftLightColor" config={config} onChange={handleChange} testId="ecu-shift-light-color" />
        <ParamRow label="Boost Gauge" configKey="boostGaugeEnabled" config={config} onChange={handleChange} testId="ecu-boost-gauge" />
        <ParamRow label="AFR Gauge" configKey="afrGaugeEnabled" config={config} onChange={handleChange} testId="ecu-afr-gauge" />
        <ParamRow label="Oil Press Gauge" configKey="oilPressGaugeEnabled" config={config} onChange={handleChange} testId="ecu-oil-press-gauge" />
        <ParamRow label="Oil Temp Gauge" configKey="oilTempGaugeEnabled" config={config} onChange={handleChange} testId="ecu-oil-temp-gauge" />
        <ParamRow label="EGT Gauge" configKey="egtGaugeEnabled" config={config} onChange={handleChange} testId="ecu-egt-gauge" />
        <ParamRow label="Fuel Press Gauge" configKey="fuelPressGaugeEnabled" config={config} onChange={handleChange} testId="ecu-fuel-press-gauge" />
        <ParamRow label="GPS Speed" configKey="gpsSpeedEnabled" config={config} onChange={handleChange} testId="ecu-gps-speed" />
        <ParamRow label="Data Log Overlay" configKey="dataLogOverlayEnabled" config={config} onChange={handleChange} testId="ecu-log-overlay" />

        {/* ── VEHICLE / DRIVETRAIN CONFIG LINK ── */}
        <div className="flex items-center gap-2 pt-6 pb-2 px-2">
          <div className="h-px flex-1" style={{ background: t.border }} />
          <Link href="/vehicle" className="text-[10px] tracking-[0.2em] uppercase font-mono text-orange-400 border border-orange-500/40 px-4 py-1.5 hover:bg-orange-500/10">
            VEHICLE &amp; DRIVETRAIN CONFIG →
          </Link>
          <div className="h-px flex-1" style={{ background: t.border }} />
        </div>

        <div className="h-6" />
      </div>

      <div className="shrink-0 px-3 py-2 border-t flex items-center justify-between gap-2" style={{ borderColor: t.borderFaint, background: t.bottomBg }}>
        <span className="text-[9px] tracking-wider uppercase font-mono" style={{ color: t.textDim, opacity: saveMsg ? 1 : 0.5 }}>{saveMsg || "CHANGES APPLY IN REAL-TIME"}</span>
        <button
          onClick={handleReset}
          className="text-[9px] tracking-wider uppercase font-mono border px-2 py-0.5"
          style={{ borderColor: t.borderFaint, color: t.textDim }}
          data-testid="button-reset-bottom"
        >
          RESET ALL
        </button>
      </div>
    </div>
  );
}
