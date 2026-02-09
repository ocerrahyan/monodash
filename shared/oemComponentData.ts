/**
 * 2000 Honda Civic Si (EM1) OEM Component Database
 * 
 * Complete reference data for all drivetrain and suspension components
 * with real Honda OEM part numbers, dimensions, and specifications.
 */

import type {
  TransmissionS4C,
  CVAxle,
  WheelHub,
  ControlArm,
  BallJoint,
  SteeringRack,
  TieRod,
  StrutAssembly,
  BrakeRotor,
  BrakeCaliper,
  SwayBar,
  SteeringKnuckle,
  Wheel,
  Tire,
} from './drivetrainTypes';

/**
 * S4C Transmission - OEM Specifications
 */
export const OEM_TRANSMISSION_S4C: TransmissionS4C = {
  model: 'S4C',
  type: 'manual_5speed',
  
  dimensions: {
    length: 533, // ~21 inches
    width: 368,  // ~14.5 inches
    height: 343, // ~13.5 inches
  },
  
  mass: {
    massKg: 41,
    massLb: 90,
    rotationalInertiaCm: 0.15, // Estimated
  },
  
  gearRatios: {
    first: 3.230,
    second: 2.105,
    third: 1.458,
    fourth: 1.107,
    fifth: 0.848,
    reverse: 3.000,
    finalDrive: 4.400,
  },
  
  axleSplineCount: 26,
  intermediateShaftType: 'SK7_hydro',
  
  connections: {
    bellhousing: {
      name: 'Engine Bellhousing',
      xMm: 0,
      yMm: 0,
      zMm: 0,
      type: 'bolt',
      torqueSpecNm: 54,
    },
    leftOutputShaft: {
      name: 'Left Output Shaft',
      xMm: -200,
      yMm: 0,
      zMm: 0,
      type: 'spline',
    },
    rightOutputShaft: {
      name: 'Right Output Shaft',
      xMm: 200,
      yMm: 0,
      zMm: 0,
      type: 'spline',
    },
    mount1: {
      name: 'Front Mount',
      xMm: 100,
      yMm: -150,
      zMm: 0,
      type: 'bolt',
      torqueSpecNm: 54,
    },
    mount2: {
      name: 'Rear Mount',
      xMm: -100,
      yMm: -150,
      zMm: 0,
      type: 'bolt',
      torqueSpecNm: 54,
    },
    mount3: {
      name: 'Side Mount',
      xMm: 0,
      yMm: 100,
      zMm: 50,
      type: 'bolt',
      torqueSpecNm: 54,
    },
  },
  
  differential: {
    type: 'open',
    ratio: 4.400,
  },
};

/**
 * Front CV Axles - OEM Specifications
 */
export const OEM_CV_AXLE_LEFT: CVAxle = {
  side: 'left',
  oemPartNumber: '44306-S04-A01',
  lengthMm: 620,
  diameterMm: 28,
  
  mass: {
    massKg: 4.1,
    massLb: 9,
    rotationalInertiaCm: 0.008,
  },
  
  innerJoint: {
    type: 'tripod',
    splineCount: 26,
  },
  
  outerJoint: {
    type: 'ball',
    splineCount: 26,
  },
  
  connections: {
    innerSpline: {
      name: 'Transmission Connection',
      xMm: 0,
      yMm: 0,
      zMm: 0,
      type: 'spline',
    },
    outerSpline: {
      name: 'Hub Connection',
      xMm: 620,
      yMm: 0,
      zMm: 0,
      type: 'spline',
      torqueSpecNm: 181,
    },
  },
};

export const OEM_CV_AXLE_RIGHT: CVAxle = {
  ...OEM_CV_AXLE_LEFT,
  side: 'right',
  oemPartNumber: '44305-S04-A01',
  lengthMm: 580,
};

/**
 * Front Wheel Hubs - OEM Specifications
 */
export const OEM_FRONT_HUB: Omit<WheelHub, 'position'> = {
  oemPartNumber: '44600-S04-A00',
  
  dimensions: {
    length: 246,
    width: 178,
    height: 146,
  },
  
  mass: {
    massKg: 2.7, // Hub + bearing
    massLb: 6,
    rotationalInertiaCm: 0.012,
  },
  
  boltPattern: '4x100',
  centerBoreMm: 56.1,
  studSize: 'M12x1.5',
  
  bearing: {
    oemPartNumber: '44300-S04-008',
    type: 'double_row_ball',
    outerDiameterMm: 72,
    innerDiameterMm: 39,
    widthMm: 37,
  },
  
  connections: {
    axleSpline: {
      name: 'CV Axle Connection',
      xMm: 0,
      yMm: 0,
      zMm: 0,
      type: 'spline',
      torqueSpecNm: 181,
    },
    wheelStuds: [
      { name: 'Stud 1', xMm: 50, yMm: 0, zMm: 0, type: 'bolt', torqueSpecNm: 108 },
      { name: 'Stud 2', xMm: 0, yMm: 50, zMm: 0, type: 'bolt', torqueSpecNm: 108 },
      { name: 'Stud 3', xMm: -50, yMm: 0, zMm: 0, type: 'bolt', torqueSpecNm: 108 },
      { name: 'Stud 4', xMm: 0, yMm: -50, zMm: 0, type: 'bolt', torqueSpecNm: 108 },
    ],
    knuckleMounting: {
      name: 'Knuckle Press-fit',
      xMm: 0,
      yMm: 0,
      zMm: 0,
      type: 'press_fit',
    },
  },
};

/**
 * Control Arms - OEM Specifications
 */
export const OEM_UPPER_CONTROL_ARM_LEFT: ControlArm = {
  position: 'upper_left',
  oemPartNumber: '51460-S04-003',
  lengthMm: 310,
  
  mass: {
    massKg: 1.6,
    massLb: 3.5,
    rotationalInertiaCm: 0,
  },
  
  material: 'stamped_steel',
  
  connections: {
    chassisMount1: {
      name: 'Front Bushing',
      xMm: 0,
      yMm: 0,
      zMm: 0,
      type: 'bushing',
      torqueSpecNm: 64,
    },
    chassisMount2: {
      name: 'Rear Bushing',
      xMm: 150,
      yMm: 0,
      zMm: 0,
      type: 'bushing',
      torqueSpecNm: 64,
    },
    ballJoint: {
      name: 'Upper Ball Joint',
      xMm: 280,
      yMm: 0,
      zMm: -100,
      type: 'ball_joint',
      torqueSpecNm: 54,
    },
  },
};

export const OEM_UPPER_CONTROL_ARM_RIGHT: ControlArm = {
  ...OEM_UPPER_CONTROL_ARM_LEFT,
  position: 'upper_right',
  oemPartNumber: '51450-S04-003',
};

export const OEM_LOWER_CONTROL_ARM_LEFT: ControlArm = {
  position: 'lower_left',
  oemPartNumber: '51360-S04-000',
  lengthMm: 380,
  
  mass: {
    massKg: 2.5,
    massLb: 5.5,
    rotationalInertiaCm: 0,
  },
  
  material: 'stamped_steel',
  
  connections: {
    chassisMount1: {
      name: 'Front Bushing',
      xMm: 0,
      yMm: 0,
      zMm: 0,
      type: 'bushing',
      torqueSpecNm: 64,
    },
    chassisMount2: {
      name: 'Rear Bushing',
      xMm: 250,
      yMm: 0,
      zMm: 0,
      type: 'bushing',
      torqueSpecNm: 64,
    },
    ballJoint: {
      name: 'Lower Ball Joint',
      xMm: 350,
      yMm: 0,
      zMm: 0,
      type: 'ball_joint',
      torqueSpecNm: 49,
    },
    swayBarLink: {
      name: 'Sway Bar End Link',
      xMm: 180,
      yMm: 0,
      zMm: -50,
      type: 'bolt',
      torqueSpecNm: 22,
    },
  },
  
  ballJoint: {
    oemPartNumber: '51220-S04-003',
    type: 'press_fit',
    studDiameterMm: 17,
  },
};

export const OEM_LOWER_CONTROL_ARM_RIGHT: ControlArm = {
  ...OEM_LOWER_CONTROL_ARM_LEFT,
  position: 'lower_right',
  oemPartNumber: '51350-S04-000',
};

/**
 * Ball Joints - OEM Specifications
 */
export const OEM_LOWER_BALL_JOINT: BallJoint = {
  type: 'lower',
  oemPartNumber: '51220-S04-003',
  studDiameterMm: 17,
  studLengthMm: 45,
  bodyDiameterMm: 42,
  travelDegreesVertical: 25,
  travelDegreesHorizontal: 25,
  torqueSpecNm: 49,
};

/**
 * Steering Rack - OEM Specifications
 */
export const OEM_STEERING_RACK: SteeringRack = {
  oemPartNumber: '53427-S04-A01',
  type: 'hydraulic_power_steering',
  
  dimensions: {
    length: 800,
    width: 53,
    height: 51,
  },
  
  mass: {
    massKg: 2.7,
    massLb: 6,
    rotationalInertiaCm: 0,
  },
  
  rackTravelMm: 140,
  turnsLockToLock: 2.9,
  steeringRatio: 16.5,
  
  connections: {
    pinionInput: {
      name: 'Intermediate Shaft',
      xMm: 0,
      yMm: 0,
      zMm: 0,
      type: 'bolt',
      torqueSpecNm: 26,
    },
    leftInnerTieRod: {
      name: 'Left Tie Rod',
      xMm: -350,
      yMm: 0,
      zMm: 0,
      type: 'thread',
      torqueSpecNm: 54,
    },
    rightInnerTieRod: {
      name: 'Right Tie Rod',
      xMm: 350,
      yMm: 0,
      zMm: 0,
      type: 'thread',
      torqueSpecNm: 54,
    },
    mountingBracket1: {
      name: 'Left Mount',
      xMm: -200,
      yMm: 0,
      zMm: -30,
      type: 'bolt',
      torqueSpecNm: 43,
    },
    mountingBracket2: {
      name: 'Right Mount',
      xMm: 200,
      yMm: 0,
      zMm: -30,
      type: 'bolt',
      torqueSpecNm: 43,
    },
    powerSteeringHose: {
      name: 'PS Hose',
      xMm: 50,
      yMm: 0,
      zMm: 20,
      type: 'thread',
      torqueSpecNm: 27,
    },
  },
};

/**
 * Tie Rods - OEM Specifications
 */
export const OEM_INNER_TIE_ROD_LEFT: TieRod = {
  side: 'left',
  segment: 'inner',
  oemPartNumber: '53521-S04-003',
  lengthMm: 185,
  threadSize: 'M14x1.5',
  
  connections: {
    inboard: {
      name: 'Steering Rack',
      xMm: 0,
      yMm: 0,
      zMm: 0,
      type: 'thread',
      torqueSpecNm: 54,
    },
    outboard: {
      name: 'Outer Tie Rod',
      xMm: 185,
      yMm: 0,
      zMm: 0,
      type: 'thread',
      torqueSpecNm: 54,
    },
  },
  
  torqueSpecNm: 54,
};

export const OEM_OUTER_TIE_ROD_LEFT: TieRod = {
  side: 'left',
  segment: 'outer',
  oemPartNumber: '53540-S04-A01',
  lengthMm: 210,
  threadSize: 'M12x1.25',
  
  connections: {
    inboard: {
      name: 'Inner Tie Rod',
      xMm: 0,
      yMm: 0,
      zMm: 0,
      type: 'thread',
      torqueSpecNm: 54,
    },
    outboard: {
      name: 'Steering Knuckle',
      xMm: 210,
      yMm: 0,
      zMm: 0,
      type: 'thread',
      torqueSpecNm: 43,
    },
  },
  
  torqueSpecNm: 43,
};

/**
 * Strut Assembly - OEM Specifications
 */
export const OEM_FRONT_STRUT_LEFT: StrutAssembly = {
  position: 'front_left',
  oemPartNumber: '51621-S04-A02',
  
  extendedLengthMm: 512,
  compressedLengthMm: 378,
  housingDiameterMm: 45,
  
  mass: {
    massKg: 6.4,
    massLb: 14,
    rotationalInertiaCm: 0,
  },
  
  spring: {
    oemPartNumber: '51401-S04-A02',
    wireDiameterMm: 12.5,
    outerDiameterMm: 125,
    freeHeightMm: 325,
    rateNPerMm: 28, // ~160 lb/in
    type: 'constant_rate',
  },
  
  damper: {
    compressionDampingNsPerMm: 1800,
    reboundDampingNsPerMm: 3200,
    strokeMm: 134,
  },
  
  connections: {
    upperMount: {
      name: 'Strut Tower',
      xMm: 0,
      yMm: 0,
      zMm: 512,
      type: 'bolt',
      torqueSpecNm: 47,
    },
    lowerMount: {
      name: 'Steering Knuckle',
      xMm: 0,
      yMm: 0,
      zMm: 0,
      type: 'bolt',
      torqueSpecNm: 115,
    },
  },
};

export const OEM_FRONT_STRUT_RIGHT: StrutAssembly = {
  ...OEM_FRONT_STRUT_LEFT,
  position: 'front_right',
  oemPartNumber: '51611-S04-A02',
};

/**
 * Brake Rotors - OEM Specifications
 */
export const OEM_FRONT_BRAKE_ROTOR: Omit<BrakeRotor, 'position'> = {
  oemPartNumber: '45251-SR0-A10',
  
  diameterMm: 262,
  thicknessNewMm: 23,
  thicknessMinMm: 21,
  
  mass: {
    massKg: 6.4,
    massLb: 14,
    rotationalInertiaCm: 0.032,
  },
  
  type: 'vented',
  material: 'cast_iron_G3000',
  ventCount: 48,
  
  boltPattern: '4x100',
  centerBoreMm: 56.1,
};

/**
 * Brake Calipers - OEM Specifications
 */
export const OEM_FRONT_BRAKE_CALIPER: Omit<BrakeCaliper, 'position'> = {
  oemPartNumber: '45019-S5A-A00',
  
  pistonCount: 1,
  pistonDiameterMm: 54,
  type: 'floating',
  
  mass: {
    massKg: 3.4,
    massLb: 7.5,
    rotationalInertiaCm: 0,
  },
  
  padArea: 65, // cm²
  
  connections: {
    bracketBolts: [
      {
        name: 'Upper Bracket Bolt',
        xMm: 0,
        yMm: 0,
        zMm: 80,
        type: 'bolt',
        torqueSpecNm: 108,
      },
      {
        name: 'Lower Bracket Bolt',
        xMm: 0,
        yMm: 0,
        zMm: -80,
        type: 'bolt',
        torqueSpecNm: 108,
      },
    ],
    brakeHose: {
      name: 'Brake Hose Banjo',
      xMm: 30,
      yMm: 0,
      zMm: 0,
      type: 'bolt',
      torqueSpecNm: 34,
    },
  },
};

/**
 * Sway Bars - OEM Specifications
 */
export const OEM_FRONT_SWAY_BAR: SwayBar = {
  position: 'front',
  oemPartNumber: '51300-S04-A00',
  
  diameterMm: 26,
  totalLengthMm: 1100,
  material: 'steel',
  
  mass: {
    massKg: 2.7,
    massLb: 6,
    rotationalInertiaCm: 0,
  },
  
  stiffnessNmPerDeg: 85,
  
  connections: {
    leftBushingBracket: {
      name: 'Left Mount',
      xMm: -350,
      yMm: 0,
      zMm: 0,
      type: 'bolt',
      torqueSpecNm: 22,
    },
    rightBushingBracket: {
      name: 'Right Mount',
      xMm: 350,
      yMm: 0,
      zMm: 0,
      type: 'bolt',
      torqueSpecNm: 22,
    },
    leftEndLink: {
      name: 'Left End Link',
      xMm: -450,
      yMm: 0,
      zMm: -80,
      type: 'bolt',
      torqueSpecNm: 22,
    },
    rightEndLink: {
      name: 'Right End Link',
      xMm: 450,
      yMm: 0,
      zMm: -80,
      type: 'bolt',
      torqueSpecNm: 22,
    },
  },
  
  bushings: {
    oemPartNumber: '51306-S04-003',
    innerDiameterMm: 26,
    material: 'rubber',
  },
};

export const OEM_REAR_SWAY_BAR: SwayBar = {
  position: 'rear',
  oemPartNumber: '52300-S04-003',
  
  diameterMm: 13,
  totalLengthMm: 950,
  material: 'steel',
  
  mass: {
    massKg: 2.0,
    massLb: 4.4,
    rotationalInertiaCm: 0,
  },
  
  stiffnessNmPerDeg: 28,
  
  connections: {
    leftBushingBracket: {
      name: 'Left Mount',
      xMm: -300,
      yMm: 0,
      zMm: 0,
      type: 'bolt',
      torqueSpecNm: 22,
    },
    rightBushingBracket: {
      name: 'Right Mount',
      xMm: 300,
      yMm: 0,
      zMm: 0,
      type: 'bolt',
      torqueSpecNm: 22,
    },
    leftEndLink: {
      name: 'Left End Link',
      xMm: -400,
      yMm: 0,
      zMm: -60,
      type: 'bolt',
      torqueSpecNm: 22,
    },
    rightEndLink: {
      name: 'Right End Link',
      xMm: 400,
      yMm: 0,
      zMm: -60,
      type: 'bolt',
      torqueSpecNm: 22,
    },
  },
  
  bushings: {
    oemPartNumber: '52306-S04-003',
    innerDiameterMm: 13,
    material: 'rubber',
  },
};

/**
 * OEM Wheel Specifications
 */
export const OEM_WHEEL: Wheel = {
  diameterInches: 15,
  widthInches: 6.0,
  boltPattern: '4x100',
  offsetMm: 45,
  centerBoreMm: 56.1,
  
  mass: {
    massKg: 7.0,
    massLb: 15.5,
    rotationalInertiaCm: 0.21,
  },
  
  material: 'aluminum_alloy_cast',
  beadSeatDiameterMm: 381, // 15 inches
};

/**
 * OEM Tire Specifications (195/55R15)
 */
export const OEM_TIRE: Tire = {
  widthMm: 195,
  aspectRatio: 55,
  rimDiameterInches: 15,
  
  overallDiameterMm: 595,
  sidewallHeightMm: 107,
  sectionWidthMm: 195,
  
  mass: {
    massKg: 8.6,
    massLb: 19,
    rotationalInertiaCm: 0.38,
  },
  
  compoundType: 'street',
  gripCoefficient: 0.85,
  optimalTempC: 80,
  rollResistanceCoeff: 0.012,
};

/**
 * Export all OEM components as a complete database
 */
export const OEM_COMPONENT_DATABASE = {
  transmission: OEM_TRANSMISSION_S4C,
  axles: {
    left: OEM_CV_AXLE_LEFT,
    right: OEM_CV_AXLE_RIGHT,
  },
  hubs: {
    front: OEM_FRONT_HUB,
  },
  controlArms: {
    upperLeft: OEM_UPPER_CONTROL_ARM_LEFT,
    upperRight: OEM_UPPER_CONTROL_ARM_RIGHT,
    lowerLeft: OEM_LOWER_CONTROL_ARM_LEFT,
    lowerRight: OEM_LOWER_CONTROL_ARM_RIGHT,
  },
  ballJoints: {
    lower: OEM_LOWER_BALL_JOINT,
  },
  steering: {
    rack: OEM_STEERING_RACK,
    innerTieRodLeft: OEM_INNER_TIE_ROD_LEFT,
    outerTieRodLeft: OEM_OUTER_TIE_ROD_LEFT,
  },
  struts: {
    frontLeft: OEM_FRONT_STRUT_LEFT,
    frontRight: OEM_FRONT_STRUT_RIGHT,
  },
  brakes: {
    frontRotor: OEM_FRONT_BRAKE_ROTOR,
    frontCaliper: OEM_FRONT_BRAKE_CALIPER,
  },
  swayBars: {
    front: OEM_FRONT_SWAY_BAR,
    rear: OEM_REAR_SWAY_BAR,
  },
  wheels: OEM_WHEEL,
  tires: OEM_TIRE,
} as const;
