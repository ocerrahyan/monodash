export interface AiCorrectionFactors {
  gripMultiplier: number;
  weightTransferMultiplier: number;
  slipMultiplier: number;
  dragMultiplier: number;
  tractionMultiplier: number;
  aiNotes: string;
}

export const defaultCorrections: AiCorrectionFactors = {
  gripMultiplier: 1.0,
  weightTransferMultiplier: 1.0,
  slipMultiplier: 1.0,
  dragMultiplier: 1.0,
  tractionMultiplier: 1.0,
  aiNotes: "",
};

interface AiPhysicsState {
  rpm: number;
  throttle: number;
  speedMph: number;
  currentGear: number;
  torque: number;
  horsepower: number;
  boostPsi: number;
  tireSlipPercent: number;
  accelerationG: number;
  weightTransfer: number;
  frontAxleLoad: number;
  wheelForce: number;
  tractionLimit: number;
  ecuConfig: {
    vehicleMassLbs: number;
    tireGripCoeff: number;
    turboEnabled: boolean;
    superchargerEnabled: boolean;
    nitrousEnabled: boolean;
    nitrousHpAdder: number;
    dragCoefficient: number;
    frontalAreaM2: number;
    tireDiameterInches: number;
  };
}

export async function fetchAiCorrections(state: AiPhysicsState): Promise<AiCorrectionFactors> {
  try {
    const response = await fetch('/api/ai-physics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rpm: state.rpm,
        throttle: state.throttle,
        speedMph: state.speedMph,
        currentGear: state.currentGear,
        torque: state.torque,
        horsepower: state.horsepower,
        boostPsi: state.boostPsi,
        tireSlipPercent: state.tireSlipPercent,
        accelerationG: state.accelerationG,
        weightTransfer: state.weightTransfer,
        frontAxleLoad: state.frontAxleLoad,
        wheelForce: state.wheelForce,
        tractionLimit: state.tractionLimit,
        ecuConfig: state.ecuConfig,
      }),
    });

    if (!response.ok) {
      return defaultCorrections;
    }

    const data = await response.json();
    return data as AiCorrectionFactors;
  } catch {
    return defaultCorrections;
  }
}
