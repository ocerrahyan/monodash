import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface PhysicsInput {
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

export interface PhysicsCorrectionFactors {
  gripMultiplier: number;
  weightTransferMultiplier: number;
  slipMultiplier: number;
  dragMultiplier: number;
  tractionMultiplier: number;
  aiNotes: string;
}

const DEFAULT_CORRECTIONS: PhysicsCorrectionFactors = {
  gripMultiplier: 1.0,
  weightTransferMultiplier: 1.0,
  slipMultiplier: 1.0,
  dragMultiplier: 1.0,
  tractionMultiplier: 1.0,
  aiNotes: "Default values - no AI correction applied.",
};

export async function validatePhysics(
  input: PhysicsInput
): Promise<PhysicsCorrectionFactors> {
  try {
    const shortInput = `RPM:${input.rpm} THR:${input.throttle} SPD:${input.speedMph}mph G${input.currentGear} TQ:${input.torque} HP:${input.horsepower} SLIP:${input.tireSlipPercent}% ACCEL:${input.accelerationG}G GRIP:${input.ecuConfig.tireGripCoeff} MASS:${input.ecuConfig.vehicleMassLbs}lbs BOOST:${input.boostPsi}psi NOS:${input.ecuConfig.nitrousEnabled}/${input.ecuConfig.nitrousHpAdder}hp`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "user",
          content: `Car sim state: ${shortInput}\nReturn ONLY this JSON with physics corrections (0.5-1.5): {"gripMultiplier":1.0,"weightTransferMultiplier":1.0,"slipMultiplier":1.0,"dragMultiplier":1.0,"tractionMultiplier":1.0,"aiNotes":"ok"}`,
        },
      ],
    });

    let content = response.choices[0]?.message?.content;
    if (!content) return { ...DEFAULT_CORRECTIONS };

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ...DEFAULT_CORRECTIONS };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      gripMultiplier: clamp(parsed.gripMultiplier ?? 1.0, 0.5, 1.5),
      weightTransferMultiplier: clamp(parsed.weightTransferMultiplier ?? 1.0, 0.5, 1.5),
      slipMultiplier: clamp(parsed.slipMultiplier ?? 1.0, 0.5, 1.5),
      dragMultiplier: clamp(parsed.dragMultiplier ?? 1.0, 0.5, 1.5),
      tractionMultiplier: clamp(parsed.tractionMultiplier ?? 1.0, 0.5, 1.5),
      aiNotes: parsed.aiNotes ?? "",
    };
  } catch (err: any) {
    console.error("[AI Physics] Error:", err?.message || err);
    return { ...DEFAULT_CORRECTIONS };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
