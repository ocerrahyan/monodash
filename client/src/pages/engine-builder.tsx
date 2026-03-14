import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from "react";
import { type EcuConfig } from "@/lib/engineSim";
import { sharedSim } from "@/lib/sharedSim";
import { NavBar } from "@/components/NavBar";
import { useTheme } from "@/lib/theme";
import { logPageNav } from "@/lib/actionLogger";
import {
  ENGINE_PRESETS,
  type EngineBuilderOverrides,
  computeEngineGeometry,
} from "@/components/DrivetrainView3D";

const DrivetrainView3D = lazy(() =>
  import("@/components/DrivetrainView3D").then((m) => ({
    default: m.DrivetrainView3D,
  }))
);

interface SliderDef {
  key: keyof EngineBuilderOverrides;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultVal: (cfg: EcuConfig) => number;
}

const SLIDER_GROUPS: { title: string; sliders: SliderDef[] }[] = [
  {
    title: "CYLINDER BLOCK",
    sliders: [
      { key: "boreMm", label: "Bore", unit: "mm", min: 60, max: 130, step: 0.5, defaultVal: (c) => c.boreMm },
      { key: "strokeMm", label: "Stroke", unit: "mm", min: 50, max: 120, step: 0.5, defaultVal: (c) => c.strokeMm },
      { key: "numCylinders", label: "Cylinders", unit: "", min: 1, max: 12, step: 1, defaultVal: (c) => c.numCylinders },
      { key: "connectingRodLenMm", label: "Con-Rod Length", unit: "mm", min: 80, max: 200, step: 1, defaultVal: (c) => c.connectingRodLenMm },
      { key: "deckHeightMm", label: "Deck Height", unit: "mm", min: 150, max: 280, step: 1, defaultVal: (c) => c.deckHeightMm },
    ],
  },
  {
    title: "VALVETRAIN",
    sliders: [
      { key: "intakeValveDiaMm", label: "Intake Valve Dia", unit: "mm", min: 20, max: 55, step: 0.5, defaultVal: (c) => c.intakeValveDiaMm },
      { key: "exhaustValveDiaMm", label: "Exhaust Valve Dia", unit: "mm", min: 18, max: 48, step: 0.5, defaultVal: (c) => c.exhaustValveDiaMm },
      { key: "valveStemDiaMm", label: "Valve Stem Dia", unit: "mm", min: 4, max: 10, step: 0.1, defaultVal: (c) => c.valveStemDiaMm },
    ],
  },
  {
    title: "COMPRESSION",
    sliders: [
      { key: "compressionRatio", label: "Compression Ratio", unit: ":1", min: 6, max: 16, step: 0.1, defaultVal: (c) => c.compressionRatio },
    ],
  },
];

export default function EngineBuilderPage() {
  const t = useTheme();
  const [config, setConfig] = useState<EcuConfig>(() => sharedSim.getEcuConfig());

  useEffect(() => { logPageNav("engine-builder"); }, []);

  // Build overrides from current slider state
  const [overrides, setOverrides] = useState<EngineBuilderOverrides>(() => ({
    boreMm: config.boreMm,
    strokeMm: config.strokeMm,
    numCylinders: config.numCylinders,
    connectingRodLenMm: config.connectingRodLenMm,
    deckHeightMm: config.deckHeightMm,
    intakeValveDiaMm: config.intakeValveDiaMm,
    exhaustValveDiaMm: config.exhaustValveDiaMm,
    valveStemDiaMm: config.valveStemDiaMm,
    compressionRatio: config.compressionRatio,
  }));

  // Derived specs
  const derivedSpecs = useMemo(() => {
    const b = overrides.boreMm ?? config.boreMm;
    const s = overrides.strokeMm ?? config.strokeMm;
    const n = overrides.numCylinders ?? config.numCylinders;
    const cr = overrides.compressionRatio ?? config.compressionRatio;
    const dispCc = (Math.PI / 4) * (b ** 2) * s * n / 1000;
    const dispL = dispCc / 1000;
    const bsRatio = b / s;
    return { dispCc: Math.round(dispCc), dispL: dispL.toFixed(2), bsRatio: bsRatio.toFixed(2), cr: cr.toFixed(1) };
  }, [overrides, config]);

  // Get active engine preset for the 3D view
  const activePreset = useMemo(
    () => ENGINE_PRESETS.find((p) => p.id === config.engineId) || ENGINE_PRESETS[0],
    [config.engineId]
  );

  const handleSlider = useCallback(
    (key: keyof EngineBuilderOverrides, value: number) => {
      setOverrides((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Apply to sim: write overrides into ecuConfig so the running sim also reflects changes
  const handleApply = useCallback(() => {
    const next: EcuConfig = {
      ...config,
      boreMm: overrides.boreMm ?? config.boreMm,
      strokeMm: overrides.strokeMm ?? config.strokeMm,
      numCylinders: overrides.numCylinders ?? config.numCylinders,
      connectingRodLenMm: overrides.connectingRodLenMm ?? config.connectingRodLenMm,
      deckHeightMm: overrides.deckHeightMm ?? config.deckHeightMm,
      intakeValveDiaMm: overrides.intakeValveDiaMm ?? config.intakeValveDiaMm,
      exhaustValveDiaMm: overrides.exhaustValveDiaMm ?? config.exhaustValveDiaMm,
      valveStemDiaMm: overrides.valveStemDiaMm ?? config.valveStemDiaMm,
      compressionRatio: overrides.compressionRatio ?? config.compressionRatio,
      displacementCc: derivedSpecs.dispCc,
    };
    sharedSim.setEcuConfig(next);
    setConfig(next);
  }, [config, overrides, derivedSpecs]);

  // Reset overrides back to whatever the current sim config is
  const handleReset = useCallback(() => {
    const c = sharedSim.getEcuConfig();
    setConfig(c);
    setOverrides({
      boreMm: c.boreMm,
      strokeMm: c.strokeMm,
      numCylinders: c.numCylinders,
      connectingRodLenMm: c.connectingRodLenMm,
      deckHeightMm: c.deckHeightMm,
      intakeValveDiaMm: c.intakeValveDiaMm,
      exhaustValveDiaMm: c.exhaustValveDiaMm,
      valveStemDiaMm: c.valveStemDiaMm,
      compressionRatio: c.compressionRatio,
    });
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: t.bg, color: t.text }}>
      <NavBar />

      {/* Header */}
      <div
        style={{
          padding: "8px 16px",
          borderBottom: `1px solid ${t.borderFaint}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "'Inter', system-ui, sans-serif",
              color: t.accent,
              margin: 0,
            }}
          >
            ENGINE BUILDER
          </h1>
          <span style={{ fontSize: 10, color: t.textDim, fontFamily: "monospace" }}>
            Base: {activePreset.name} — {activePreset.layout}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleReset}
            style={{
              padding: "4px 12px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              border: `1px solid ${t.borderFaint}`,
              borderRadius: 4,
              background: "transparent",
              color: t.textDim,
              cursor: "pointer",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            RESET
          </button>
          <button
            onClick={handleApply}
            style={{
              padding: "4px 12px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              border: `1px solid ${t.accent}`,
              borderRadius: 4,
              background: t.accent,
              color: "#fff",
              cursor: "pointer",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            APPLY TO SIM
          </button>
        </div>
      </div>

      {/* Main content: stacked on mobile (3D top, sliders bottom), side-by-side on desktop */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* 3D engine view — top on mobile */}
        <div
          className="engine-builder-3d"
          style={{
            position: "relative",
            minHeight: 220,
            height: "40vh",
            flexShrink: 0,
            borderBottom: `1px solid ${t.borderFaint}`,
          }}
        >
          <Suspense
            fallback={
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: t.textDim,
                  fontFamily: "monospace",
                  fontSize: 11,
                }}
              >
                Loading 3D engine view...
              </div>
            }
          >
            <DrivetrainView3D
              tireRpm={0}
              rpm={900}
              clutchStatus="engaged"
              clutchSlipPct={0}
              currentGear={0}
              currentGearRatio={1}
              slipPct={0}
              drivetrainType="fwd"
              accelerationG={0}
              throttle={5}
              engineId={config.engineId}
              numCylinders={overrides.numCylinders ?? config.numCylinders}
              redlineRpm={config.redlineRpm}
              gearRatios={config.gearRatios}
              finalDriveRatio={config.finalDriveRatio}
              transmissionModel={config.transmissionModel}
              tireWidthMm={config.tireWidthMm}
              tireAspectRatio={config.tireAspectRatio}
              wheelDiameterIn={config.tireWheelDiameterIn}
              speedMph={0}
              topSpeedMode={false}
              quarterMileLaunched={false}
              quarterMileActive={false}
              distanceFt={0}
              engineOverrides={overrides}
            />
          </Suspense>
        </div>

        {/* Sliders panel — scrollable below 3D view */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 16px",
          }}
        >
          {/* Derived specs summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px 12px",
              marginBottom: 16,
              padding: "8px 10px",
              borderRadius: 6,
              background: t.cardBg,
              border: `1px solid ${t.borderFaint}`,
            }}
          >
            <SpecItem label="Displacement" value={`${derivedSpecs.dispCc} cc`} accent={t.accent} dim={t.textDim} />
            <SpecItem label="Liters" value={`${derivedSpecs.dispL} L`} accent={t.accent} dim={t.textDim} />
            <SpecItem label="B/S Ratio" value={derivedSpecs.bsRatio} accent={t.accent} dim={t.textDim} />
            <SpecItem label="Compression" value={`${derivedSpecs.cr}:1`} accent={t.accent} dim={t.textDim} />
          </div>

          {SLIDER_GROUPS.map((group) => (
            <div key={group.title} style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: t.textDim,
                  marginBottom: 8,
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                {group.title}
              </div>
              {group.sliders.map((sd) => {
                const val = (overrides[sd.key] as number) ?? sd.defaultVal(config);
                return (
                  <BuilderSlider
                    key={sd.key}
                    label={sd.label}
                    unit={sd.unit}
                    min={sd.min}
                    max={sd.max}
                    step={sd.step}
                    value={val}
                    onChange={(v) => handleSlider(sd.key, v)}
                    accent={t.accent}
                    textDim={t.textDim}
                    borderFaint={t.borderFaint}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Tiny spec readout ── */
function SpecItem({ label, value, accent, dim }: { label: string; value: string; accent: string; dim: string }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: dim, letterSpacing: "0.08em", fontFamily: "'Inter', system-ui, sans-serif" }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

/* ── Slider row component ── */
function BuilderSlider({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
  accent,
  textDim,
  borderFaint,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  accent: string;
  textDim: string;
  borderFaint: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 2,
        }}
      >
        <span style={{ fontSize: 10, color: textDim, fontFamily: "'Inter', system-ui, sans-serif" }}>
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: accent }}>
          {step < 1 ? value.toFixed(1) : value}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: "100%",
          appearance: "none",
          height: 4,
          borderRadius: 2,
          background: borderFaint,
          outline: "none",
          cursor: "pointer",
          accentColor: accent,
        }}
      />
    </div>
  );
}
