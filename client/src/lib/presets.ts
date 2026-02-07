import { type EcuConfig, getDefaultEcuConfig } from "./engineSim";

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
      boostByGear: [6, 8, 8, 8, 8],
      targetAfrWot: 11.5,
      targetAfrVtec: 11.2,
      injectorSizeCc: 440,
      fuelPressurePsi: 48,
      tractionControlEnabled: true,
      tractionSlipThreshold: 8,
      tractionControlMode: "moderate",
    }),
    makePreset("Drag Build", {
      turboEnabled: true,
      boostTargetPsi: 18,
      boostCutPsi: 22,
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
    }),
    makePreset("Max Attack", {
      turboEnabled: true,
      boostTargetPsi: 25,
      boostCutPsi: 30,
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
