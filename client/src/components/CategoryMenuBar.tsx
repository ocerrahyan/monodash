import { useState, useCallback, useRef, useEffect } from "react";
import { type EcuConfig, getDefaultEcuConfig, generateCamSpecsFromHp } from "@/lib/engineSim";
import { useTheme } from "@/lib/theme";
import { getAllPresets, savePreset, deletePreset, type Preset, configToShareUrl, exportConfigToFile, importConfigFromFile, pushUndo, undo, redo, canUndo, canRedo } from "@/lib/presets";
import { ENGINE_PRESETS, TRANS_PRESETS, REAR_DIFF_PRESETS } from "@/components/DrivetrainView3D";

type ConfigKey = keyof EcuConfig;

// ── Reusable editable number input ──
function EditableNumberInput({ value, onCommit, step, min, style }: {
  value: number;
  onCommit: (v: number) => void;
  step?: number;
  min?: number;
  style?: React.CSSProperties;
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
      onFocus={() => { setEditing(true); setText(String(value)); setTimeout(() => inputRef.current?.select(), 0); }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const parsed = parseFloat(text);
        if (!isNaN(parsed)) onCommit(min !== undefined ? Math.max(min, parsed) : parsed);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      step={step}
      className="text-[11px] font-mono tabular-nums w-16 text-center py-0.5 outline-none"
      style={style}
    />
  );
}

// ── Param row ──
function ParamRow({ label, configKey, config, onChange, unit, step = 1, min }: {
  label: string; configKey: ConfigKey; config: EcuConfig;
  onChange: (key: ConfigKey, value: any) => void;
  unit?: string; step?: number; min?: number;
}) {
  const value = config[configKey];
  const t = useTheme();

  if (typeof value === "boolean") {
    return (
      <div className="flex items-center justify-between py-1 px-2" style={{ borderBottom: `1px solid ${t.borderFaint}` }}>
        <span className="text-[10px] tracking-wide uppercase font-mono flex-1" style={{ color: t.textMuted }}>{label}</span>
        <button onClick={() => onChange(configKey, !value)}
          className="text-[11px] font-mono tabular-nums px-2 py-0.5 min-w-[50px] text-center"
          style={{ border: `1px solid ${t.border}`, background: t.inputBg, color: t.inputText }}>
          {value ? "ON" : "OFF"}
        </button>
        {unit && <span className="text-[8px] font-mono ml-1 w-10 text-right" style={{ color: t.textDim }}>{unit}</span>}
      </div>
    );
  }

  if (typeof value === "string") {
    const options = getStringOptions(configKey);
    return (
      <div className="flex items-center justify-between py-1 px-2" style={{ borderBottom: `1px solid ${t.borderFaint}` }}>
        <span className="text-[10px] tracking-wide uppercase font-mono flex-1" style={{ color: t.textMuted }}>{label}</span>
        <div className="flex gap-1 flex-wrap">
          {options.map((opt) => (
            <button key={opt} onClick={() => onChange(configKey, opt)}
              className="text-[9px] font-mono px-1.5 py-0.5"
              style={{ border: `1px solid ${value === opt ? t.activeBorder : t.inactiveBorder}`, color: value === opt ? t.activeText : t.inactiveText }}>
              {opt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1 px-2" style={{ borderBottom: `1px solid ${t.borderFaint}` }}>
      <span className="text-[10px] tracking-wide uppercase font-mono flex-1" style={{ color: t.textMuted }}>{label}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(configKey, min !== undefined ? Math.max(min, (value as number) - step) : (value as number) - step)}
          className="text-[11px] font-mono px-1.5 py-0.5" style={{ border: `1px solid ${t.inputBorder}`, color: t.textDim }}>-</button>
        <EditableNumberInput value={value as number} onCommit={(v) => onChange(configKey, v)} step={step} min={min}
          style={{ background: t.inputBg, color: t.inputText, border: `1px solid ${t.inputBorder}` }} />
        <button onClick={() => onChange(configKey, (value as number) + step)}
          className="text-[11px] font-mono px-1.5 py-0.5" style={{ border: `1px solid ${t.inputBorder}`, color: t.textDim }}>+</button>
      </div>
      {unit && <span className="text-[8px] font-mono ml-1 w-12 text-right" style={{ color: t.textDim }}>{unit}</span>}
    </div>
  );
}

// ── Array param row ──
function ArrayParamRow({ label, configKey, config, onChange, unit, step = 0.001, labels }: {
  label: string; configKey: ConfigKey; config: EcuConfig;
  onChange: (key: ConfigKey, value: any) => void;
  unit?: string; step?: number; labels: string[];
}) {
  const values = config[configKey] as number[];
  const t = useTheme();
  return (
    <div className="py-1 px-2" style={{ borderBottom: `1px solid ${t.borderFaint}` }}>
      <span className="text-[10px] tracking-wide uppercase font-mono block mb-1" style={{ color: t.textMuted }}>{label}</span>
      <div className="flex gap-1 flex-wrap">
        {values.map((v, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-[7px] font-mono" style={{ color: t.textDim }}>{labels[i] || `${i + 1}`}</span>
            <EditableNumberInput value={v} onCommit={(newVal) => { const a = [...values]; a[i] = newVal; onChange(configKey, a); }}
              step={step} style={{ background: t.inputBg, color: t.inputText, border: `1px solid ${t.inputBorder}`, width: 48, fontSize: 10 }} />
            {unit && <span className="text-[7px] font-mono" style={{ color: t.textDim }}>{unit}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ title }: { title: string }) {
  const t = useTheme();
  return (
    <div className="flex items-center gap-2 pt-3 pb-1 px-2">
      <div className="h-px flex-1" style={{ background: t.border }} />
      <span className="text-[8px] tracking-[0.3em] uppercase font-mono whitespace-nowrap" style={{ color: t.textDim }}>{title}</span>
      <div className="h-px flex-1" style={{ background: t.border }} />
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
    case "clutchType": return ["oem_organic", "stage1_organic", "stage2_kevlar", "stage3_cerametallic", "stage4_puck", "twin_disc"];
    case "flywheelType": return ["oem_dual_mass", "oem_single", "lightweight_chromoly", "aluminum"];
    case "shiftLightColor": return ["red", "blue", "green", "amber"];
    case "fuelMapInterpolation": return ["bilinear", "bicubic"];
    case "ignMapInterpolation": return ["bilinear", "bicubic"];
    case "fuelMapUnits": return ["ms", "multiplier", "lambda"];
    case "brakePadType": return ["stock", "sport", "race", "carbon"];
    default: return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// Category definitions
// ═══════════════════════════════════════════════════════════════

export type CategoryId = 'engine' | 'fuel' | 'boost' | 'drivetrain' | 'suspension' | 'sensors';

export const CATEGORIES: { id: CategoryId; label: string; icon: string; color: string }[] = [
  { id: 'engine',      label: 'ENGINE',      icon: '🔧', color: '#22c55e' },
  { id: 'fuel',        label: 'FUEL & IGN',  icon: '⛽', color: '#f59e0b' },
  { id: 'boost',       label: 'BOOST',       icon: '💨', color: '#3b82f6' },
  { id: 'drivetrain',  label: 'DRIVETRAIN',  icon: '⚙',  color: '#a855f7' },
  { id: 'suspension',  label: 'CHASSIS',     icon: '🏎',  color: '#ef4444' },
  { id: 'sensors',     label: 'SENSORS',     icon: '📡', color: '#06b6d4' },
];

// ═══════════════════════════════════════════════════════════════
// Category panels
// ═══════════════════════════════════════════════════════════════

function EnginePanel({ config, onChange }: { config: EcuConfig; onChange: (k: ConfigKey, v: any) => void }) {
  const t = useTheme();
  const currentEngine = ENGINE_PRESETS.find(e => e.id === config.engineId) || ENGINE_PRESETS[0];

  const handleEngineSwap = useCallback((preset: typeof ENGINE_PRESETS[0]) => {
    onChange('engineId', preset.id);
    onChange('engineLayout', preset.layout);
    onChange('redlineRpm', preset.redline);
    onChange('fuelCutRpm', preset.redline + 200);
    onChange('softCutRpm', preset.redline - 200);
  }, [onChange]);

  return (
    <>
      <SectionLabel title="Engine Swap" />
      <div className="px-2 py-1.5">
        <div className="text-[9px] font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: t.textMuted }}>
          <span>Current:</span>
          <span style={{ color: '#22c55e' }}>{currentEngine.name}</span>
          <span style={{ color: t.textDim }}>({currentEngine.displacement}cc {currentEngine.layout} • {currentEngine.maxHp}hp @ {currentEngine.maxHpRpm})</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {ENGINE_PRESETS.map((ep) => {
            const isActive = config.engineId === ep.id;
            return (
              <button
                key={ep.id}
                onClick={() => handleEngineSwap(ep)}
                className="text-[8px] font-mono px-1.5 py-1 border transition-colors"
                style={{
                  borderColor: isActive ? '#22c55e' : t.borderFaint,
                  background: isActive ? 'rgba(34,197,94,0.1)' : 'transparent',
                  color: isActive ? '#22c55e' : t.textDim,
                }}
                title={`${ep.name} — ${ep.displacement}cc ${ep.layout} ${ep.maxHp}hp/${ep.maxTq}lb-ft ${ep.forced ? '⚡FORCED' : 'NA'}\n${ep.description}`}
              >
                <div className="font-bold text-[9px]">{ep.shortName}</div>
                <div style={{ color: isActive ? '#22c55e80' : t.textDim, fontSize: 7 }}>{ep.maxHp}hp</div>
              </button>
            );
          })}
        </div>
      </div>

      <SectionLabel title="Engine Build" />
      <ParamRow label="Cylinders" configKey="numCylinders" config={config} onChange={onChange} unit="cyl" step={1} min={1} />
      <ParamRow label="Compression Ratio" configKey="compressionRatio" config={config} onChange={onChange} unit=":1" step={0.1} min={6} />

      <SectionLabel title="Rev Limits" />
      <ParamRow label="Redline RPM" configKey="redlineRpm" config={config} onChange={onChange} unit="rpm" step={100} min={3000} />
      <ParamRow label="Fuel Cut RPM" configKey="fuelCutRpm" config={config} onChange={onChange} unit="rpm" step={100} min={3000} />
      <ParamRow label="Rev Limit Type" configKey="revLimitType" config={config} onChange={onChange} />
      <ParamRow label="Soft Cut RPM" configKey="softCutRpm" config={config} onChange={onChange} unit="rpm" step={100} min={3000} />
      <ParamRow label="Soft Cut Retard" configKey="softCutRetard" config={config} onChange={onChange} unit="deg" step={1} min={0} />
      <ParamRow label="Speed Limiter" configKey="speedLimiterMph" config={config} onChange={onChange} unit="mph" step={5} min={30} />

      <SectionLabel title="VTEC Control" />
      <ParamRow label="VTEC Engage RPM" configKey="vtecEngageRpm" config={config} onChange={onChange} unit="rpm" step={100} min={2000} />
      <ParamRow label="VTEC Disengage RPM" configKey="vtecDisengageRpm" config={config} onChange={onChange} unit="rpm" step={100} min={2000} />
      <ParamRow label="Min Oil Pressure" configKey="vtecOilPressureMin" config={config} onChange={onChange} unit="psi" step={1} min={10} />

      <SectionLabel title="Cam Profile" />
      <ParamRow label="VTEC HP Adder" configKey="vtecTargetHp" config={config} onChange={onChange} unit="hp" step={5} min={0} />
      <div className="px-2 pb-1">
        <button
          onClick={() => {
            if (config.vtecTargetHp <= 0) return;
            const camSpecs = generateCamSpecsFromHp(config.vtecTargetHp, config.engineId);
            onChange('vtecIntakeLiftMm', camSpecs.vtecIntakeLiftMm);
            onChange('vtecExhaustLiftMm', camSpecs.vtecExhaustLiftMm);
            onChange('vtecIntakeDuration', camSpecs.vtecIntakeDuration);
            onChange('vtecExhaustDuration', camSpecs.vtecExhaustDuration);
          }}
          disabled={config.vtecTargetHp <= 0}
          className="text-[8px] font-mono px-2 py-1 border transition-colors w-full"
          style={{
            borderColor: config.vtecTargetHp > 0 ? '#22c55e' : t.borderFaint,
            background: config.vtecTargetHp > 0 ? 'rgba(34,197,94,0.08)' : 'transparent',
            color: config.vtecTargetHp > 0 ? '#22c55e' : t.textDim,
            cursor: config.vtecTargetHp > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          ⚡ Generate VTEC Cams for +{config.vtecTargetHp || '—'} HP
        </button>
      </div>
      <ParamRow label="Low Cam Intake Lift" configKey="lowCamIntakeLiftMm" config={config} onChange={onChange} unit="mm" step={0.1} min={5} />
      <ParamRow label="Low Cam Exhaust Lift" configKey="lowCamExhaustLiftMm" config={config} onChange={onChange} unit="mm" step={0.1} min={5} />
      <ParamRow label="Low Cam Intake Dur" configKey="lowCamIntakeDuration" config={config} onChange={onChange} unit="deg" step={2} min={180} />
      <ParamRow label="Low Cam Exhaust Dur" configKey="lowCamExhaustDuration" config={config} onChange={onChange} unit="deg" step={2} min={180} />
      <ParamRow label="VTEC Intake Lift" configKey="vtecIntakeLiftMm" config={config} onChange={onChange} unit="mm" step={0.1} min={5} />
      <ParamRow label="VTEC Exhaust Lift" configKey="vtecExhaustLiftMm" config={config} onChange={onChange} unit="mm" step={0.1} min={5} />
      <ParamRow label="VTEC Intake Dur" configKey="vtecIntakeDuration" config={config} onChange={onChange} unit="deg" step={2} min={200} />
      <ParamRow label="VTEC Exhaust Dur" configKey="vtecExhaustDuration" config={config} onChange={onChange} unit="deg" step={2} min={200} />

      <SectionLabel title="Idle Control" />
      <ParamRow label="Target Idle RPM" configKey="targetIdleRpm" config={config} onChange={onChange} unit="rpm" step={50} min={500} />
      <ParamRow label="IACV Position" configKey="idleIacvPosition" config={config} onChange={onChange} unit="%" step={1} min={0} />
      <ParamRow label="Idle Ign Timing" configKey="idleIgnitionTiming" config={config} onChange={onChange} unit="deg" step={1} min={0} />

      <SectionLabel title="Cooling" />
      <ParamRow label="Fan On Temp" configKey="fanOnTemp" config={config} onChange={onChange} unit="F" step={5} min={150} />
      <ParamRow label="Fan Off Temp" configKey="fanOffTemp" config={config} onChange={onChange} unit="F" step={5} min={140} />
      <ParamRow label="Overtemp Warning" configKey="overtempWarning" config={config} onChange={onChange} unit="F" step={5} min={180} />
      <ParamRow label="Overtemp Enrich" configKey="overtempEnrichPct" config={config} onChange={onChange} unit="%" step={1} min={0} />

      <SectionLabel title="Oil Monitoring" />
      <ParamRow label="Oil Pressure Sensor" configKey="oilPressureSensorEnabled" config={config} onChange={onChange} />
      <ParamRow label="Min Oil Pressure" configKey="oilPressureMinPsi" config={config} onChange={onChange} unit="psi" step={1} min={5} />
      <ParamRow label="Oil Temp Sensor" configKey="oilTempSensorEnabled" config={config} onChange={onChange} />
      <ParamRow label="Oil Temp Warning" configKey="oilTempWarningF" config={config} onChange={onChange} unit="°F" step={5} min={200} />

      <SectionLabel title="EGT Monitoring" />
      <ParamRow label="EGT Sensor" configKey="egtSensorEnabled" config={config} onChange={onChange} />
      <ParamRow label="EGT Warning" configKey="egtWarningF" config={config} onChange={onChange} unit="°F" step={50} min={1000} />
      <ParamRow label="EGT Enrich Threshold" configKey="egtFuelEnrichDeg" config={config} onChange={onChange} unit="°F" step={50} min={1000} />
    </>
  );
}

function FuelIgnPanel({ config, onChange }: { config: EcuConfig; onChange: (k: ConfigKey, v: any) => void }) {
  return (
    <>
      <SectionLabel title="Fuel Tuning" />
      <ParamRow label="Fuel Type" configKey="fuelType" config={config} onChange={onChange} />
      {config.fuelType === 'flex' && (
        <ParamRow label="Ethanol Content" configKey="ethanolContentPct" config={config} onChange={onChange} unit="%" step={5} min={0} />
      )}
      {(config.fuelType === 'gasoline' || config.fuelType === 'flex') && (
        <ParamRow label="Gasoline Octane" configKey="gasolineOctane" config={config} onChange={onChange} unit="oct" step={1} min={87} />
      )}
      <ParamRow label="Injector Size" configKey="injectorSizeCc" config={config} onChange={onChange} unit="cc" step={10} min={100} />
      <ParamRow label="Fuel Pressure" configKey="fuelPressurePsi" config={config} onChange={onChange} unit="psi" step={1} min={20} />
      <ParamRow label="AFR Target Idle" configKey="targetAfrIdle" config={config} onChange={onChange} unit="ratio" step={0.1} min={10} />
      <ParamRow label="AFR Target Cruise" configKey="targetAfrCruise" config={config} onChange={onChange} unit="ratio" step={0.1} min={10} />
      <ParamRow label="AFR Target WOT" configKey="targetAfrWot" config={config} onChange={onChange} unit="ratio" step={0.1} min={10} />
      <ParamRow label="AFR Target VTEC" configKey="targetAfrVtec" config={config} onChange={onChange} unit="ratio" step={0.1} min={10} />
      <ParamRow label="Cranking Fuel PW" configKey="crankingFuelPw" config={config} onChange={onChange} unit="ms" step={0.5} min={5} />
      <ParamRow label="Warmup Enrich" configKey="warmupEnrichPct" config={config} onChange={onChange} unit="%" step={1} min={0} />
      <ParamRow label="Accel Enrich" configKey="accelEnrichPct" config={config} onChange={onChange} unit="%" step={1} min={0} />
      <ParamRow label="Decel Fuel Cut" configKey="decelFuelCutRpm" config={config} onChange={onChange} unit="rpm" step={100} min={500} />
      <ParamRow label="Closed Loop" configKey="closedLoopEnabled" config={config} onChange={onChange} />
      <ParamRow label="CL AFR Target" configKey="closedLoopAfrTarget" config={config} onChange={onChange} unit="ratio" step={0.1} min={12} />

      <SectionLabel title="Ignition Tuning" />
      <ParamRow label="Base Timing" configKey="baseTimingDeg" config={config} onChange={onChange} unit="deg" step={1} min={0} />
      <ParamRow label="Max Advance" configKey="maxAdvanceDeg" config={config} onChange={onChange} unit="deg" step={1} min={10} />
      <ParamRow label="Idle Timing" configKey="idleTimingDeg" config={config} onChange={onChange} unit="deg" step={1} min={0} />
      <ParamRow label="Knock Retard" configKey="knockRetardDeg" config={config} onChange={onChange} unit="deg" step={1} min={0} />
      <ParamRow label="Knock Sensitivity" configKey="knockSensitivity" config={config} onChange={onChange} unit="0-10" step={1} min={0} />
      <ParamRow label="Knock Recovery" configKey="knockRecoveryRate" config={config} onChange={onChange} unit="deg/s" step={0.5} min={0} />

      <SectionLabel title="Ignition Extended" />
      <ParamRow label="Dwell Time" configKey="dwellTimeMs" config={config} onChange={onChange} unit="ms" step={0.1} min={1} />
      <ParamRow label="Voltage Comp" configKey="dwellVoltageComp" config={config} onChange={onChange} />
      <ParamRow label="Plug Gap" configKey="sparkPlugGapMm" config={config} onChange={onChange} unit="mm" step={0.05} min={0.6} />
      <ParamRow label="Cut Type" configKey="ignitionCutType" config={config} onChange={onChange} />

      <SectionLabel title="Injector Tuning" />
      <ParamRow label="Injector Type" configKey="injectorType" config={config} onChange={onChange} />
      <ParamRow label="Injector Count" configKey="injectorCount" config={config} onChange={onChange} unit="#" step={1} min={1} />
      <ParamRow label="Dead Time" configKey="injectorDeadTimeMs" config={config} onChange={onChange} unit="ms" step={0.1} min={0.3} />
      <ParamRow label="Injection Angle" configKey="injectorAngleDeg" config={config} onChange={onChange} unit="°BTDC" step={5} min={0} />
      <ParamRow label="Staging Enabled" configKey="injectorStagingEnabled" config={config} onChange={onChange} />
      {config.injectorStagingEnabled && (
        <>
          <ParamRow label="Staging RPM" configKey="injectorStagingRpm" config={config} onChange={onChange} unit="rpm" step={100} min={2000} />
          <ParamRow label="Secondary Size" configKey="injectorStagingSizeCc" config={config} onChange={onChange} unit="cc" step={10} min={200} />
        </>
      )}
      <ParamRow label="Flow @ 43 PSI" configKey="injectorFlowAt43Psi" config={config} onChange={onChange} unit="cc" step={10} min={100} />

      <SectionLabel title="Fuel Pump" />
      <ParamRow label="Fuel Pump Type" configKey="fuelPumpType" config={config} onChange={onChange} />
      <ParamRow label="Prime Duty" configKey="fuelPumpPrimePct" config={config} onChange={onChange} unit="%" step={5} min={50} />
      <ParamRow label="Boost Duty" configKey="fuelPumpBoostPct" config={config} onChange={onChange} unit="%" step={5} min={50} />
      <ParamRow label="Fuel Rail" configKey="fuelRailType" config={config} onChange={onChange} />
      <ParamRow label="Return Style" configKey="fuelReturnEnabled" config={config} onChange={onChange} />

      <SectionLabel title="Lambda / EGO" />
      <ParamRow label="Lambda Target" configKey="lambdaTarget" config={config} onChange={onChange} unit="λ" step={0.01} min={0.7} />
      <ParamRow label="EGO Trim Max" configKey="egoTrimMax" config={config} onChange={onChange} unit="%" step={1} min={5} />
      <ParamRow label="EGO Trim Min" configKey="egoTrimMin" config={config} onChange={onChange} unit="%" step={1} />
      <ParamRow label="EGO Update Rate" configKey="egoUpdateRateHz" config={config} onChange={onChange} unit="Hz" step={5} min={1} />
    </>
  );
}

function BoostPanel({ config, onChange }: { config: EcuConfig; onChange: (k: ConfigKey, v: any) => void }) {
  return (
    <>
      <SectionLabel title="Turbo" />
      <ParamRow label="Turbo Enabled" configKey="turboEnabled" config={config} onChange={onChange} />
      <ParamRow label="Wastegate Duty" configKey="wastegateBaseDuty" config={config} onChange={onChange} unit="%" step={5} min={0} />
      <ParamRow label="Boost Target" configKey="boostTargetPsi" config={config} onChange={onChange} unit="psi" step={1} min={1} />
      <ParamRow label="Boost Cut" configKey="boostCutPsi" config={config} onChange={onChange} unit="psi" step={1} min={5} />
      <ParamRow label="Anti-Lag" configKey="antiLagEnabled" config={config} onChange={onChange} />
      <ParamRow label="Anti-Lag Retard" configKey="antiLagRetard" config={config} onChange={onChange} unit="deg" step={1} min={0} />
      <ParamRow label="Boost by Gear" configKey="boostByGearEnabled" config={config} onChange={onChange} />
      {config.boostByGearEnabled && (
        <ArrayParamRow label="Per-Gear Targets" configKey="boostByGear" config={config} onChange={onChange} unit="psi" step={1} labels={["1st", "2nd", "3rd", "4th", "5th"]} />
      )}

      <SectionLabel title="Turbo Extended" />
      <ParamRow label="Turbo Frame" configKey="turboFrameSize" config={config} onChange={onChange} />
      <ParamRow label="Comp Trim" configKey="turboCompressorTrim" config={config} onChange={onChange} unit="#" step={2} min={40} />
      <ParamRow label="Turbine Trim" configKey="turboTurbineTrim" config={config} onChange={onChange} unit="#" step={2} min={50} />
      <ParamRow label="Inlet Flange" configKey="turboInletFlange" config={config} onChange={onChange} />
      <ParamRow label="Exit Flange" configKey="turboExitFlange" config={config} onChange={onChange} />
      <ParamRow label="Wastegate Type" configKey="turboWastegateType" config={config} onChange={onChange} />
      <ParamRow label="WG Spring PSI" configKey="turboWastegateSpringPsi" config={config} onChange={onChange} unit="PSI" step={1} min={3} />
      <ParamRow label="Bearing Type" configKey="turboBearingType" config={config} onChange={onChange} />
      <ParamRow label="BOV Type" configKey="blowOffValveType" config={config} onChange={onChange} />
      <ParamRow label="Boost Controller" configKey="boostControllerType" config={config} onChange={onChange} />

      <SectionLabel title="Intercooler" />
      <ParamRow label="Intercooler" configKey="intercoolerEnabled" config={config} onChange={onChange} />
      <ParamRow label="IC Type" configKey="intercoolerType" config={config} onChange={onChange} />
      {config.intercoolerEnabled && (
        <ParamRow label="IC Efficiency" configKey="intercoolerEfficiencyPct" config={config} onChange={onChange} unit="%" step={5} min={50} />
      )}

      <SectionLabel title="Supercharger" />
      <ParamRow label="Supercharger" configKey="superchargerEnabled" config={config} onChange={onChange} />
      <ParamRow label="SC Type" configKey="superchargerType" config={config} onChange={onChange} />
      <ParamRow label="Max Boost PSI" configKey="superchargerMaxBoostPsi" config={config} onChange={onChange} unit="psi" step={0.5} min={1} />
      <ParamRow label="Efficiency" configKey="superchargerEfficiency" config={config} onChange={onChange} unit="%" step={1} min={30} />

      <SectionLabel title="Nitrous" />
      <ParamRow label="Nitrous Enabled" configKey="nitrousEnabled" config={config} onChange={onChange} />
      <ParamRow label="Shot Size" configKey="nitrousHpAdder" config={config} onChange={onChange} unit="hp" step={25} min={25} />
      <ParamRow label="Activation RPM" configKey="nitrousActivationRpm" config={config} onChange={onChange} unit="rpm" step={100} min={1000} />
      <ParamRow label="Full Throttle Only" configKey="nitrousFullThrottleOnly" config={config} onChange={onChange} />
    </>
  );
}

function DrivetrainPanel({ config, onChange }: { config: EcuConfig; onChange: (k: ConfigKey, v: any) => void }) {
  const t = useTheme();
  const currentTrans = TRANS_PRESETS.find(tr => tr.id === config.transmissionModel) || TRANS_PRESETS[0];
  const currentDiff = REAR_DIFF_PRESETS.find(d => d.id === config.rearDiffModel) || REAR_DIFF_PRESETS[0];

  const handleTransSwap = useCallback((preset: typeof TRANS_PRESETS[0]) => {
    onChange('transmissionModel', preset.id);
    // Pad or trim gear ratios to match preset
    const ratios = [...preset.defaultRatios];
    while (ratios.length < 5) ratios.push(ratios[ratios.length - 1] * 0.8);
    onChange('gearRatios', ratios.slice(0, 5));
    onChange('clutchMaxTorqueNm', Math.round(preset.maxTorqueNm * 0.85));
  }, [onChange]);

  const handleDiffSwap = useCallback((preset: typeof REAR_DIFF_PRESETS[0]) => {
    onChange('rearDiffModel', preset.id);
    if (preset.widthMm > 0) onChange('rearAxleWidthMm', preset.widthMm);
  }, [onChange]);

  return (
    <>
      <SectionLabel title="Transmission" />
      <div className="px-2 py-1.5">
        <div className="text-[9px] font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: t.textMuted }}>
          <span>Current:</span>
          <span style={{ color: '#a855f7' }}>{currentTrans.name}</span>
          <span style={{ color: t.textDim }}>({currentTrans.speeds}-spd • {currentTrans.maxTorqueNm}Nm max)</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {TRANS_PRESETS.map((tp) => {
            const isActive = config.transmissionModel === tp.id;
            return (
              <button
                key={tp.id}
                onClick={() => handleTransSwap(tp)}
                className="text-[8px] font-mono px-1.5 py-1 border transition-colors"
                style={{
                  borderColor: isActive ? '#a855f7' : t.borderFaint,
                  background: isActive ? 'rgba(168,85,247,0.1)' : 'transparent',
                  color: isActive ? '#a855f7' : t.textDim,
                }}
                title={`${tp.name} — ${tp.speeds}-speed, ${tp.maxTorqueNm}Nm, ${tp.weightKg}kg\nBellhousing: ${tp.bellhousingPattern}\n${tp.description}`}
              >
                <div className="font-bold text-[9px]">{tp.shortName}</div>
                <div style={{ color: isActive ? '#a855f780' : t.textDim, fontSize: 7 }}>{tp.speeds}spd</div>
              </button>
            );
          })}
        </div>
      </div>

      <SectionLabel title="Rear Differential" />
      <div className="px-2 py-1.5">
        <div className="text-[9px] font-mono uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: t.textMuted }}>
          <span>Current:</span>
          <span style={{ color: '#f59e0b' }}>{currentDiff.name}</span>
          {currentDiff.maxTorqueNm > 0 && <span style={{ color: t.textDim }}>({currentDiff.ringGearDia}" ring • {currentDiff.maxTorqueNm}Nm)</span>}
        </div>
        <div className="flex gap-1 flex-wrap">
          {REAR_DIFF_PRESETS.map((dp) => {
            const isActive = config.rearDiffModel === dp.id;
            return (
              <button
                key={dp.id}
                onClick={() => handleDiffSwap(dp)}
                className="text-[8px] font-mono px-1.5 py-1 border transition-colors"
                style={{
                  borderColor: isActive ? '#f59e0b' : t.borderFaint,
                  background: isActive ? 'rgba(245,158,11,0.1)' : 'transparent',
                  color: isActive ? '#f59e0b' : t.textDim,
                }}
                title={`${dp.name} — ${dp.ringGearDia}" ring gear, ${dp.splineCount} spline, ${dp.maxTorqueNm}Nm\n${dp.description}`}
              >
                <div className="font-bold text-[9px]">{dp.shortName}</div>
                {dp.maxTorqueNm > 0 && <div style={{ color: isActive ? '#f59e0b80' : t.textDim, fontSize: 7 }}>{dp.ringGearDia}"</div>}
              </button>
            );
          })}
        </div>
      </div>

      <SectionLabel title="Drivetrain Layout" />
      <ParamRow label="Drivetrain Type" configKey="drivetrainType" config={config} onChange={onChange} />
      <ParamRow label="Front Diff" configKey="frontDiffType" config={config} onChange={onChange} />
      <ParamRow label="Rear Diff" configKey="rearDiffType" config={config} onChange={onChange} />
      {config.drivetrainType === 'AWD' && (
        <>
          <ParamRow label="Center Diff" configKey="centerDiffType" config={config} onChange={onChange} />
          <ParamRow label="AWD Front Bias" configKey="awdFrontBias" config={config} onChange={onChange} unit="%" step={0.05} min={0.1} />
        </>
      )}

      <SectionLabel title="Clutch & Flywheel" />
      <ParamRow label="Clutch Type" configKey="clutchType" config={config} onChange={(k, v) => {
        onChange(k, v);
        // Auto-set max torque and spring pressure based on clutch type
        const clutchSpecs: Record<string, { torqueNm: number; springLb: number }> = {
          oem_organic: { torqueNm: 200, springLb: 1800 },
          stage1_organic: { torqueNm: 300, springLb: 2200 },
          stage2_kevlar: { torqueNm: 420, springLb: 2600 },
          stage3_cerametallic: { torqueNm: 550, springLb: 3000 },
          stage4_puck: { torqueNm: 700, springLb: 3400 },
          twin_disc: { torqueNm: 900, springLb: 2800 },
        };
        const spec = clutchSpecs[v as string];
        if (spec) {
          onChange('clutchMaxTorqueNm', spec.torqueNm);
          onChange('clutchSpringPressureLb', spec.springLb);
        }
      }} />
      <ParamRow label="Max Torque" configKey="clutchMaxTorqueNm" config={config} onChange={onChange} unit="Nm" step={10} min={100} />
      <ParamRow label="Spring Pressure" configKey="clutchSpringPressureLb" config={config} onChange={onChange} unit="lb" step={100} min={800} />
      <ParamRow label="Engagement" configKey="clutchEngagement" config={config} onChange={onChange} unit="%" step={5} min={0} />
      <ParamRow label="Flywheel" configKey="flywheelType" config={config} onChange={(k, v) => {
        onChange(k, v);
        const fwSpecs: Record<string, number> = {
          oem_dual_mass: 22,
          oem_single: 14,
          lightweight_chromoly: 10,
          aluminum: 7,
        };
        const mass = fwSpecs[v as string];
        if (mass) onChange('flywheelMassLb', mass);
      }} />
      <ParamRow label="Flywheel Mass" configKey="flywheelMassLb" config={config} onChange={onChange} unit="lb" step={0.5} min={4} />

      <SectionLabel title="Gear Ratios" />
      <ArrayParamRow label="Gear Ratios" configKey="gearRatios" config={config} onChange={onChange} step={0.01} labels={["1st", "2nd", "3rd", "4th", "5th"]} />
      <ParamRow label="Final Drive" configKey="finalDriveRatio" config={config} onChange={onChange} step={0.01} min={2} />
      <ParamRow label="Shift Time" configKey="shiftTimeMs" config={config} onChange={onChange} unit="ms" step={10} min={30} />

      <SectionLabel title="Shift Points" />
      <ParamRow label="Custom Shift Points" configKey="customShiftPointsEnabled" config={config} onChange={onChange} />
      {config.customShiftPointsEnabled && (
        <>
          <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-mono">
            <span style={{ color: t.textDim }}>Mode</span>
            <div className="flex gap-1">
              {([['rpm', 'RPM'], ['speed', 'SPEED'], ['wheel_speed', 'WHEEL SPD']] as const).map(([mode, label]) => {
                const isActive = config.customShiftPointsMode === mode;
                return (
                  <button
                    key={mode}
                    className={`px-2 py-0.5 rounded text-[9px] border ${isActive ? 'border-lime-400/60 text-lime-400 bg-lime-400/10' : ''}`}
                    style={isActive ? undefined : { borderColor: t.borderFaint, color: t.textDim }}
                    onClick={() => onChange('customShiftPointsMode', mode)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {config.gearRatios.slice(0, -1).map((_, i) => {
            const isRpm = config.customShiftPointsMode === 'rpm';
            const isWheelSpeed = config.customShiftPointsMode === 'wheel_speed';
            const values = isRpm ? config.customShiftPointsRpm : isWheelSpeed ? config.customShiftPointsWheelSpeedMph : config.customShiftPointsMph;
            const configKey = isRpm ? 'customShiftPointsRpm' : isWheelSpeed ? 'customShiftPointsWheelSpeedMph' : 'customShiftPointsMph';
            const currentVal = values[i] ?? (isRpm ? 7800 : 50);
            return (
              <div key={`dt-csp-${i}`} className="flex items-center justify-between px-3 py-1 text-[10px] font-mono">
                <span style={{ color: t.textDim }}>{i + 1}→{i + 2} Shift</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={currentVal}
                    onChange={(e) => {
                      const newArr = [...values];
                      newArr[i] = parseFloat(e.target.value) || currentVal;
                      onChange(configKey, newArr);
                    }}
                    step={isRpm ? 100 : 5}
                    min={isRpm ? 3000 : 10}
                    max={isRpm ? 9000 : 200}
                    className="w-[70px] rounded px-1.5 py-0.5 text-right text-[10px] font-mono"
                    style={{ background: t.inputBg, border: '1px solid ' + t.borderFaint, color: t.textMuted }}
                  />
                  <span className="text-[9px]" style={{ color: t.textDim }}>{isRpm ? 'rpm' : 'mph'}</span>
                </div>
              </div>
            );
          })}
        </>
      )}

      <SectionLabel title="Launch Control" />
      <ParamRow label="Launch Control" configKey="launchControlEnabled" config={config} onChange={onChange} />
      <ParamRow label="Launch RPM" configKey="launchControlRpm" config={config} onChange={onChange} unit="rpm" step={100} min={2000} />
      <ParamRow label="Two-Step" configKey="twoStepEnabled" config={config} onChange={onChange} />
      <ParamRow label="Two-Step RPM" configKey="twoStepRpm" config={config} onChange={onChange} unit="rpm" step={100} min={2000} />
      <ParamRow label="Launch Retard" configKey="launchRetardDeg" config={config} onChange={onChange} unit="deg" step={1} min={0} />
      <ParamRow label="Launch Fuel Cut" configKey="launchFuelCutPct" config={config} onChange={onChange} unit="%" step={5} min={0} />
      <ParamRow label="Flat Foot Shift" configKey="flatFootShiftEnabled" config={config} onChange={onChange} />
      <ParamRow label="FFS Cut Time" configKey="flatFootShiftCutTime" config={config} onChange={onChange} unit="ms" step={10} min={50} />

      <SectionLabel title="Traction Control" />
      <ParamRow label="Traction Control" configKey="tractionControlEnabled" config={config} onChange={onChange} />
      <ParamRow label="Slip Threshold" configKey="tractionSlipThreshold" config={config} onChange={onChange} unit="%" step={1} min={1} />
      <ParamRow label="TC Retard" configKey="tractionRetardDeg" config={config} onChange={onChange} unit="deg" step={1} min={0} />
      <ParamRow label="TC Fuel Cut" configKey="tractionFuelCutPct" config={config} onChange={onChange} unit="%" step={5} min={0} />
      <ParamRow label="TC Mode" configKey="tractionControlMode" config={config} onChange={onChange} />

      <SectionLabel title="Tires & Wheels" />
      <ParamRow label="Tire Compound" configKey="tireCompound" config={config} onChange={onChange} />
      <ParamRow label="Tire Width" configKey="tireWidthMm" config={config} onChange={onChange} unit="mm" step={5} min={135} />
      <ParamRow label="Aspect Ratio" configKey="tireAspectRatio" config={config} onChange={onChange} unit="%" step={5} min={25} />
      <ParamRow label="Wheel Diameter" configKey="tireWheelDiameterIn" config={config} onChange={onChange} unit="in" step={1} min={13} />
      <ParamRow label="Tire Grip Coeff" configKey="tireGripCoeff" config={config} onChange={onChange} step={0.05} min={0.5} />
      <ParamRow label="Tire Grip %" configKey="tireGripPct" config={config} onChange={onChange} unit="%" step={1} min={50} />

      <SectionLabel title="Electronic Throttle" />
      <ParamRow label="E-Throttle" configKey="electronicThrottleEnabled" config={config} onChange={onChange} />
      <ParamRow label="Response Curve" configKey="throttleResponseCurve" config={config} onChange={onChange} />
      <ParamRow label="Downshift Blip" configKey="throttleBlipOnDownshift" config={config} onChange={onChange} />
      <ParamRow label="Idle Creep" configKey="throttleIdleCreepPct" config={config} onChange={onChange} unit="%" step={1} min={0} />

      <SectionLabel title="Vehicle" />
      <ParamRow label="Vehicle Mass" configKey="vehicleMassLb" config={config} onChange={onChange} unit="lb" step={25} min={1500} />
      <ParamRow label="Drag Coefficient" configKey="dragCoefficient" config={config} onChange={onChange} step={0.01} min={0.1} />
      <ParamRow label="Frontal Area" configKey="frontalAreaM2" config={config} onChange={onChange} unit="m²" step={0.05} min={1} />
      <ParamRow label="Rolling Resistance" configKey="rollingResistanceCoeff" config={config} onChange={onChange} step={0.001} min={0.005} />
      <ParamRow label="Drivetrain Loss" configKey="drivetrainLossPct" config={config} onChange={onChange} unit="%" step={1} min={5} />
    </>
  );
}

function ChassisPanel({ config, onChange }: { config: EcuConfig; onChange: (k: ConfigKey, v: any) => void }) {
  return (
    <>
      <SectionLabel title="Suspension Geometry" />
      <ParamRow label="Front Camber" configKey="frontCamberDeg" config={config} onChange={onChange} unit="deg" step={0.25} />
      <ParamRow label="Rear Camber" configKey="rearCamberDeg" config={config} onChange={onChange} unit="deg" step={0.25} />
      <ParamRow label="Front Toe" configKey="frontToeDeg" config={config} onChange={onChange} unit="deg" step={0.05} />
      <ParamRow label="Rear Toe" configKey="rearToeDeg" config={config} onChange={onChange} unit="deg" step={0.05} />
      <ParamRow label="Front Caster" configKey="frontCasterDeg" config={config} onChange={onChange} unit="deg" step={0.25} />
      <ParamRow label="Front KPI" configKey="frontKPIDeg" config={config} onChange={onChange} unit="deg" step={0.25} />

      <SectionLabel title="Springs" />
      <ParamRow label="Front Rate" configKey="frontSpringRateKgmm" config={config} onChange={onChange} unit="kg/mm" step={1} min={2} />
      <ParamRow label="Rear Rate" configKey="rearSpringRateKgmm" config={config} onChange={onChange} unit="kg/mm" step={1} min={2} />
      <ParamRow label="Front Ride Height" configKey="frontRideHeightMm" config={config} onChange={onChange} unit="mm" step={5} min={50} />
      <ParamRow label="Rear Ride Height" configKey="rearRideHeightMm" config={config} onChange={onChange} unit="mm" step={5} min={50} />

      <SectionLabel title="Dampers" />
      <ParamRow label="Front Bump" configKey="frontDamperBump" config={config} onChange={onChange} unit="clicks" step={1} min={1} />
      <ParamRow label="Front Rebound" configKey="frontDamperRebound" config={config} onChange={onChange} unit="clicks" step={1} min={1} />
      <ParamRow label="Rear Bump" configKey="rearDamperBump" config={config} onChange={onChange} unit="clicks" step={1} min={1} />
      <ParamRow label="Rear Rebound" configKey="rearDamperRebound" config={config} onChange={onChange} unit="clicks" step={1} min={1} />

      <SectionLabel title="Anti-Roll Bars" />
      <ParamRow label="Front Sway Bar" configKey="frontSwayBarEnabled" config={config} onChange={onChange} />
      <ParamRow label="Front Dia" configKey="frontSwayBarDiaMm" config={config} onChange={onChange} unit="mm" step={1} min={16} />
      <ParamRow label="Rear Sway Bar" configKey="rearSwayBarEnabled" config={config} onChange={onChange} />
      <ParamRow label="Rear Dia" configKey="rearSwayBarDiaMm" config={config} onChange={onChange} unit="mm" step={1} min={14} />

      <SectionLabel title="Brakes" />
      <ParamRow label="Brake Bias Front" configKey="brakeBiasFront" config={config} onChange={onChange} unit="%" step={0.05} min={0.4} />
      <ParamRow label="Front Rotor Dia" configKey="frontRotorDiaMm" config={config} onChange={onChange} unit="mm" step={10} min={240} />
      <ParamRow label="Rear Rotor Dia" configKey="rearRotorDiaMm" config={config} onChange={onChange} unit="mm" step={10} min={220} />
      <ParamRow label="Brake Pad Type" configKey="brakePadType" config={config} onChange={onChange} />
      <ParamRow label="ABS Enabled" configKey="absEnabled" config={config} onChange={onChange} />

      <SectionLabel title="Aero" />
      <ParamRow label="Rear Wing" configKey="rearWingEnabled" config={config} onChange={onChange} />
      <ParamRow label="Wing Angle" configKey="rearWingAngleDeg" config={config} onChange={onChange} unit="deg" step={1} min={0} />
      <ParamRow label="Front Splitter" configKey="frontSplitterEnabled" config={config} onChange={onChange} />
      <ParamRow label="Downforce Front" configKey="downforceCoefficientFront" config={config} onChange={onChange} step={0.05} min={0} />
      <ParamRow label="Downforce Rear" configKey="downforceCoefficientRear" config={config} onChange={onChange} step={0.05} min={0} />

      <SectionLabel title="Weight & Steering" />
      <ParamRow label="Wheelbase" configKey="wheelbaseM" config={config} onChange={onChange} unit="m" step={0.01} min={2} />
      <ParamRow label="CG Height" configKey="cgHeightM" config={config} onChange={onChange} unit="m" step={0.01} min={0.2} />
      <ParamRow label="Front Weight Bias" configKey="frontWeightBias" config={config} onChange={onChange} unit="%" step={0.01} min={0.3} />
      <ParamRow label="Ballast" configKey="ballastKg" config={config} onChange={onChange} unit="kg" step={5} min={0} />
      <ParamRow label="Driver Weight" configKey="driverWeightKg" config={config} onChange={onChange} unit="kg" step={5} min={40} />
      <ParamRow label="Steering Ratio" configKey="steeringRatio" config={config} onChange={onChange} step={0.5} min={8} />
      <ParamRow label="Power Steering" configKey="powerSteeringEnabled" config={config} onChange={onChange} />
    </>
  );
}

function SensorsPanel({ config, onChange }: { config: EcuConfig; onChange: (k: ConfigKey, v: any) => void }) {
  return (
    <>
      <SectionLabel title="ECU / Engine Management" />
      <ParamRow label="ECU Type" configKey="ecuType" config={config} onChange={onChange} />
      <ParamRow label="TPS Type" configKey="tpsType" config={config} onChange={onChange} />
      <ParamRow label="MAP Sensor" configKey="mapSensorType" config={config} onChange={onChange} />
      <ParamRow label="IAT Sensor" configKey="iatSensorType" config={config} onChange={onChange} />
      <ParamRow label="ECT Sensor" configKey="ectSensorType" config={config} onChange={onChange} />
      <ParamRow label="Crank Sensor" configKey="crankSensorType" config={config} onChange={onChange} />
      <ParamRow label="Cam Sensor" configKey="camSensorType" config={config} onChange={onChange} />
      <ParamRow label="Knock Sensor" configKey="knockSensorType" config={config} onChange={onChange} />
      <ParamRow label="Fuel Press Sensor" configKey="fuelPressureSensorEnabled" config={config} onChange={onChange} />
      <ParamRow label="Ethanol Sensor" configKey="ethAnalyzerEnabled" config={config} onChange={onChange} />

      <SectionLabel title="Sensor Calibration" />
      <ParamRow label="MAP Max" configKey="mapSensorMaxKpa" config={config} onChange={onChange} unit="kPa" step={5} min={50} />
      <ParamRow label="MAP Min" configKey="mapSensorMinKpa" config={config} onChange={onChange} unit="kPa" step={1} min={0} />
      <ParamRow label="O2 Sensor Type" configKey="o2SensorType" config={config} onChange={onChange} />
      <ParamRow label="Coolant Offset" configKey="coolantSensorOffset" config={config} onChange={onChange} unit="F" step={1} min={-20} />

      <SectionLabel title="Wideband O2" />
      <ParamRow label="AFR Min" configKey="widebandAfrMin" config={config} onChange={onChange} unit="afr" step={0.5} min={8} />
      <ParamRow label="AFR Max" configKey="widebandAfrMax" config={config} onChange={onChange} unit="afr" step={0.5} min={14} />
      <ParamRow label="Cal Offset" configKey="widebandCalOffset" config={config} onChange={onChange} unit="afr" step={0.1} />

      <SectionLabel title="CAN Bus" />
      <ParamRow label="CAN Bus" configKey="canBusEnabled" config={config} onChange={onChange} />
      <ParamRow label="Baud Rate" configKey="canBusBaudRate" config={config} onChange={onChange} unit="kbps" />
      <ParamRow label="Termination" configKey="canBusTermination" config={config} onChange={onChange} />
      <ParamRow label="Stream Rate" configKey="canBusStreamRateHz" config={config} onChange={onChange} unit="Hz" step={10} min={10} />

      <SectionLabel title="Emissions / OBD-II" />
      <ParamRow label="Catalytic Converter" configKey="catalyticConverterEnabled" config={config} onChange={onChange} />
      <ParamRow label="Secondary Air Inj" configKey="secondaryAirInjEnabled" config={config} onChange={onChange} />
      <ParamRow label="EGR Enabled" configKey="egrEnabled" config={config} onChange={onChange} />
      <ParamRow label="EGR Duty" configKey="egrDutyPct" config={config} onChange={onChange} unit="%" step={5} min={0} />
      <ParamRow label="EVAP Purge" configKey="evapPurgeEnabled" config={config} onChange={onChange} />
      <ParamRow label="O2 Heater" configKey="o2HeaterEnabled" config={config} onChange={onChange} />
      <ParamRow label="MIL Clear" configKey="milClearEnabled" config={config} onChange={onChange} />

      <SectionLabel title="Data Logging" />
      <ParamRow label="Logging Enabled" configKey="dataLogEnabled" config={config} onChange={onChange} />
      <ParamRow label="Log Rate" configKey="dataLogRateHz" config={config} onChange={onChange} unit="Hz" step={10} min={10} />

      <SectionLabel title="Aux Outputs" />
      <ParamRow label="Aux Output 1" configKey="auxOutput1Function" config={config} onChange={onChange} />
      <ParamRow label="Aux Output 2" configKey="auxOutput2Function" config={config} onChange={onChange} />
      <ParamRow label="Shift Light RPM" configKey="shiftLightRpm" config={config} onChange={onChange} unit="rpm" step={100} min={4000} />
      <ParamRow label="Shift Light Flash" configKey="shiftLightFlashRpm" config={config} onChange={onChange} unit="rpm" step={100} min={4000} />

      <SectionLabel title="Dash / Gauges" />
      <ParamRow label="Tach Range" configKey="tachometerRange" config={config} onChange={onChange} unit="RPM" step={1000} min={6000} />
      <ParamRow label="Speedo Range" configKey="speedometerRange" config={config} onChange={onChange} unit="MPH" step={10} min={100} />
      <ParamRow label="Shift Light" configKey="shiftLightEnabled" config={config} onChange={onChange} />
      <ParamRow label="Shift Light Color" configKey="shiftLightColor" config={config} onChange={onChange} />
      <ParamRow label="Boost Gauge" configKey="boostGaugeEnabled" config={config} onChange={onChange} />
      <ParamRow label="AFR Gauge" configKey="afrGaugeEnabled" config={config} onChange={onChange} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════

interface CategoryMenuBarProps {
  config: EcuConfig;
  onChange: (key: ConfigKey, value: any) => void;
  onConfigReplace: (config: EcuConfig) => void;
}

export function CategoryMenuBar({ config, onChange, onConfigReplace }: CategoryMenuBarProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>(() => getAllPresets());
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const t = useTheme();

  // Initialize undo stack on mount
  useEffect(() => { pushUndo(config); }, []);

  const refreshPresets = useCallback(() => {
    setPresets(getAllPresets());
  }, []);

  const toggleCategory = useCallback((id: CategoryId) => {
    setActiveCategory(prev => prev === id ? null : id);
    setPresetsOpen(false);
  }, []);

  // ── Preset handlers ──
  const handleLoadPreset = useCallback((preset: Preset) => {
    const newConfig = { ...preset.config };
    onConfigReplace(newConfig);
    pushUndo(newConfig);
    setActivePreset(preset.name);
    setSaveMsg(`Loaded: ${preset.name}`);
    setTimeout(() => setSaveMsg(""), 2000);
  }, [onConfigReplace]);

  const handleReset = useCallback(() => {
    const defaults = getDefaultEcuConfig();
    onConfigReplace(defaults);
    pushUndo(defaults);
    setActivePreset("Stock B16A2");
  }, [onConfigReplace]);

  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev) { onConfigReplace(prev); }
  }, [onConfigReplace]);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) { onConfigReplace(next); }
  }, [onConfigReplace]);

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
      onConfigReplace(imported);
      pushUndo(imported);
      setSaveMsg("Config imported");
      setTimeout(() => setSaveMsg(""), 2000);
    }
  }, [onConfigReplace]);

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

  // Wrap onChange with undo push
  const handleParamChange = useCallback((key: ConfigKey, value: any) => {
    onChange(key, value);
    // Defer undo push so config state is up to date
    setTimeout(() => pushUndo({ ...config, [key]: value }), 0);
  }, [onChange, config]);

  const renderPanel = () => {
    switch (activeCategory) {
      case 'engine': return <EnginePanel config={config} onChange={handleParamChange} />;
      case 'fuel': return <FuelIgnPanel config={config} onChange={handleParamChange} />;
      case 'boost': return <BoostPanel config={config} onChange={handleParamChange} />;
      case 'drivetrain': return <DrivetrainPanel config={config} onChange={handleParamChange} />;
      case 'suspension': return <ChassisPanel config={config} onChange={handleParamChange} />;
      case 'sensors': return <SensorsPanel config={config} onChange={handleParamChange} />;
      default: return null;
    }
  };

  return (
    <>
      {/* ── Presets / Engine Swaps toolbar ── */}
      <div className="px-2 pt-1 pb-0.5 flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => { setPresetsOpen(o => !o); if (!presetsOpen) setActiveCategory(null); }}
          className="flex items-center gap-1 px-2 py-1.5 text-[9px] tracking-[0.15em] uppercase font-mono border whitespace-nowrap transition-colors shrink-0"
          style={{
            borderColor: presetsOpen ? '#f59e0b' : t.borderFaint,
            background: presetsOpen ? 'rgba(245,158,11,0.08)' : 'transparent',
            color: presetsOpen ? '#f59e0b' : t.textDim,
          }}
          data-testid="menu-presets"
        >
          <span>🏎</span>
          <span>PRESETS</span>
        </button>
        <button onClick={handleUndo} disabled={!canUndo()} className="text-[10px] font-mono border px-1.5 py-1 shrink-0 disabled:opacity-20" style={{ borderColor: t.borderFaint, color: t.textDim }} title="Undo">↩</button>
        <button onClick={handleRedo} disabled={!canRedo()} className="text-[10px] font-mono border px-1.5 py-1 shrink-0 disabled:opacity-20" style={{ borderColor: t.borderFaint, color: t.textDim }} title="Redo">↪</button>
        <button onClick={handleShare} className="text-[10px] font-mono border border-cyan-500/30 text-cyan-400/80 px-1.5 py-1 shrink-0" title="Copy share URL">🔗</button>
        <button onClick={handleExport} className="text-[10px] font-mono border px-1.5 py-1 shrink-0" style={{ borderColor: t.borderFaint, color: t.textDim }} title="Export JSON">⬇</button>
        <button onClick={handleImport} className="text-[10px] font-mono border px-1.5 py-1 shrink-0" style={{ borderColor: t.borderFaint, color: t.textDim }} title="Import JSON">⬆</button>
        <button onClick={handleReset} className="text-[10px] font-mono border px-1.5 py-1 shrink-0" style={{ borderColor: t.borderFaint, color: t.textDim }} title="Reset to stock">DEFAULTS</button>
        {shareMsg && <span className="text-[9px] font-mono text-cyan-400 animate-pulse shrink-0">{shareMsg}</span>}
        {saveMsg && <span className="text-[9px] font-mono text-green-400 animate-pulse shrink-0">{saveMsg}</span>}
        {activePreset && <span className="text-[9px] font-mono shrink-0 ml-auto" style={{ color: t.textDim }}>▸ {activePreset}</span>}
      </div>

      {/* ── Presets panel (engine swaps) ── */}
      {presetsOpen && (
        <div className="mx-2 mb-1 border p-2" style={{ borderColor: t.borderFaint, background: t.cardBg }}>
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
                />
                <button onClick={handleSavePreset} className="text-[9px] font-mono px-2 py-1 border" style={{ borderColor: t.inputBorder, color: t.textMuted }}>SAVE</button>
                <button onClick={() => { setShowSave(false); setSaveName(""); }} className="text-[9px] font-mono px-2 py-1 border" style={{ borderColor: t.borderFaint, color: t.textDim }}>CANCEL</button>
              </div>
            ) : (
              <button
                onClick={() => setShowSave(true)}
                className="text-[9px] font-mono px-2 py-1 border flex-1"
                style={{ borderColor: t.inputBorder, color: t.textDim }}
              >
                SAVE AS NEW
              </button>
            )}
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="px-2 pt-0.5 pb-0.5 flex gap-1 overflow-x-auto" data-testid="category-menu-bar" style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className="flex items-center gap-1 px-2 py-1.5 text-[9px] tracking-[0.15em] uppercase font-mono border whitespace-nowrap transition-colors shrink-0"
              style={{
                borderColor: isActive ? cat.color : t.borderFaint,
                background: isActive ? `${cat.color}15` : 'transparent',
                color: isActive ? cat.color : t.textDim,
              }}
              data-testid={`menu-${cat.id}`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active panel content */}
      {activeCategory && (
        <div className="mx-2 mb-1 max-h-[60vh] overflow-y-auto border" style={{ borderColor: t.borderFaint, background: t.cardBg, scrollbarWidth: 'thin' }} data-testid={`panel-${activeCategory}`}>
          {renderPanel()}
          <div className="h-2" />
        </div>
      )}
    </>
  );
}
