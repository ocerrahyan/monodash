import { createEngineSimulation, getDefaultEcuConfig, type EcuConfig } from "./engineSim";

const defaultConfig = getDefaultEcuConfig();
const sim = createEngineSimulation(defaultConfig);

export const sharedSim = sim;
export const sharedDefaultConfig = defaultConfig;
