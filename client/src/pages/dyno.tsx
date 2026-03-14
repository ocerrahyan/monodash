import { useState, useEffect, useCallback } from "react";
import { type EcuConfig } from "@/lib/engineSim";
import { sharedSim } from "@/lib/sharedSim";
import { DynoCurveEditor } from "@/components/DynoCurveEditor";
import { NavBar } from "@/components/NavBar";
import { useTheme } from "@/lib/theme";
import { logPageNav } from "@/lib/actionLogger";

export default function DynoPage() {
  const t = useTheme();
  const [config, setConfig] = useState<EcuConfig>(() => sharedSim.getEcuConfig());

  useEffect(() => { logPageNav('dyno'); }, []);

  // Sync from sim periodically for live RPM/torque/HP
  useEffect(() => {
    const id = setInterval(() => setConfig(sharedSim.getEcuConfig()), 500);
    return () => clearInterval(id);
  }, []);

  const handleMapChange = useCallback((map: [number, number][]) => {
    const next = { ...config, customTorqueMap: map };
    setConfig(next);
    sharedSim.setEcuConfig(next);
  }, [config]);

  const handleReset = useCallback(() => {
    const next = { ...config, customTorqueMap: null as any };
    setConfig(next);
    sharedSim.setEcuConfig(next);
  }, [config]);

  // Get live engine state for crosshair
  const state = sharedSim.getState();

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: t.bg, color: t.text }}>
      <NavBar />
      <div
        style={{
          padding: "12px 16px 8px",
          borderBottom: `1px solid ${t.borderFaint}`,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <h1
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: t.text,
            margin: 0,
          }}
        >
          DYNO LAB
        </h1>
        <p style={{ fontSize: 10, color: t.textDim, margin: "4px 0 0" }}>
          Edit torque curves and visualize power output
        </p>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
        <DynoCurveEditor
          customMap={config.customTorqueMap || null}
          onChange={handleMapChange}
          onReset={handleReset}
          currentRpm={state?.rpm}
          currentTorque={state?.torqueNm ? state.torqueNm * 0.7376 : undefined}
          currentHp={state?.hp}
          boostPsi={state?.boostPsi}
          turboEnabled={config.turboEnabled}
          superchargerEnabled={config.superchargerEnabled}
          nitrousHpAdder={config.nitrousHpAdder}
          nitrousEnabled={config.nitrousEnabled}
          engineId={config.engineId}
          redlineRpm={config.redlineRpm}
          fuelCutRpm={config.fuelCutRpm}
          numCylinders={config.numCylinders}
        />
      </div>
    </div>
  );
}
