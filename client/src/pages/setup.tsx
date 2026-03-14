import { useState, useEffect, useCallback } from "react";
import { type EcuConfig, getDefaultEcuConfig } from "@/lib/engineSim";
import { sharedSim } from "@/lib/sharedSim";
import { pushUndo, undo, redo, canUndo, canRedo, exportConfigToFile, importConfigFromFile } from "@/lib/presets";
import { CategoryMenuBar } from "@/components/CategoryMenuBar";
import { NavBar } from "@/components/NavBar";
import { useTheme } from "@/lib/theme";
import { logConfigChange, logPageNav } from "@/lib/actionLogger";

type ConfigKey = keyof EcuConfig;

export default function SetupPage() {
  const t = useTheme();
  const [config, setConfig] = useState<EcuConfig>(() => sharedSim.getEcuConfig());

  useEffect(() => { logPageNav('setup'); }, []);

  // Sync from sim on mount
  useEffect(() => {
    setConfig(sharedSim.getEcuConfig());
  }, []);

  const handleChange = useCallback((key: ConfigKey, value: any) => {
    pushUndo(config);
    const next = { ...config, [key]: value };
    setConfig(next);
    sharedSim.setEcuConfig(next);
    logConfigChange(key, (config as any)[key], value);
  }, [config]);

  const handleConfigReplace = useCallback((next: EcuConfig) => {
    pushUndo(config);
    setConfig(next);
    sharedSim.setEcuConfig(next);
  }, [config]);

  const handleUndo = useCallback(() => {
    const prev = undo();
    if (prev) { setConfig(prev); sharedSim.setEcuConfig(prev); }
  }, []);

  const handleRedo = useCallback(() => {
    const next = redo();
    if (next) { setConfig(next); sharedSim.setEcuConfig(next); }
  }, []);

  const handleExport = useCallback(() => {
    exportConfigToFile(config, 'mono5-config');
  }, [config]);

  const handleImport = useCallback(async () => {
    const imported = await importConfigFromFile();
    if (imported) {
      pushUndo(config);
      setConfig(imported);
      sharedSim.setEcuConfig(imported);
    }
  }, [config]);

  // Count modified params
  const stock = getDefaultEcuConfig();
  let modCount = 0;
  for (const k of Object.keys(stock) as ConfigKey[]) {
    if (JSON.stringify(config[k]) !== JSON.stringify(stock[k])) modCount++;
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: t.bg, color: t.text }}>
      <NavBar />
      {/* Setup toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          background: t.navBg,
          borderBottom: `1px solid ${t.borderFaint}`,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: modCount > 0 ? t.accent : t.textDim,
          }}
        >
          {modCount > 0 ? `${modCount} MODIFIED PARAMS` : "STOCK CONFIGURATION"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            onClick={handleUndo}
            disabled={!canUndo()}
            style={{
              fontSize: 10,
              padding: "3px 8px",
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 3,
              background: t.inputBg,
              color: canUndo() ? t.text : t.textDim,
              cursor: canUndo() ? "pointer" : "default",
              opacity: canUndo() ? 1 : 0.4,
              fontFamily: "inherit",
            }}
          >
            UNDO
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo()}
            style={{
              fontSize: 10,
              padding: "3px 8px",
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 3,
              background: t.inputBg,
              color: canRedo() ? t.text : t.textDim,
              cursor: canRedo() ? "pointer" : "default",
              opacity: canRedo() ? 1 : 0.4,
              fontFamily: "inherit",
            }}
          >
            REDO
          </button>
          <button
            onClick={handleImport}
            style={{
              fontSize: 10,
              padding: "3px 8px",
              border: `1px solid ${t.inputBorder}`,
              borderRadius: 3,
              background: t.inputBg,
              color: t.text,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            IMPORT
          </button>
          <button
            onClick={handleExport}
            style={{
              fontSize: 10,
              padding: "3px 8px",
              border: `1px solid ${t.accent}`,
              borderRadius: 3,
              background: "transparent",
              color: t.accent,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            EXPORT
          </button>
        </div>
      </div>
      {/* Config panels */}
      <div className="flex-1 overflow-y-auto">
        <CategoryMenuBar
          config={config}
          onChange={handleChange}
          onConfigReplace={handleConfigReplace}
        />
      </div>
    </div>
  );
}
