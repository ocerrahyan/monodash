import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { type EcuConfig, getDefaultEcuConfig } from "@/lib/engineSim";
import { sharedSim } from "@/lib/sharedSim";
import { getAllPresets, savePreset, deletePreset, type Preset, configToShareUrl, exportConfigToFile, importConfigFromFile, pushUndo, undo, redo, canUndo, canRedo } from "@/lib/presets";

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
    case "pistonType": return ["cast", "hypereutectic", "forged"];
    case "crankshaftType": return ["cast", "forged", "billet"];
    case "oilGrade": return ["0w20", "5w30", "5w40", "10w30", "10w40", "15w50"];
    case "timingChainType": return ["chain", "belt", "gear"];
    case "intakeType": return ["stock", "short_ram", "cold_air", "velocity_stack", "itb"];
    case "intakeFilterType": return ["paper", "oiled_cotton", "foam", "mesh"];
    case "throttleBodyType": return ["single", "dual", "itb"];
    case "intakeManifoldType": return ["stock", "ported", "aftermarket", "custom"];
    case "exhaustHeaderType": return ["stock_manifold", "4_1_header", "4_2_1_header", "equal_length"];
    case "exhaustMufflerType": return ["stock", "performance", "straight_through", "delete"];
    case "exhaustCatbackType": return ["single", "dual"];
    case "radiatorType": return ["stock", "aluminum_2row", "aluminum_3row", "half_size"];
    case "coolantType": return ["water", "green", "red_oat", "waterless"];
    case "waterPumpType": return ["mechanical", "electric"];
    case "transmissionType": return ["manual", "auto_torqueconv", "sequential", "dct"];
    case "clutchType": return ["oem_organic", "stage1_organic", "stage2_kevlar", "stage3_cerametallic", "stage4_puck", "twin_disc"];
    case "flywheelType": return ["oem_dual_mass", "oem_single", "lightweight_chromoly", "aluminum"];
    case "synchronizerType": return ["brass", "carbon", "dog_engagement"];
    case "transFluidType": return ["oem_mtf", "redline_mtl", "amsoil_mtf", "gl4_75w90"];
    case "shifterCableBushingType": return ["oem_rubber", "polyurethane", "spherical"];
    case "wheelBoltPattern": return ["4x100", "4x114", "5x114"];
    case "wheelMaterialType": return ["steel", "alloy_cast", "alloy_forged", "carbon"];
    case "spareTireType": return ["full_size", "compact", "none"];
    case "brakeBoosterType": return ["vacuum", "hydraulic", "none"];
    case "brakeLineType": return ["rubber", "stainless_braided", "hard_line"];
    case "brakeFluidType": return ["dot3", "dot4", "dot5_1", "racing"];
    case "parkingBrakeType": return ["drum_in_hat", "caliper_ebrake", "hydraulic"];
    case "frontRotorType": return ["solid", "vented", "drilled", "slotted", "drilled_slotted"];
    case "rearRotorType": return ["solid", "drum", "vented"];
    case "rollCageType": return ["none", "harness_bar", "4_point", "6_point", "10_point"];
    case "harnessType": return ["oem_3point", "4_point", "5_point", "6_point"];
    case "fireExtinguisherType": return ["none", "handheld", "plumbed"];
    case "fuelCellType": return ["oem_tank", "fia_cell_5gal", "fia_cell_10gal", "fia_cell_15gal"];
    case "chassisType": return ["unibody", "welded_cage", "tube_frame"];
    case "hoodType": return ["oem_steel", "aluminum", "carbon", "fiberglass"];
    case "trunkType": return ["oem_steel", "carbon", "fiberglass", "delete"];
    case "frontBumperType": return ["oem", "delete", "lightweight_frp", "carbon"];
    case "rearBumperType": return ["oem", "delete", "lightweight_frp", "carbon"];
    case "fenderType": return ["oem", "rolled", "pulled", "wide_body"];
    case "windowType": return ["oem_glass", "polycarbonate", "lexan"];
    case "windshieldType": return ["oem", "lightweight"];
    case "ignitionCoilType": return ["oem_distributor", "cop", "cnp", "msd_external"];
    case "sparkPlugType": return ["copper", "platinum", "iridium"];
    case "wiringHarnessType": return ["oem", "mil_spec", "budget_race"];
    case "mainRelayType": return ["oem", "aftermarket"];
    case "frontStrutTopMountType": return ["oem_rubber", "pillow_ball", "spherical"];
    case "rearTopMountType": return ["oem_rubber", "pillow_ball", "spherical"];
    case "sideSkirtType": return ["none", "oem", "aero"];
    case "rearWingType": return ["none", "lip", "duckbill", "gt_wing", "swan_neck"];
    case "frontSplitterMaterialType": return ["abs", "carbon", "aluminum"];
    case "interiorColor": return ["black", "gray"];
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

      // ── AWD auto-population ──────────────────────────────────────
      // When drivetrain type changes, auto-set sensible defaults for the
      // newly-relevant subsystems so the user doesn't start with dead values.
      if (key === 'drivetrainType') {
        const dt = value as string;
        if (dt === 'AWD') {
          // Honda CRV / AWD swap defaults
          next.rearDiffType = prev.rearDiffType === 'open' ? 'viscous' as any : prev.rearDiffType;
          next.centerDiffType = 'viscous' as any;
          next.awdFrontBias = 0.6;
          next.drivetrainLossPct = 18;  // AWD has ~18% loss
        } else if (dt === 'RWD') {
          next.rearDiffType = prev.rearDiffType === 'open' ? 'lsd' as any : prev.rearDiffType;
          next.drivetrainLossPct = 15;
        } else {
          // FWD defaults
          next.drivetrainLossPct = 12;
        }
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
  const [shareMsg, setShareMsg] = useState("");
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
    exportConfigToFile(config, 'vehicle-config');
  }, [config]);
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
        <div className="flex items-center gap-1">
          <button onClick={handleUndo} disabled={!canUndo()} className="text-[10px] font-mono border border-white/20 px-1.5 py-0.5 opacity-60 hover:opacity-100 disabled:opacity-20" title="Undo">↩</button>
          <button onClick={handleRedo} disabled={!canRedo()} className="text-[10px] font-mono border border-white/20 px-1.5 py-0.5 opacity-60 hover:opacity-100 disabled:opacity-20" title="Redo">↪</button>
          <button onClick={handleShare} className="text-[10px] font-mono border border-cyan-500/30 text-cyan-400/80 px-1.5 py-0.5" title="Copy share URL">🔗</button>
          <button onClick={handleExport} className="text-[10px] font-mono border border-white/20 px-1.5 py-0.5 opacity-60 hover:opacity-100" title="Export JSON">⬇</button>
          <button onClick={handleImport} className="text-[10px] font-mono border border-white/20 px-1.5 py-0.5 opacity-60 hover:opacity-100" title="Import JSON">⬆</button>
        </div>
        {shareMsg && <span className="text-[9px] font-mono text-cyan-400 animate-pulse">{shareMsg}</span>}
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

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── ENGINE INTERNALS (B16A2) ─────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Engine Internals (B16A2)" color="#ef4444" defaultOpen={false}>
          <ParamRow label="Bore" configKey="boreMm" config={config} onChange={handleChange} unit="mm" step={0.5} min={70} testId="veh-bore" />
          <ParamRow label="Stroke" configKey="strokeMm" config={config} onChange={handleChange} unit="mm" step={0.5} min={60} testId="veh-stroke" />
          <ParamRow label="Displacement" configKey="displacementCc" config={config} onChange={handleChange} unit="cc" step={10} min={500} testId="veh-displacement" />
          <ParamRow label="Cylinders" configKey="numCylinders" config={config} onChange={handleChange} unit="#" step={1} min={1} testId="veh-num-cyl" />
          <ParamRow label="Rod Length" configKey="connectingRodLenMm" config={config} onChange={handleChange} unit="mm" step={1} min={100} testId="veh-rod-len" />
          <ParamRow label="Piston Type" configKey="pistonType" config={config} onChange={handleChange} testId="veh-piston-type" />
          <ParamRow label="Ring Gap" configKey="pistonRingGapMm" config={config} onChange={handleChange} unit="mm" step={0.01} min={0.1} testId="veh-ring-gap" />
          <ParamRow label="Crank Type" configKey="crankshaftType" config={config} onChange={handleChange} testId="veh-crank-type" />
          <ParamRow label="Bearing Clearance" configKey="bearingClearanceMm" config={config} onChange={handleChange} unit="mm" step={0.005} min={0.01} testId="veh-bearing-clr" />
          <ParamRow label="Oil Grade" configKey="oilGrade" config={config} onChange={handleChange} testId="veh-oil-grade" />
          <ParamRow label="Head Gasket Thick" configKey="headGasketThickMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={0.3} testId="veh-hg-thick" />
          <ParamRow label="HG Bore Dia" configKey="headGasketBoreDiaMm" config={config} onChange={handleChange} unit="mm" step={0.5} min={75} testId="veh-hg-bore" />
          <ParamRow label="Deck Height" configKey="deckHeightMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={180} testId="veh-deck-ht" />
          <ParamRow label="Chamber CC" configKey="combustionChamberCc" config={config} onChange={handleChange} unit="cc" step={0.5} min={30} testId="veh-chamber-cc" />
          <ParamRow label="Valves/Cyl" configKey="valvesPerCylinder" config={config} onChange={handleChange} unit="#" step={1} min={2} testId="veh-valves-cyl" />
          <ParamRow label="Intake Valve Dia" configKey="intakeValveDiaMm" config={config} onChange={handleChange} unit="mm" step={0.5} min={25} testId="veh-intake-valve" />
          <ParamRow label="Exhaust Valve Dia" configKey="exhaustValveDiaMm" config={config} onChange={handleChange} unit="mm" step={0.5} min={20} testId="veh-exhaust-valve" />
          <ParamRow label="Valve Stem Dia" configKey="valveStemDiaMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={4} testId="veh-valve-stem" />
          <ParamRow label="Valve Spring Pressure" configKey="valveSpringPressureLb" config={config} onChange={handleChange} unit="lb" step={2} min={20} testId="veh-valve-spring" />
          <ParamRow label="Rocker Ratio" configKey="rockerArmRatio" config={config} onChange={handleChange} unit=":1" step={0.05} min={0.8} testId="veh-rocker-ratio" />
          <ParamRow label="Timing Drive" configKey="timingChainType" config={config} onChange={handleChange} testId="veh-timing-type" />
          <ParamRow label="Balance Shaft" configKey="balanceShaftEnabled" config={config} onChange={handleChange} testId="veh-balance-shaft" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── INTAKE SYSTEM ────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Intake System" color="#ef4444" defaultOpen={false}>
          <ParamRow label="Intake Type" configKey="intakeType" config={config} onChange={handleChange} testId="veh-intake-type" />
          <ParamRow label="Filter Type" configKey="intakeFilterType" config={config} onChange={handleChange} testId="veh-filter-type" />
          <ParamRow label="Pipe Diameter" configKey="intakePipeDiaMm" config={config} onChange={handleChange} unit="mm" step={2} min={38} testId="veh-intake-pipe" />
          <ParamRow label="Throttle Body Dia" configKey="throttleBodyDiaMm" config={config} onChange={handleChange} unit="mm" step={2} min={50} testId="veh-tb-dia" />
          <ParamRow label="TB Type" configKey="throttleBodyType" config={config} onChange={handleChange} testId="veh-tb-type" />
          <ParamRow label="Manifold Type" configKey="intakeManifoldType" config={config} onChange={handleChange} testId="veh-manifold-type" />
          <ParamRow label="Runner Length" configKey="intakeManifoldRunnerLenMm" config={config} onChange={handleChange} unit="mm" step={10} min={100} testId="veh-runner-len" />
          <ParamRow label="Plenum Volume" configKey="intakeManifoldPlenumVolCc" config={config} onChange={handleChange} unit="cc" step={100} min={500} testId="veh-plenum-vol" />
          <ParamRow label="Resonator" configKey="intakeResonatorEnabled" config={config} onChange={handleChange} testId="veh-intake-resonator" />
          <ParamRow label="IAC Bypass" configKey="idleAirBypassEnabled" config={config} onChange={handleChange} testId="veh-iac-bypass" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── EXHAUST SYSTEM ───────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Exhaust System" color="#ef4444" defaultOpen={false}>
          <ParamRow label="Header Type" configKey="exhaustHeaderType" config={config} onChange={handleChange} testId="veh-header-type" />
          <ParamRow label="Primary Dia" configKey="exhaustHeaderPrimaryDiaMm" config={config} onChange={handleChange} unit="mm" step={2} min={30} testId="veh-header-primary" />
          <ParamRow label="Primary Length" configKey="exhaustHeaderPrimaryLenMm" config={config} onChange={handleChange} unit="mm" step={10} min={200} testId="veh-header-pri-len" />
          <ParamRow label="Collector Dia" configKey="exhaustHeaderCollectorDiaMm" config={config} onChange={handleChange} unit="mm" step={2} min={38} testId="veh-header-coll" />
          <ParamRow label="Exhaust Pipe Dia" configKey="exhaustPipeDiaMm" config={config} onChange={handleChange} unit="mm" step={2} min={38} testId="veh-exhaust-pipe" />
          <ParamRow label="Muffler Type" configKey="exhaustMufflerType" config={config} onChange={handleChange} testId="veh-muffler-type" />
          <ParamRow label="Resonator" configKey="exhaustResonatorEnabled" config={config} onChange={handleChange} testId="veh-exhaust-resonator" />
          <ParamRow label="Catback Type" configKey="exhaustCatbackType" config={config} onChange={handleChange} testId="veh-catback-type" />
          <ParamRow label="Tip Diameter" configKey="exhaustTipDiaMm" config={config} onChange={handleChange} unit="mm" step={5} min={38} testId="veh-exhaust-tip" />
          <ParamRow label="Backpressure" configKey="exhaustBackpressureKpa" config={config} onChange={handleChange} unit="kPa" step={1} min={0} testId="veh-backpressure" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── COOLING SYSTEM ───────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Cooling System" color="#06b6d4" defaultOpen={false}>
          <ParamRow label="Radiator Type" configKey="radiatorType" config={config} onChange={handleChange} testId="veh-radiator-type" />
          <ParamRow label="Rad Cap Pressure" configKey="radiatorCapPsi" config={config} onChange={handleChange} unit="PSI" step={1} min={10} testId="veh-rad-cap" />
          <ParamRow label="Thermostat Open" configKey="thermostatOpenTempF" config={config} onChange={handleChange} unit="°F" step={5} min={140} testId="veh-tstat-open" />
          <ParamRow label="Thermostat Full" configKey="thermostatFullOpenTempF" config={config} onChange={handleChange} unit="°F" step={5} min={160} testId="veh-tstat-full" />
          <ParamRow label="Coolant Type" configKey="coolantType" config={config} onChange={handleChange} testId="veh-coolant-type" />
          <ParamRow label="Coolant Mix %" configKey="coolantMixPct" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="veh-coolant-mix" />
          <ParamRow label="Water Pump" configKey="waterPumpType" config={config} onChange={handleChange} testId="veh-water-pump" />
          <ParamRow label="Oil Cooler" configKey="oilCoolerEnabled" config={config} onChange={handleChange} testId="veh-oil-cooler" />
          {config.oilCoolerEnabled && (
            <ParamRow label="Oil Cooler Rows" configKey="oilCoolerRowCount" config={config} onChange={handleChange} unit="rows" step={1} min={1} testId="veh-oil-cooler-rows" />
          )}
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── TRANSMISSION EXTENDED ────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Transmission Details (S4C)" color="#f97316" defaultOpen={false}>
          <ParamRow label="Trans Type" configKey="transmissionType" config={config} onChange={handleChange} testId="veh-trans-type" />
          <ParamRow label="Clutch Type" configKey="clutchType" config={config} onChange={handleChange} testId="veh-clutch-type" />
          <ParamRow label="Clutch Spring" configKey="clutchSpringPressureLb" config={config} onChange={handleChange} unit="lb" step={100} min={500} testId="veh-clutch-spring" />
          <ParamRow label="Flywheel Type" configKey="flywheelType" config={config} onChange={handleChange} testId="veh-fw-type" />
          <ParamRow label="Flywheel Mass" configKey="flywheelMassLb" config={config} onChange={handleChange} unit="lbs" step={1} min={4} testId="veh-fw-mass" />
          <ParamRow label="Synchro Type" configKey="synchronizerType" config={config} onChange={handleChange} testId="veh-synchro-type" />
          <ParamRow label="Trans Fluid" configKey="transFluidType" config={config} onChange={handleChange} testId="veh-trans-fluid" />
          <ParamRow label="Fluid Temp Warning" configKey="transFluidTempWarningF" config={config} onChange={handleChange} unit="°F" step={10} min={200} testId="veh-trans-temp" />
          <ParamRow label="LSD Preload" configKey="limitedSlipPreload" config={config} onChange={handleChange} unit="lb·ft" step={5} min={0} testId="veh-lsd-preload" />
          <ParamRow label="Short Shifter" configKey="shortShifterInstalled" config={config} onChange={handleChange} testId="veh-short-shift" />
          <ParamRow label="Cable Bushing" configKey="shifterCableBushingType" config={config} onChange={handleChange} testId="veh-cable-bushing" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── WHEEL SPECS ──────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Wheel Specs (15×6 ET50 4×100)" color="#22c55e" defaultOpen={false}>
          <ParamRow label="Wheel Width" configKey="wheelWidthIn" config={config} onChange={handleChange} unit="in" step={0.5} min={4} testId="veh-wheel-width" />
          <ParamRow label="Offset (ET)" configKey="wheelOffsetMm" config={config} onChange={handleChange} unit="mm" step={2} min={15} testId="veh-wheel-offset" />
          <ParamRow label="Bolt Pattern" configKey="wheelBoltPattern" config={config} onChange={handleChange} testId="veh-bolt-pattern" />
          <ParamRow label="Center Bore" configKey="wheelCenterBoreMm" config={config} onChange={handleChange} unit="mm" step={0.1} min={50} testId="veh-center-bore" />
          <ParamRow label="Material" configKey="wheelMaterialType" config={config} onChange={handleChange} testId="veh-wheel-material" />
          <ParamRow label="Wheel Mass" configKey="wheelMassLb" config={config} onChange={handleChange} unit="lbs" step={1} min={5} testId="veh-wheel-mass" />
          <ParamRow label="Spare Tire" configKey="spareTireType" config={config} onChange={handleChange} testId="veh-spare-tire" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── TPMS ─────────────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Tire Pressure (TPMS)" color="#22c55e" defaultOpen={false}>
          <ParamRow label="TPMS Enabled" configKey="tpmsEnabled" config={config} onChange={handleChange} testId="veh-tpms-en" />
          <ParamRow label="FL Pressure" configKey="frontLeftPsi" config={config} onChange={handleChange} unit="PSI" step={1} min={20} testId="veh-fl-psi" />
          <ParamRow label="FR Pressure" configKey="frontRightPsi" config={config} onChange={handleChange} unit="PSI" step={1} min={20} testId="veh-fr-psi" />
          <ParamRow label="RL Pressure" configKey="rearLeftPsi" config={config} onChange={handleChange} unit="PSI" step={1} min={20} testId="veh-rl-psi" />
          <ParamRow label="RR Pressure" configKey="rearRightPsi" config={config} onChange={handleChange} unit="PSI" step={1} min={20} testId="veh-rr-psi" />
          <ParamRow label="Cold Target" configKey="tpmsColdPsi" config={config} onChange={handleChange} unit="PSI" step={1} min={24} testId="veh-tpms-cold" />
          <ParamRow label="Hot Delta" configKey="tpmsHotDeltaPsi" config={config} onChange={handleChange} unit="PSI" step={1} min={1} testId="veh-tpms-hot-delta" />
          <ParamRow label="Low Warning" configKey="tpmsLowWarningPsi" config={config} onChange={handleChange} unit="PSI" step={1} min={18} testId="veh-tpms-low" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── BRAKE EXTENDED ───────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Brake Details (Hydraulic)" color="#ef4444" defaultOpen={false}>
          <ParamRow label="Front Caliper Pistons" configKey="frontCaliperPistons" config={config} onChange={handleChange} unit="#" step={1} min={1} testId="veh-front-cal-pistons" />
          <ParamRow label="Rear Caliper Pistons" configKey="rearCaliperPistons" config={config} onChange={handleChange} unit="#" step={1} min={1} testId="veh-rear-cal-pistons" />
          <ParamRow label="Front Piston Dia" configKey="frontCaliperPistonDiaMm" config={config} onChange={handleChange} unit="mm" step={2} min={25} testId="veh-front-piston-dia" />
          <ParamRow label="Rear Piston Dia" configKey="rearCaliperPistonDiaMm" config={config} onChange={handleChange} unit="mm" step={2} min={20} testId="veh-rear-piston-dia" />
          <ParamRow label="Master Cyl Bore" configKey="masterCylBoreMm" config={config} onChange={handleChange} unit="mm" step={0.5} min={18} testId="veh-mc-bore" />
          <ParamRow label="Booster Type" configKey="brakeBoosterType" config={config} onChange={handleChange} testId="veh-booster-type" />
          <ParamRow label="Brake Lines" configKey="brakeLineType" config={config} onChange={handleChange} testId="veh-brake-line" />
          <ParamRow label="Brake Fluid" configKey="brakeFluidType" config={config} onChange={handleChange} testId="veh-brake-fluid" />
          <ParamRow label="Parking Brake" configKey="parkingBrakeType" config={config} onChange={handleChange} testId="veh-park-brake" />
          <ParamRow label="Front Rotor Type" configKey="frontRotorType" config={config} onChange={handleChange} testId="veh-front-rotor-type" />
          <ParamRow label="Rear Rotor Type" configKey="rearRotorType" config={config} onChange={handleChange} testId="veh-rear-rotor-type" />
          <ParamRow label="Front Rotor Thick" configKey="frontRotorThickMm" config={config} onChange={handleChange} unit="mm" step={1} min={10} testId="veh-front-rotor-thick" />
          <ParamRow label="Rear Rotor Thick" configKey="rearRotorThickMm" config={config} onChange={handleChange} unit="mm" step={1} min={5} testId="veh-rear-rotor-thick" />
          <ParamRow label="Brake Ducting" configKey="brakeDuctingEnabled" config={config} onChange={handleChange} testId="veh-brake-ducting" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── SUSPENSION EXTENDED ──────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Suspension Extended (Advanced)" color="#a855f7" defaultOpen={false}>
          <ParamRow label="Coilovers" configKey="coiloverEnabled" config={config} onChange={handleChange} testId="veh-coilover-en" />
          <ParamRow label="F Strut Mount" configKey="frontStrutTopMountType" config={config} onChange={handleChange} testId="veh-front-strut-mount" />
          <ParamRow label="R Top Mount" configKey="rearTopMountType" config={config} onChange={handleChange} testId="veh-rear-top-mount" />
          <ParamRow label="F Bump Stop Gap" configKey="frontBumpStopGapMm" config={config} onChange={handleChange} unit="mm" step={5} min={10} testId="veh-front-bump-gap" />
          <ParamRow label="R Bump Stop Gap" configKey="rearBumpStopGapMm" config={config} onChange={handleChange} unit="mm" step={5} min={10} testId="veh-rear-bump-gap" />
          <ParamRow label="F Spring Perch Ht" configKey="frontSpringPerchHeightMm" config={config} onChange={handleChange} unit="mm" step={5} min={80} testId="veh-front-perch" />
          <ParamRow label="R Spring Perch Ht" configKey="rearSpringPerchHeightMm" config={config} onChange={handleChange} unit="mm" step={5} min={80} testId="veh-rear-perch" />
          <ParamRow label="F Roll Center" configKey="frontRollCenterHeightMm" config={config} onChange={handleChange} unit="mm" step={5} min={0} testId="veh-front-roll-center" />
          <ParamRow label="R Roll Center" configKey="rearRollCenterHeightMm" config={config} onChange={handleChange} unit="mm" step={5} min={30} testId="veh-rear-roll-center" />
          <ParamRow label="Anti-Dive %" configKey="frontAntiDivePct" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="veh-anti-dive" />
          <ParamRow label="Anti-Squat %" configKey="rearAntiSquatPct" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="veh-anti-squat" />
          <ParamRow label="Corner Wt FL" configKey="cornerWeightFLlb" config={config} onChange={handleChange} unit="lb" step={5} min={400} testId="veh-cw-fl" />
          <ParamRow label="Corner Wt FR" configKey="cornerWeightFRlb" config={config} onChange={handleChange} unit="lb" step={5} min={400} testId="veh-cw-fr" />
          <ParamRow label="Corner Wt RL" configKey="cornerWeightRLlb" config={config} onChange={handleChange} unit="lb" step={5} min={200} testId="veh-cw-rl" />
          <ParamRow label="Corner Wt RR" configKey="cornerWeightRRlb" config={config} onChange={handleChange} unit="lb" step={5} min={200} testId="veh-cw-rr" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── AERO EXTENDED ────────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Aero Extended" color="#3b82f6" defaultOpen={false}>
          <ParamRow label="Rear Diffuser" configKey="rearDiffuserEnabled" config={config} onChange={handleChange} testId="veh-diffuser-en" />
          {config.rearDiffuserEnabled && (
            <ParamRow label="Diffuser Angle" configKey="rearDiffuserAngleDeg" config={config} onChange={handleChange} unit="°" step={1} min={5} testId="veh-diffuser-angle" />
          )}
          <ParamRow label="Side Skirts" configKey="sideSkirtType" config={config} onChange={handleChange} testId="veh-side-skirts" />
          <ParamRow label="Canards" configKey="canardEnabled" config={config} onChange={handleChange} testId="veh-canards-en" />
          <ParamRow label="Flat Undertray" configKey="flatUndertrayEnabled" config={config} onChange={handleChange} testId="veh-undertray" />
          <ParamRow label="Hood Vents" configKey="hoodVentsEnabled" config={config} onChange={handleChange} testId="veh-hood-vents" />
          <ParamRow label="Fender Vents" configKey="fenderVentsEnabled" config={config} onChange={handleChange} testId="veh-fender-vents" />
          <ParamRow label="Wing Type" configKey="rearWingType" config={config} onChange={handleChange} testId="veh-wing-type" />
          <ParamRow label="Splitter Material" configKey="frontSplitterMaterialType" config={config} onChange={handleChange} testId="veh-splitter-material" />
          <ParamRow label="Splitter Rods" configKey="splitterSupportRods" config={config} onChange={handleChange} testId="veh-splitter-rods" />
          <ParamRow label="Aero Balance" configKey="aeroBalancePct" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="veh-aero-balance" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── BODY / CHASSIS ───────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Body & Chassis (EM1)" color="#3b82f6" defaultOpen={false}>
          <ParamRow label="Chassis Type" configKey="chassisType" config={config} onChange={handleChange} testId="veh-chassis-type" />
          <ParamRow label="Seam Weld" configKey="seam_weldEnabled" config={config} onChange={handleChange} testId="veh-seam-weld" />
          <ParamRow label="Hood Type" configKey="hoodType" config={config} onChange={handleChange} testId="veh-hood-type" />
          <ParamRow label="Trunk Type" configKey="trunkType" config={config} onChange={handleChange} testId="veh-trunk-type" />
          <ParamRow label="Front Bumper" configKey="frontBumperType" config={config} onChange={handleChange} testId="veh-front-bumper" />
          <ParamRow label="Rear Bumper" configKey="rearBumperType" config={config} onChange={handleChange} testId="veh-rear-bumper" />
          <ParamRow label="Fender Type" configKey="fenderType" config={config} onChange={handleChange} testId="veh-fender-type" />
          <ParamRow label="Windows" configKey="windowType" config={config} onChange={handleChange} testId="veh-window-type" />
          <ParamRow label="Windshield" configKey="windshieldType" config={config} onChange={handleChange} testId="veh-windshield" />
          <ParamRow label="Rear Seat Delete" configKey="rearSeatDelete" config={config} onChange={handleChange} testId="veh-rear-seat-del" />
          <ParamRow label="Carpet Delete" configKey="carpetDelete" config={config} onChange={handleChange} testId="veh-carpet-del" />
          <ParamRow label="A/C Delete" configKey="acDelete" config={config} onChange={handleChange} testId="veh-ac-del" />
          <ParamRow label="P/S Delete" configKey="powerSteeringDelete" config={config} onChange={handleChange} testId="veh-ps-del" />
          <ParamRow label="Spare Delete" configKey="spareTireDelete" config={config} onChange={handleChange} testId="veh-spare-del" />
          <ParamRow label="Tow Hook Front" configKey="towHookFrontEnabled" config={config} onChange={handleChange} testId="veh-tow-front" />
          <ParamRow label="Tow Hook Rear" configKey="towHookRearEnabled" config={config} onChange={handleChange} testId="veh-tow-rear" />
          <ParamRow label="Brake Light Bar" configKey="brakeLightBarEnabled" config={config} onChange={handleChange} testId="veh-brake-light-bar" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── SAFETY SYSTEMS ───────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Safety Systems" color="#f59e0b" defaultOpen={false}>
          <ParamRow label="Roll Cage" configKey="rollCageType" config={config} onChange={handleChange} testId="veh-cage-type" />
          <ParamRow label="Harness" configKey="harnessType" config={config} onChange={handleChange} testId="veh-harness" />
          <ParamRow label="Fire Extinguisher" configKey="fireExtinguisherType" config={config} onChange={handleChange} testId="veh-fire-ext" />
          <ParamRow label="Kill Switch" configKey="killSwitchEnabled" config={config} onChange={handleChange} testId="veh-kill-switch" />
          <ParamRow label="Battery Disconnect" configKey="batteryDisconnectEnabled" config={config} onChange={handleChange} testId="veh-batt-disc" />
          <ParamRow label="Window Net" configKey="windowNetEnabled" config={config} onChange={handleChange} testId="veh-window-net" />
          <ParamRow label="Helmet Required" configKey="helmetRequired" config={config} onChange={handleChange} testId="veh-helmet" />
          <ParamRow label="Fuel Cell Type" configKey="fuelCellType" config={config} onChange={handleChange} testId="veh-fuel-cell" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── ELECTRICAL SYSTEM ────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Electrical System" color="#06b6d4" defaultOpen={false}>
          <ParamRow label="Battery Voltage" configKey="batteryVoltage" config={config} onChange={handleChange} unit="V" step={0.1} min={11} testId="veh-batt-v" />
          <ParamRow label="Alternator Amps" configKey="alternatorOutputAmps" config={config} onChange={handleChange} unit="A" step={5} min={40} testId="veh-alt-amps" />
          <ParamRow label="Ignition Coil" configKey="ignitionCoilType" config={config} onChange={handleChange} testId="veh-ign-coil" />
          <ParamRow label="Spark Plug" configKey="sparkPlugType" config={config} onChange={handleChange} testId="veh-spark-plug" />
          <ParamRow label="Heat Range" configKey="sparkPlugHeatRange" config={config} onChange={handleChange} unit="#" step={1} min={4} testId="veh-heat-range" />
          <ParamRow label="Wiring Harness" configKey="wiringHarnessType" config={config} onChange={handleChange} testId="veh-wiring" />
          <ParamRow label="Grounding Kit" configKey="groundingKitInstalled" config={config} onChange={handleChange} testId="veh-ground-kit" />
          <ParamRow label="Fan Relay Upgrade" configKey="relayFanUpgrade" config={config} onChange={handleChange} testId="veh-fan-relay" />
          <ParamRow label="Main Relay" configKey="mainRelayType" config={config} onChange={handleChange} testId="veh-main-relay" />
        </CollapsibleSection>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── COSMETIC / PAINT ─────────────────────────────────────── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <CollapsibleSection title="Cosmetic / Paint" color="#ec4899" defaultOpen={false}>
          <ParamRow label="Exterior Color" configKey="exteriorColor" config={config} onChange={handleChange} testId="veh-ext-color" />
          <ParamRow label="Interior Color" configKey="interiorColor" config={config} onChange={handleChange} testId="veh-int-color" />
          <ParamRow label="Sunroof Delete" configKey="sunroofDelete" config={config} onChange={handleChange} testId="veh-sunroof-del" />
          <ParamRow label="Window Tint" configKey="tintPct" config={config} onChange={handleChange} unit="%" step={5} min={0} testId="veh-tint" />
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
