import { createEngineSimulation, getDefaultEcuConfig, type EcuConfig } from "./engineSim";
import { log } from '@shared/logger';

const defaultConfig = getDefaultEcuConfig();
const sim = createEngineSimulation(defaultConfig);
log.info('sharedSim', 'Shared simulation instance created');

export const sharedSim = sim;
export const sharedDefaultConfig = defaultConfig;
