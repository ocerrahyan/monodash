import { type EcuConfig, getDefaultEcuConfig } from "./engineSim";
import { log } from '@shared/logger';

export interface Preset {
  name: string;
  config: EcuConfig;
  builtIn: boolean;
}

function makePreset(name: string, overrides: Partial<EcuConfig>): Preset {
  return {
    name,
    config: { ...getDefaultEcuConfig(), ...overrides },
    builtIn: true,
  };
}

export function getBuiltInPresets(): Preset[] {
  return [
    {
      name: "Stock B16A2",
      config: getDefaultEcuConfig(),
      builtIn: true,
    },
    makePreset("Street Turbo", {
      turboEnabled: true,
      boostTargetPsi: 8,
      boostCutPsi: 12,
      boostByGearEnabled: true,
      boostByGear: [6, 8, 8, 8, 8],
      targetAfrWot: 11.5,
      targetAfrVtec: 11.2,
      injectorSizeCc: 440,
      fuelPressurePsi: 48,
      tractionControlEnabled: true,
      tractionSlipThreshold: 8,
      tractionControlMode: "moderate",
      tireWidthMm: 205,
      tireAspectRatio: 50,
      tireWheelDiameterIn: 16,
      tireCompound: "sport" as const,
      tireGripPct: 100,
    }),
    makePreset("Drag Build", {
      turboEnabled: true,
      boostTargetPsi: 18,
      boostCutPsi: 22,
      boostByGearEnabled: true,
      boostByGear: [12, 18, 18, 18, 18],
      antiLagEnabled: true,
      antiLagRetard: 25,
      targetAfrWot: 11.0,
      targetAfrVtec: 10.8,
      injectorSizeCc: 750,
      fuelPressurePsi: 55,
      launchControlEnabled: true,
      launchControlRpm: 5500,
      launchRetardDeg: 20,
      launchFuelCutPct: 40,
      tireGripCoeff: 1.2,
      vehicleMassLb: 2400,
      vtecIntakeLiftMm: 12.0,
      vtecExhaustLiftMm: 10.5,
      vtecIntakeDuration: 260,
      vtecExhaustDuration: 248,
      tireWidthMm: 275,
      tireAspectRatio: 60,
      tireWheelDiameterIn: 15,
      tireCompound: "drag_slick" as const,
      tireGripPct: 110,
      tireTempSensitivity: 1.2,
      fuelType: "e85" as const,
      intercoolerEnabled: true,
      intercoolerEfficiencyPct: 85,
    }),
    makePreset("All-Motor", {
      vtecEngageRpm: 5000,
      vtecIntakeLiftMm: 12.5,
      vtecExhaustLiftMm: 11.0,
      vtecIntakeDuration: 270,
      vtecExhaustDuration: 255,
      lowCamIntakeLiftMm: 8.5,
      lowCamExhaustLiftMm: 7.8,
      lowCamIntakeDuration: 225,
      lowCamExhaustDuration: 215,
      compressionRatio: 12.5,
      redlineRpm: 8800,
      fuelCutRpm: 8900,
      softCutRpm: 8600,
      gearRevLimits: [8800, 8800, 8800, 8800, 8800],
      targetAfrWot: 12.5,
      targetAfrVtec: 12.0,
      maxAdvanceDeg: 42,
      vehicleMassLb: 2350,
      tireWidthMm: 205,
      tireAspectRatio: 50,
      tireWheelDiameterIn: 15,
      tireCompound: "semi_slick" as const,
      tireGripPct: 105,
    }),
    makePreset("Supercharged", {
      superchargerEnabled: true,
      superchargerType: "roots",
      superchargerMaxBoostPsi: 8,
      superchargerEfficiency: 75,
      targetAfrWot: 11.5,
      targetAfrVtec: 11.2,
      injectorSizeCc: 440,
      fuelPressurePsi: 50,
      tractionControlEnabled: true,
      tractionSlipThreshold: 10,
      tractionControlMode: "mild",
      tireWidthMm: 215,
      tireAspectRatio: 45,
      tireWheelDiameterIn: 16,
      tireCompound: "sport" as const,
      tireGripPct: 105,
    }),
    makePreset("NOS Street", {
      nitrousEnabled: true,
      nitrousHpAdder: 75,
      nitrousActivationRpm: 3500,
      nitrousFullThrottleOnly: true,
      targetAfrWot: 11.8,
      injectorSizeCc: 370,
      fuelPressurePsi: 48,
      tractionControlEnabled: true,
      tractionSlipThreshold: 8,
      tractionControlMode: "moderate",
      tireWidthMm: 205,
      tireAspectRatio: 50,
      tireWheelDiameterIn: 15,
      tireCompound: "sport" as const,
      tireGripPct: 100,
    }),
    makePreset("Max Attack", {
      turboEnabled: true,
      boostTargetPsi: 25,
      boostCutPsi: 30,
      boostByGearEnabled: true,
      boostByGear: [15, 22, 25, 25, 25],
      antiLagEnabled: true,
      antiLagRetard: 30,
      nitrousEnabled: false,
      targetAfrWot: 10.5,
      targetAfrVtec: 10.2,
      injectorSizeCc: 1000,
      fuelPressurePsi: 60,
      launchControlEnabled: true,
      launchControlRpm: 6000,
      launchRetardDeg: 25,
      launchFuelCutPct: 50,
      tireGripCoeff: 1.4,
      vehicleMassLb: 2200,
      vtecIntakeLiftMm: 13.0,
      vtecExhaustLiftMm: 11.5,
      vtecIntakeDuration: 280,
      vtecExhaustDuration: 260,
      redlineRpm: 9000,
      fuelCutRpm: 9100,
      softCutRpm: 8800,
      gearRevLimits: [9000, 9000, 9000, 9000, 9000],
      compressionRatio: 8.5,
      flatFootShiftEnabled: true,
      flatFootShiftCutTime: 80,
      shiftTimeMs: 100,
      clutchMaxTorqueNm: 500,
      tireWidthMm: 315,
      tireAspectRatio: 35,
      tireWheelDiameterIn: 17,
      tireCompound: "full_slick" as const,
      tireGripPct: 120,
      tireTempSensitivity: 1.5,
      fuelType: "e85" as const,
      intercoolerEnabled: true,
      intercoolerEfficiencyPct: 90,
    }),
    makePreset("AWD Turbo", {
      turboEnabled: true,
      boostTargetPsi: 14,
      boostCutPsi: 18,
      boostByGearEnabled: true,
      boostByGear: [10, 14, 14, 14, 14],
      antiLagEnabled: true,
      antiLagRetard: 15,
      targetAfrWot: 11.2,
      targetAfrVtec: 11.0,
      injectorSizeCc: 550,
      fuelPressurePsi: 50,
      launchControlEnabled: true,
      launchControlRpm: 5000,
      launchRetardDeg: 15,
      launchFuelCutPct: 30,
      tireGripCoeff: 1.1,
      vehicleMassLb: 2700,
      clutchMaxTorqueNm: 400,
      tireWidthMm: 245,
      tireAspectRatio: 40,
      tireWheelDiameterIn: 17,
      tireCompound: "semi_slick" as const,
      tireGripPct: 110,
      tractionControlEnabled: true,
      tractionSlipThreshold: 6,
      tractionControlMode: "moderate",
      fuelType: "e85" as const,
      intercoolerEnabled: true,
      intercoolerEfficiencyPct: 80,
      drivetrainType: "AWD" as const,
      frontDiffType: "lsd" as const,
      rearDiffType: "lsd" as const,
      centerDiffType: "viscous" as const,
      awdFrontBias: 0.4,
    }),
    makePreset("RWD Drift", {
      turboEnabled: true,
      boostTargetPsi: 12,
      boostCutPsi: 16,
      boostByGearEnabled: false,
      boostByGear: [12, 12, 12, 12, 12],
      targetAfrWot: 11.5,
      targetAfrVtec: 11.2,
      injectorSizeCc: 550,
      fuelPressurePsi: 48,
      vehicleMassLb: 2450,
      clutchMaxTorqueNm: 350,
      tireWidthMm: 235,
      tireAspectRatio: 40,
      tireWheelDiameterIn: 17,
      tireCompound: "sport" as const,
      tireGripPct: 95,
      tractionControlEnabled: false,
      fuelType: "gasoline" as const,
      gasolineOctane: 93 as const,
      intercoolerEnabled: true,
      intercoolerEfficiencyPct: 75,
      drivetrainType: "RWD" as const,
      frontDiffType: "open" as const,
      rearDiffType: "lsd" as const,
    }),
  ];
}

const STORAGE_KEY = "ecu_presets";

export function getSavedPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function savePreset(name: string, config: EcuConfig): void {
  log.info('presets', `Saving preset: ${name}`);
  const presets = getSavedPresets();
  const existing = presets.findIndex((p) => p.name === name);
  const preset: Preset = { name, config: { ...config }, builtIn: false };
  if (existing >= 0) {
    presets[existing] = preset;
  } else {
    presets.push(preset);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function deletePreset(name: string): void {
  log.info('presets', `Deleting preset: ${name}`);
  const presets = getSavedPresets().filter((p) => p.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function getAllPresets(): Preset[] {
  const builtIn = getBuiltInPresets();
  const saved = getSavedPresets();
  const savedNames = new Set(saved.map((p) => p.name));
  const merged = builtIn.map((p) =>
    savedNames.has(p.name) ? saved.find((s) => s.name === p.name)! : p
  );
  const custom = saved.filter((p) => !builtIn.some((b) => b.name === p.name));
  return [...merged, ...custom];
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARE VIA URL  (compress config to base64 URL parameter)
// ═══════════════════════════════════════════════════════════════════════════
export function configToShareUrl(config: EcuConfig): string {
  try {
    const json = JSON.stringify(config);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const url = new URL(window.location.href);
    url.searchParams.set('cfg', encoded);
    url.hash = '';
    return url.toString();
  } catch {
    return window.location.href;
  }
}

export function configFromShareUrl(): EcuConfig | null {
  try {
    const url = new URL(window.location.href);
    const encoded = url.searchParams.get('cfg');
    if (!encoded) return null;
    const json = decodeURIComponent(escape(atob(encoded)));
    const config = JSON.parse(json) as EcuConfig;
    // Clean up URL after loading
    url.searchParams.delete('cfg');
    window.history.replaceState({}, '', url.toString());
    return config;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT / IMPORT (JSON file download/upload)
// ═══════════════════════════════════════════════════════════════════════════
export function exportConfigToFile(config: EcuConfig, name: string = 'ecu-config'): void {
  log.info('presets', `Exporting config to file: ${name}`);
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importConfigFromFile(): Promise<EcuConfig | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const text = await file.text();
        resolve(JSON.parse(text) as EcuConfig);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// UNDO HISTORY  (circular buffer of last 50 config states)
// ═══════════════════════════════════════════════════════════════════════════
const UNDO_MAX = 50;
let undoStack: EcuConfig[] = [];
let undoIndex = -1;

export function pushUndo(config: EcuConfig): void {
  // Trim forward history if we're not at the tip
  if (undoIndex < undoStack.length - 1) {
    undoStack = undoStack.slice(0, undoIndex + 1);
  }
  undoStack.push({ ...config });
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  undoIndex = undoStack.length - 1;
}

export function undo(): EcuConfig | null {
  if (undoIndex > 0) {
    undoIndex--;
    return { ...undoStack[undoIndex] };
  }
  return null;
}

export function redo(): EcuConfig | null {
  if (undoIndex < undoStack.length - 1) {
    undoIndex++;
    return { ...undoStack[undoIndex] };
  }
  return null;
}

export function canUndo(): boolean { return undoIndex > 0; }
export function canRedo(): boolean { return undoIndex < undoStack.length - 1; }
