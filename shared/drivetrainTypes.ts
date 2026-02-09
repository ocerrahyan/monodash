/**
 * TypeScript Type Definitions for 2000 Honda Civic Si (EM1) Drivetrain Components
 * 
 * These interfaces define the physical specifications of real drivetrain components
 * for use in CAD modeling, 3D simulation, and accurate physics calculations.
 * 
 * All dimensions are based on OEM specifications and real-world measurements.
 */

/**
 * Physical dimensions in millimeters
 */
export interface Dimensions3D {
  length: number;  // mm
  width: number;   // mm
  height: number;  // mm
}

/**
 * Component mass and inertia properties
 */
export interface MassProperties {
  massKg: number;
  massLb: number;
  rotationalInertiaCm: number; // kg⋅m² - for rotating components
}

/**
 * Connection point in 3D space relative to component origin
 */
export interface ConnectionPoint {
  name: string;
  xMm: number;
  yMm: number;
  zMm: number;
  type: 'bolt' | 'spline' | 'ball_joint' | 'bushing' | 'thread' | 'press_fit';
  torqueSpecNm?: number;
}

/**
 * S4C 5-Speed Manual Transmission
 */
export interface TransmissionS4C {
  model: 'S4C';
  type: 'manual_5speed';
  
  // Physical dimensions
  dimensions: Dimensions3D; // Length: 508-559mm, Width: 356-381mm, Height: 330-356mm
  mass: MassProperties; // 40-42 kg
  
  // Gear ratios
  gearRatios: {
    first: 3.230;
    second: 2.105;
    third: 1.458;
    fourth: 1.107;
    fifth: 0.848;
    reverse: 3.000;
    finalDrive: 4.400;
  };
  
  // Internal specifications
  axleSplineCount: 26;
  intermediateShaftType: 'SK7_hydro';
  
  // Connection points
  connections: {
    bellhousing: ConnectionPoint;
    leftOutputShaft: ConnectionPoint;
    rightOutputShaft: ConnectionPoint;
    mount1: ConnectionPoint;
    mount2: ConnectionPoint;
    mount3: ConnectionPoint;
  };
  
  // Differential
  differential: {
    type: 'open' | 'helical_lsd' | 'clutch_lsd';
    ratio: 4.400;
  };
}

/**
 * CV Axle (Half Shaft)
 */
export interface CVAxle {
  side: 'left' | 'right';
  oemPartNumber: string; // Left: 44306-S04-A01, Right: 44305-S04-A01
  
  // Dimensions (approximate)
  lengthMm: number;
  diameterMm: number;
  mass: MassProperties; // ~3.6-4.5 kg per axle
  
  // Joint specifications
  innerJoint: {
    type: 'tripod';
    splineCount: 26;
  };
  
  outerJoint: {
    type: 'ball';
    splineCount: number;
  };
  
  // Connection points
  connections: {
    innerSpline: ConnectionPoint; // Connects to transmission/intermediate shaft
    outerSpline: ConnectionPoint; // Connects to wheel hub
  };
}

/**
 * Wheel Hub Assembly
 */
export interface WheelHub {
  position: 'front_left' | 'front_right' | 'rear_left' | 'rear_right';
  oemPartNumber: string; // Front: 44600-S04-A00
  
  // Dimensions
  dimensions: Dimensions3D; // ~246mm x 178mm x 146mm
  mass: MassProperties; // ~1.8 kg hub + 0.9 kg bearing
  
  // Specifications
  boltPattern: '4x100';
  centerBoreMm: 56.1;
  studSize: 'M12x1.5';
  
  // Bearing
  bearing: {
    oemPartNumber: string; // 44300-S04-008
    type: 'double_row_ball';
    outerDiameterMm: 72;
    innerDiameterMm: 39;
    widthMm: 37;
  };
  
  // Connection points
  connections: {
    axleSpline: ConnectionPoint;
    wheelStuds: ConnectionPoint[];
    knuckleMounting: ConnectionPoint;
  };
}

/**
 * Control Arm (Upper or Lower)
 */
export interface ControlArm {
  position: 'upper_left' | 'upper_right' | 'lower_left' | 'lower_right';
  oemPartNumber: string;
  
  // Physical properties
  lengthMm: number;
  mass: MassProperties; // Upper: ~1.4-1.8kg, Lower: ~2.3-2.7kg
  material: 'stamped_steel';
  
  // Connection points
  connections: {
    chassisMount1: ConnectionPoint; // Bushing mount
    chassisMount2: ConnectionPoint; // Bushing mount
    ballJoint: ConnectionPoint;
    swayBarLink?: ConnectionPoint; // Lower arm only
  };
  
  // Ball joint (if integrated)
  ballJoint?: {
    oemPartNumber: string;
    type: 'press_fit' | 'bolt_on';
    studDiameterMm: number;
  };
}

/**
 * Ball Joint (standalone)
 */
export interface BallJoint {
  type: 'upper' | 'lower';
  oemPartNumber: string; // Lower: 51220-S04-003
  
  // Specifications
  studDiameterMm: number;
  studLengthMm: number;
  bodyDiameterMm: number;
  travelDegreesVertical: number;
  travelDegreesHorizontal: number;
  
  // Connection
  torqueSpecNm: number; // 44-54 Nm for lower
}

/**
 * Steering Rack Assembly
 */
export interface SteeringRack {
  oemPartNumber: '53427-S04-A01';
  type: 'hydraulic_power_steering';
  
  // Dimensions
  dimensions: Dimensions3D; // Length: 800mm, Width: 53mm, Height: 51mm
  mass: MassProperties; // ~2.7 kg
  
  // Specifications
  rackTravelMm: number;
  turnsLockToLock: number;
  steeringRatio: number;
  
  // Connection points
  connections: {
    pinionInput: ConnectionPoint; // From intermediate shaft
    leftInnerTieRod: ConnectionPoint;
    rightInnerTieRod: ConnectionPoint;
    mountingBracket1: ConnectionPoint;
    mountingBracket2: ConnectionPoint;
    powerSteeringHose: ConnectionPoint;
  };
}

/**
 * Tie Rod (Inner and Outer)
 */
export interface TieRod {
  side: 'left' | 'right';
  segment: 'inner' | 'outer';
  
  // Part numbers
  oemPartNumber: string; // Inner: 53521-S04-003, Outer: 53540-S04-A01
  
  // Dimensions
  lengthMm: number;
  threadSize: string;
  
  // Connection points
  connections: {
    inboard: ConnectionPoint;
    outboard: ConnectionPoint;
  };
  
  // Torque spec
  torqueSpecNm: number; // 39-47 Nm for outer
}

/**
 * MacPherson Strut Assembly
 */
export interface StrutAssembly {
  position: 'front_left' | 'front_right';
  oemPartNumber: string; // Left: 51621-S04-A02
  
  // Dimensions
  extendedLengthMm: 512;
  compressedLengthMm: 378;
  housingDiameterMm: 45;
  mass: MassProperties; // ~6.4 kg per assembly
  
  // Spring specifications
  spring: {
    oemPartNumber: string; // 51401-S04-A02
    wireDiameterMm: number;
    outerDiameterMm: number;
    freeHeightMm: number;
    rateNPerMm: number;
    type: 'constant_rate';
  };
  
  // Damper specifications
  damper: {
    compressionDampingNsPerMm: number;
    reboundDampingNsPerMm: number;
    strokeMm: number;
  };
  
  // Connection points
  connections: {
    upperMount: ConnectionPoint; // To strut tower
    lowerMount: ConnectionPoint; // To steering knuckle
  };
}

/**
 * Brake Rotor
 */
export interface BrakeRotor {
  position: 'front_left' | 'front_right' | 'rear_left' | 'rear_right';
  oemPartNumber: string; // Front: 45251-SR0-A10
  
  // Dimensions
  diameterMm: 262; // Front rotors
  thicknessNewMm: 23;
  thicknessMinMm: 21;
  mass: MassProperties; // ~5.9-6.8 kg per rotor
  
  // Specifications
  type: 'vented' | 'solid';
  material: 'cast_iron_G3000';
  ventCount?: number; // For vented discs
  
  // Connection
  boltPattern: '4x100';
  centerBoreMm: 56.1;
}

/**
 * Brake Caliper
 */
export interface BrakeCaliper {
  position: 'front_left' | 'front_right' | 'rear_left' | 'rear_right';
  oemPartNumber: string;
  
  // Specifications
  pistonCount: number; // OEM: 1, Aftermarket: 4
  pistonDiameterMm: number;
  type: 'floating' | 'fixed';
  mass: MassProperties; // OEM: ~3.2-3.6 kg, Wilwood: ~2 kg
  
  // Brake pad
  padArea: number; // cm²
  
  // Connection points
  connections: {
    bracketBolts: ConnectionPoint[];
    brakeHose: ConnectionPoint;
  };
}

/**
 * Sway Bar (Anti-Roll Bar)
 */
export interface SwayBar {
  position: 'front' | 'rear';
  oemPartNumber: string; // Front: 51300-S04-A00, Rear: 52300-S04-003
  
  // Dimensions
  diameterMm: number; // Front: 26mm, Rear: 13mm
  totalLengthMm: number;
  material: 'steel';
  mass: MassProperties; // Front: ~2.3-3.2kg, Rear: ~1.8-2.3kg
  
  // Properties
  stiffnessNmPerDeg: number;
  
  // Connection points
  connections: {
    leftBushingBracket: ConnectionPoint;
    rightBushingBracket: ConnectionPoint;
    leftEndLink: ConnectionPoint;
    rightEndLink: ConnectionPoint;
  };
  
  // Bushings
  bushings: {
    oemPartNumber: string;
    innerDiameterMm: number;
    material: 'rubber' | 'urethane' | 'teflon';
  };
}

/**
 * Steering Knuckle (Spindle)
 */
export interface SteeringKnuckle {
  side: 'left' | 'right';
  oemPartNumber: string;
  
  // Dimensions
  mass: MassProperties; // ~4-5 kg estimated
  material: 'cast_iron' | 'cast_aluminum';
  
  // Connection points
  connections: {
    upperBallJoint: ConnectionPoint;
    lowerBallJoint: ConnectionPoint;
    tieRodEnd: ConnectionPoint;
    strutLowerMount: ConnectionPoint;
    hubBearing: ConnectionPoint;
    caliperBracket: ConnectionPoint;
  };
  
  // Geometry
  kingpinAngleDeg: number;
  scrubRadiusMm: number;
}

/**
 * Wheel Specification
 */
export interface Wheel {
  // Dimensions
  diameterInches: number; // OEM: 15"
  widthInches: number; // OEM: 6.0"
  boltPattern: '4x100';
  offsetMm: number; // +40 to +45 typical
  centerBoreMm: 56.1;
  
  // Properties
  mass: MassProperties; // ~6.8-7.3 kg
  material: 'aluminum_alloy_cast' | 'aluminum_alloy_forged' | 'steel';
  
  // Tire mounting
  beadSeatDiameterMm: number;
}

/**
 * Tire Specification
 */
export interface Tire {
  // Size designation
  widthMm: number; // OEM: 195mm
  aspectRatio: number; // OEM: 55
  rimDiameterInches: number; // OEM: 15"
  
  // Calculated dimensions
  overallDiameterMm: number; // ~595mm for 195/55R15
  sidewallHeightMm: number; // ~107mm
  sectionWidthMm: number; // ~195mm
  
  // Properties
  mass: MassProperties; // ~8.2-9.1 kg per tire
  compoundType: 'street' | 'sport' | 'semi_slick' | 'full_slick' | 'drag_slick';
  
  // Performance characteristics
  gripCoefficient: number;
  optimalTempC: number;
  rollResistanceCoeff: number;
}

/**
 * Complete Front Drivetrain Assembly
 */
export interface FrontDrivetrain {
  transmission: TransmissionS4C;
  leftAxle: CVAxle;
  rightAxle: CVAxle;
  leftHub: WheelHub;
  rightHub: WheelHub;
  intermediateShaft?: {
    type: 'SK7_hydro';
    lengthMm: number;
    mass: MassProperties;
  };
}

/**
 * Complete Front Suspension Assembly
 */
export interface FrontSuspension {
  left: {
    upperControlArm: ControlArm;
    lowerControlArm: ControlArm;
    strut: StrutAssembly;
    knuckle: SteeringKnuckle;
    hub: WheelHub;
    rotor: BrakeRotor;
    caliper: BrakeCaliper;
  };
  right: {
    upperControlArm: ControlArm;
    lowerControlArm: ControlArm;
    strut: StrutAssembly;
    knuckle: SteeringKnuckle;
    hub: WheelHub;
    rotor: BrakeRotor;
    caliper: BrakeCaliper;
  };
  steeringRack: SteeringRack;
  leftInnerTieRod: TieRod;
  leftOuterTieRod: TieRod;
  rightInnerTieRod: TieRod;
  rightOuterTieRod: TieRod;
  swayBar: SwayBar;
}

/**
 * Vehicle Geometry and Alignment
 */
export interface VehicleGeometry {
  wheelbaseMm: 2620; // 103.2 inches
  frontTrackWidthMm: 1475; // 58.1 inches
  rearTrackWidthMm: number;
  
  // Center of gravity
  cgHeightMm: 480; // 18.9 inches from ground
  cgPositionFrontRearPct: 61; // 61% front
  
  // Suspension geometry
  front: {
    casterAngleDeg: 5.367; // 5° 22'
    camberAngleDeg: -0.067; // -0° 04'
    toeInMm: 2.1; // Total toe
    kingpinAngleDeg: number;
    scrubRadiusMm: number;
  };
  
  rear: {
    camberAngleDeg: number;
    toeInMm: number;
  };
}

/**
 * Complete Vehicle Assembly (2000 Honda Civic Si EM1)
 */
export interface CivicSiEM1Assembly {
  chassis: 'EM1';
  year: 2000;
  model: 'Civic Si';
  
  // Mass properties
  curbWeightKg: 1184; // 2,612 lbs
  
  // Major assemblies
  frontDrivetrain: FrontDrivetrain;
  frontSuspension: FrontSuspension;
  geometry: VehicleGeometry;
  
  // Wheels and tires
  wheels: {
    frontLeft: Wheel;
    frontRight: Wheel;
    rearLeft: Wheel;
    rearRight: Wheel;
  };
  
  tires: {
    frontLeft: Tire;
    frontRight: Tire;
    rearLeft: Tire;
    rearRight: Tire;
  };
}

/**
 * Factory OEM specifications for 2000 Honda Civic Si EM1
 */
export const EM1_OEM_SPECS: Readonly<Partial<CivicSiEM1Assembly>> = {
  chassis: 'EM1',
  year: 2000,
  model: 'Civic Si',
  curbWeightKg: 1184,
  
  geometry: {
    wheelbaseMm: 2620,
    frontTrackWidthMm: 1475,
    rearTrackWidthMm: 1450,
    cgHeightMm: 480,
    cgPositionFrontRearPct: 61,
    
    front: {
      casterAngleDeg: 5.367,
      camberAngleDeg: -0.067,
      toeInMm: 2.1,
      kingpinAngleDeg: 12.5,
      scrubRadiusMm: 15,
    },
    
    rear: {
      camberAngleDeg: -1.5,
      toeInMm: 3.0,
    },
  },
};

/**
 * Helper function to calculate tire overall diameter
 */
export function calculateTireDiameter(widthMm: number, aspectRatio: number, rimInches: number): number {
  const sidewallMm = widthMm * (aspectRatio / 100);
  const rimMm = rimInches * 25.4;
  return rimMm + (2 * sidewallMm);
}

/**
 * Helper function to calculate contact patch area
 */
export function calculateContactPatch(
  tireWidthMm: number,
  tireDiameterMm: number,
  loadN: number,
  pressureKpa: number
): number {
  // Simplified contact patch calculation
  // Actual contact patch is more complex and depends on tire construction
  const contactLengthMm = Math.sqrt((loadN * tireDiameterMm) / (pressureKpa * tireWidthMm));
  return (contactLengthMm * tireWidthMm) / 100; // Convert to cm²
}

/**
 * Helper function to calculate rotating mass effect
 */
export function calculateEffectiveMass(
  vehicleMassKg: number,
  wheelMassKg: number,
  tireMassKg: number,
  rotorMassKg: number,
  axleMassKg: number,
  wheelRadiusM: number
): number {
  // Rotating inertia adds to effective mass
  const rotatingMass = wheelMassKg + tireMassKg + rotorMassKg + (axleMassKg * 0.5);
  const rotatingInertia = rotatingMass * wheelRadiusM * wheelRadiusM;
  const effectiveRotatingMass = rotatingInertia / (wheelRadiusM * wheelRadiusM);
  
  return vehicleMassKg + (effectiveRotatingMass * 2); // Front + rear
}
