// ═══════════════════════════════════════════════════════════════════════════
// AUTO-TUNE ENGINE — Performance Goal Auto-Configuration
// ═══════════════════════════════════════════════════════════════════════════
// Given a target (HP, torque, quarter-mile ET, top speed), this module
// reverse-engineers the ECU and vehicle configuration to achieve it.
// Supports constraints: pump gas only, nitrous, all-motor, turbo, etc.
//
// Usage:
//   import { autoTune, type AutoTuneGoal } from '@/lib/autoTune';
//   const result = autoTune(currentConfig, {
//     targetType: 'quarter_mile',
//     targetValue: 10.0,
//     constraints: { pumpGasOnly: true, nitrousAllowed: true }
//   });
//   // result.config is the new EcuConfig
//   // result.changes is a summary of what was changed
// ═══════════════════════════════════════════════════════════════════════════

import { type EcuConfig, getDefaultEcuConfig } from './engineSim';
import { log } from '@shared/logger';

// ── Goal types ─────────────────────────────────────────────────────────
export type TargetType = 'horsepower' | 'torque' | 'quarter_mile' | 'top_speed' | 'eighth_mile' | 'sixty_foot';

export interface AutoTuneConstraints {
  pumpGasOnly: boolean;           // Limit to 91/93 octane
  nitrousAllowed: boolean;        // Allow nitrous oxide
  turboAllowed: boolean;          // Allow turbo
  superchargerAllowed: boolean;   // Allow supercharger
  allMotor: boolean;              // NA only (no forced induction or nitrous)
  maxBudget?: number;             // Hypothetical budget cap (for future use)
  streetLegal: boolean;           // Keep emissions, cats, etc.
  tireDragSlick: boolean;         // Allow drag slicks
  safetyRating: 'stock' | 'mild' | 'full_cage';
}

export interface AutoTuneGoal {
  targetType: TargetType;
  targetValue: number;            // HP, ft-lb, seconds, or MPH
  constraints: AutoTuneConstraints;
}

export interface AutoTuneChange {
  field: string;
  from: unknown;
  to: unknown;
  reason: string;
}

export interface AutoTuneResult {
  config: EcuConfig;
  changes: AutoTuneChange[];
  estimatedHp: number;
  estimatedTorque: number;
  estimatedQuarterMile: number;
  estimatedTopSpeed: number;
  feasible: boolean;
  notes: string[];
}

export function getDefaultConstraints(): AutoTuneConstraints {
  return {
    pumpGasOnly: true,
    nitrousAllowed: false,
    turboAllowed: true,
    superchargerAllowed: false,
    allMotor: false,
    streetLegal: true,
    tireDragSlick: false,
    safetyRating: 'stock',
  };
}

// ── Physics estimation helpers ─────────────────────────────────────────

/** Estimate peak flywheel HP from config */
function estimateHp(cfg: EcuConfig): number {
  // Stock B16A2: 160 HP @ 7600 RPM
  let hp = 160;

  // Compression ratio effect
  const crRatio = cfg.compressionRatio / 10.2;
  hp *= Math.pow(crRatio, 0.3); // ~3% per point of CR

  // Forced induction
  if (cfg.turboEnabled) {
    const boostMultiplier = 1 + (cfg.boostTargetPsi / 14.7) * 0.85;
    hp *= boostMultiplier;
    if (cfg.intercoolerEnabled) hp *= 1 + (cfg.intercoolerEfficiencyPct / 100) * 0.08;
  }
  if (cfg.superchargerEnabled) {
    const scBoost = cfg.superchargerMaxBoostPsi;
    const scEffMult = cfg.superchargerEfficiency / 100;
    hp *= 1 + (scBoost / 14.7) * 0.75 * scEffMult;
  }

  // Nitrous
  if (cfg.nitrousEnabled) {
    hp += cfg.nitrousHpAdder;
  }

  // Cam profile (VTEC high cam)
  const vtecLiftFactor = cfg.vtecIntakeLiftMm / 10.6;
  const vtecDurFactor = cfg.vtecIntakeDuration / 240;
  hp *= 0.85 + 0.15 * vtecLiftFactor * vtecDurFactor;

  // Fuel octane  
  if (cfg.gasolineOctane >= 93) hp *= 1.02;
  if (cfg.gasolineOctane >= 100) hp *= 1.05;
  if (cfg.fuelType === 'e85') hp *= 1.08;

  // Altitude derating
  hp *= 1 - cfg.altitudeFt * 0.00003;

  // Temperature derating
  if (cfg.ambientTempF > 77) hp *= 1 - (cfg.ambientTempF - 77) * 0.002;

  // Exhaust/intake mods approximation from expanded params
  if (cfg.exhaustHeaderType === '4_1_header') hp *= 1.05;
  else if (cfg.exhaustHeaderType === '4_2_1_header') hp *= 1.03;
  if (cfg.intakeType === 'cold_air') hp *= 1.03;
  else if (cfg.intakeType === 'short_ram') hp *= 1.02;
  if (cfg.exhaustCatbackType === 'dual') hp *= 1.02;

  // Redline determines where peak power can be made
  const redlineFactor = Math.min(cfg.redlineRpm / 8200, 1.15);
  hp *= 0.9 + 0.1 * redlineFactor;

  log.debug('autoTune', `Estimated HP: ${hp.toFixed(1)}`, { cfg: summarizeConfig(cfg) });
  return Math.round(hp * 10) / 10;
}

/** Estimate peak torque ft-lb */
function estimateTorque(cfg: EcuConfig, hp: number): number {
  // Torque = HP * 5252 / RPM_at_peak_torque
  // B16A2 peaks torque around 7000 RPM
  const peakTorqueRpm = Math.min(cfg.redlineRpm - 600, 7000);
  let torque = (hp * 5252) / peakTorqueRpm;

  // Boost adds more torque at mid-range
  if (cfg.turboEnabled) {
    torque *= 1 + cfg.boostTargetPsi * 0.01;
  }
  if (cfg.nitrousEnabled) {
    torque += cfg.nitrousHpAdder * 0.7;
  }

  return Math.round(torque * 10) / 10;
}

/** Estimate quarter-mile ET from HP and weight */
function estimateQuarterMile(cfg: EcuConfig, hp: number): number {
  // ET ≈ 5.825 × (weight/hp)^(1/3) — Hale's formula
  const weight = cfg.vehicleMassLb;
  const whp = hp * (1 - cfg.drivetrainLossPct / 100);

  let et = 5.825 * Math.pow(weight / Math.max(whp, 10), 1 / 3);

  // Traction modifier
  if (cfg.tireCompound === 'drag_slick') et *= 0.96;
  else if (cfg.tireCompound === 'full_slick') et *= 0.97;
  else if (cfg.tireCompound === 'semi_slick') et *= 0.98;
  else if (cfg.tireCompound === 'sport') et *= 0.99;

  // FWD penalty (wheel hop, weight transfer disadvantage)
  if (cfg.drivetrainType === 'FWD') et *= 1.02;
  // AWD launch advantage
  if (cfg.drivetrainType === 'AWD') et *= 0.97;

  // Launch control advantage
  if (cfg.launchControlEnabled) et *= 0.99;

  // Weight reduction bonus
  if (cfg.vehicleMassLb < 2200) et *= 0.995;
  if (cfg.vehicleMassLb < 2000) et *= 0.99;

  return Math.round(et * 1000) / 1000;
}

/** Estimate top speed MPH */
function estimateTopSpeed(cfg: EcuConfig, hp: number): number {
  // V_max ≈ cuberoot(2 * P / (ρ * Cd * A)) where P is in watts
  const whp = hp * (1 - cfg.drivetrainLossPct / 100);
  const watts = whp * 745.7;
  const rho = 1.225; // air density kg/m³ at sea level
  const cd = cfg.dragCoefficient;
  const a = cfg.frontalAreaM2;

  // Also check gear-limited top speed
  const topGearRatio = cfg.gearRatios[cfg.gearRatios.length - 1];
  const totalRatio = topGearRatio * cfg.finalDriveRatio;
  const tireCircumFt = cfg.tireDiameterIn * Math.PI / 12;
  const gearLimitedMph = (cfg.redlineRpm / totalRatio) * tireCircumFt * 60 / 5280;

  // Aero-limited top speed
  const aeroLimitedMs = Math.pow((2 * watts) / (rho * cd * a), 1 / 3);
  const aeroLimitedMph = aeroLimitedMs * 2.237;

  return Math.round(Math.min(gearLimitedMph, aeroLimitedMph));
}

/** Summarize config for logging */
function summarizeConfig(cfg: EcuConfig): Record<string, unknown> {
  return {
    turbo: cfg.turboEnabled, boost: cfg.boostTargetPsi,
    nitrous: cfg.nitrousEnabled, nitrousHp: cfg.nitrousHpAdder,
    sc: cfg.superchargerEnabled, cr: cfg.compressionRatio,
    weight: cfg.vehicleMassLb, fuel: cfg.fuelType, octane: cfg.gasolineOctane,
  };
}

// ── Main auto-tune function ────────────────────────────────────────────
export function autoTune(baseConfig: EcuConfig, goal: AutoTuneGoal): AutoTuneResult {
  const t0 = performance.now();
  log.info('autoTune', `Starting auto-tune: target=${goal.targetType} value=${goal.targetValue}`, goal);

  const cfg = { ...baseConfig };
  const changes: AutoTuneChange[] = [];
  const notes: string[] = [];
  const c = goal.constraints;

  function set<K extends keyof EcuConfig>(field: K, value: EcuConfig[K], reason: string) {
    if (cfg[field] !== value) {
      changes.push({ field: String(field), from: cfg[field], to: value, reason });
      (cfg as any)[field] = value;
    }
  }

  // Determine target HP needed based on goal type
  let targetHp: number;
  const currentHp = estimateHp(cfg);

  switch (goal.targetType) {
    case 'horsepower':
      targetHp = goal.targetValue;
      break;
    case 'torque':
      // Rough conversion: HP ≈ torque * peakRpm / 5252
      targetHp = goal.targetValue * 7000 / 5252;
      break;
    case 'quarter_mile': {
      // Reverse Hale's formula: HP = weight / (ET / 5.825)^3
      const weight = cfg.vehicleMassLb;
      const etTarget = goal.targetValue;
      targetHp = weight / Math.pow(etTarget / 5.825, 3);
      // Add overhead for drivetrain loss + traction loss
      targetHp /= (1 - cfg.drivetrainLossPct / 100);
      targetHp *= 1.05; // 5% overhead for real-world traction loss
      break;
    }
    case 'top_speed': {
      // P = 0.5 * ρ * Cd * A * v³ (in watts)
      const vMs = goal.targetValue / 2.237;
      const watts = 0.5 * 1.225 * cfg.dragCoefficient * cfg.frontalAreaM2 * Math.pow(vMs, 3);
      targetHp = (watts / 745.7) / (1 - cfg.drivetrainLossPct / 100);
      break;
    }
    case 'eighth_mile': {
      // 1/8 mile ≈ QM * 0.655 approximately
      const qmEquiv = goal.targetValue / 0.655;
      const weight = cfg.vehicleMassLb;
      targetHp = weight / Math.pow(qmEquiv / 5.825, 3);
      targetHp /= (1 - cfg.drivetrainLossPct / 100);
      break;
    }
    case 'sixty_foot': {
      // 60ft time is mostly traction-dependent, but more power helps
      // Very rough: 60ft ≈ 2.0s for ~300whp FWD, 1.5s for ~500whp AWD
      targetHp = 150 / Math.pow(goal.targetValue / 2.5, 2);
      break;
    }
    default:
      targetHp = goal.targetValue;
  }

  log.info('autoTune', `Target HP needed: ${targetHp.toFixed(1)} (current: ${currentHp.toFixed(1)})`);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: WEIGHT REDUCTION (cheapest HP-per-dollar equivalent)
  // ═══════════════════════════════════════════════════════════════════
  const hpGap = () => targetHp - estimateHp(cfg);

  if (hpGap() > 0 && !c.streetLegal) {
    // Aggressive weight reduction for race builds
    if (cfg.vehicleMassLb > 2200) {
      set('hoodType', 'carbon', 'Lightweight carbon hood (-25 lbs)');
      set('trunkType', 'carbon', 'Lightweight carbon trunk (-15 lbs)');
      set('carpetDelete', true, 'Remove carpet (-15 lbs)');
      set('rearSeatDelete', true, 'Remove rear seats (-30 lbs)');
      const savedLbs = 25 + 15 + 15 + 30;
      set('vehicleMassLb', cfg.vehicleMassLb - savedLbs, `Weight reduction: -${savedLbs} lbs`);
    }
  } else if (hpGap() > 50) {
    // Mild weight reduction
    if (cfg.vehicleMassLb > 2300) {
      set('hoodType', 'fiberglass', 'Fiberglass hood (-20 lbs)');
      set('vehicleMassLb', cfg.vehicleMassLb - 20, 'Weight reduction: -20 lbs');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2: BOLT-ON MODIFICATIONS (intake, exhaust, fuel)
  // ═══════════════════════════════════════════════════════════════════
  if (hpGap() > 0) {
    // Intake
    set('intakeType', 'cold_air', 'Cold air intake (+3-5 HP)');
    set('intakeFilterType', 'oiled_cotton', 'High-flow oiled cotton filter');
    set('throttleBodyDiaMm', 62, 'Larger throttle body');

    // Exhaust
    set('exhaustHeaderType', '4_1_header', '4-1 header (+5-8 HP)');
    set('exhaustCatbackType', 'dual', 'Dual catback exhaust (+2-4 HP)');
    set('exhaustPipeDiaMm', 63, '2.5" exhaust piping');

    if (!c.streetLegal) {
      set('catalyticConverterEnabled', false, 'Remove catalytic converter');
    }

    notes.push('Bolt-on intake/exhaust modifications applied');
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: ENGINE INTERNALS (cam, compression, etc.)
  // ═══════════════════════════════════════════════════════════════════
  if (hpGap() > 15 && (c.allMotor || !c.turboAllowed)) {
    // Higher-lift cams
    set('vtecIntakeLiftMm', 11.4, 'Upgraded intake cam profile (+8 HP)');
    set('vtecExhaustLiftMm', 10.0, 'Upgraded exhaust cam profile');
    set('vtecIntakeDuration', 252, 'Extended intake cam duration');
    set('vtecExhaustDuration', 238, 'Extended exhaust cam duration');

    // Compression bump
    if (c.pumpGasOnly) {
      // Max safe CR on 91 octane pump gas
      set('compressionRatio', Math.min(cfg.compressionRatio + 1.5, 11.5), 'Raised compression for pump gas');
    } else {
      set('compressionRatio', Math.min(cfg.compressionRatio + 2.5, 13.0), 'High compression build');
      set('gasolineOctane', 100, 'Race fuel required for high CR');
    }

    // Rev limit bump with internal work
    set('redlineRpm', Math.min(cfg.redlineRpm + 400, 9000), 'Raised rev limit with stronger internals');
    set('fuelCutRpm', cfg.redlineRpm + 500, 'Raised fuel cut');

    notes.push('Engine internals modified: cams, compression, rev limit');
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4: FORCED INDUCTION (turbo or supercharger)
  // ═══════════════════════════════════════════════════════════════════
  if (hpGap() > 30 && !c.allMotor) {
    if (c.turboAllowed) {
      set('turboEnabled', true, 'Turbocharger installed');
      set('intercoolerEnabled', true, 'Intercooler required with turbo');
      set('intercoolerEfficiencyPct', 80, 'Efficient front-mount intercooler');

      // Calculate boost needed
      const currentHpNow = estimateHp(cfg);
      const hpNeeded = targetHp - currentHpNow + 20; // 20HP overhead
      const boostPsi = Math.min(Math.max((hpNeeded / currentHpNow) * 14.7, 5), 35);

      set('boostTargetPsi', Math.round(boostPsi * 10) / 10, `Target boost: ${boostPsi.toFixed(1)} PSI`);
      set('boostCutPsi', Math.round(boostPsi + 5), 'Boost cut safety margin');
      set('wastegateBaseDuty', 50, 'Wastegate duty cycle');
      set('mapSensorMaxKpa', boostPsi > 15 ? 300 : 200, 'Upgraded MAP sensor for boost');

      // Fuel system upgrades for boost
      if (boostPsi > 10) {
        set('injectorSizeCc', 550, 'Larger injectors for boost');
        set('fuelPressurePsi', 50, 'Higher fuel pressure');
        set('targetAfrWot', 11.5, 'Rich WOT AFR for boost safety');
      }
      if (boostPsi > 20) {
        set('injectorSizeCc', 750, 'High-capacity injectors');
        set('injectorStagingEnabled', true, 'Secondary injector staging');
        set('injectorStagingSizeCc', 550, 'Secondary injectors');
        set('fuelPressurePsi', 58, 'High-boost fuel pressure');
      }

      // Compression reduction for turbo
      if (cfg.compressionRatio > 10.0 && boostPsi > 10) {
        set('compressionRatio', 9.0, 'Reduced compression for turbo reliability');
      }
      if (boostPsi > 20) {
        set('compressionRatio', 8.5, 'Low compression for high boost');
      }

      // Fuel octane for turbo
      if (c.pumpGasOnly) {
        set('gasolineOctane', 93, 'Premium pump gas required for turbo');
        if (boostPsi > 18) {
          notes.push('⚠️ Requested power may not be safe on pump gas at this boost level');
        }
      } else {
        set('gasolineOctane', 100, 'Race fuel recommended');
        set('fuelType', 'e85', 'E85 for knock resistance and power');
      }

      notes.push(`Turbo configuration: ${boostPsi.toFixed(1)} PSI target`);

    } else if (c.superchargerAllowed) {
      set('superchargerEnabled', true, 'Supercharger installed');
      set('superchargerType', 'centrifugal', 'Centrifugal supercharger');
      const boostNeeded = Math.min(((targetHp / estimateHp(cfg)) - 1) * 14.7, 15);
      set('superchargerMaxBoostPsi', Math.round(boostNeeded), 'Supercharger boost target');
      set('intercoolerEnabled', true, 'Intercooler for charge cooling');
      notes.push('Supercharger configuration applied');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 5: NITROUS OXIDE
  // ═══════════════════════════════════════════════════════════════════
  if (hpGap() > 0 && c.nitrousAllowed) {
    const nitrousNeeded = Math.min(Math.max(hpGap(), 25), 200);
    set('nitrousEnabled', true, `Nitrous oxide: +${nitrousNeeded} HP shot`);
    set('nitrousHpAdder', Math.round(nitrousNeeded), `${nitrousNeeded} HP nitrous kit`);
    set('nitrousActivationRpm', 3500, 'Nitrous activation above 3500 RPM');
    set('nitrousFullThrottleOnly', true, 'WOT-only nitrous safety');

    // Retard timing for nitrous safety
    set('baseTimingDeg', cfg.baseTimingDeg - 2, 'Retard timing for nitrous');
    set('targetAfrWot', Math.min(cfg.targetAfrWot, 11.8), 'Rich AFR for nitrous safety');

    // Bigger injectors if needed
    if (nitrousNeeded > 75 && cfg.injectorSizeCc < 370) {
      set('injectorSizeCc', 440, 'Larger injectors for nitrous');
    }

    notes.push(`Nitrous oxide: ${nitrousNeeded} HP wet shot`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 6: DRIVETRAIN OPTIMIZATION
  // ═══════════════════════════════════════════════════════════════════
  const finalHp = estimateHp(cfg);

  // Traction optimization for drag racing goals
  if (goal.targetType === 'quarter_mile' || goal.targetType === 'sixty_foot') {
    if (c.tireDragSlick) {
      set('tireCompound', 'drag_slick', 'Drag slicks for maximum traction');
      set('tireGripCoeff', 1.6, 'Drag slick grip coefficient');
      set('tireWidthMm', 245, 'Wider rear tires for traction');
    } else if (!c.streetLegal) {
      set('tireCompound', 'semi_slick', 'Semi-slick tires for improved traction');
      set('tireGripCoeff', 1.2, 'Semi-slick grip coefficient');
    } else {
      set('tireCompound', 'sport', 'Sport tires for better traction');
      set('tireGripCoeff', 1.05, 'Sport tire grip');
    }

    // Launch control for drag
    set('launchControlEnabled', true, 'Launch control for consistent launches');
    set('launchControlRpm', finalHp > 300 ? 5500 : 4500, 'Optimized launch RPM');
    set('twoStepEnabled', true, 'Two-step rev limiter for launch');
    set('twoStepRpm', finalHp > 300 ? 5500 : 4500, 'Two-step RPM');

    // Traction control
    set('tractionControlEnabled', true, 'Traction control for launch');
    set('tractionControlMode', finalHp > 400 ? 'aggressive' : 'moderate', 'TC aggressiveness');

    // LSD for power-down
    set('frontDiffType', 'lsd', 'Limited slip diff for traction');

    // Clutch upgrade for power
    if (finalHp > 200) {
      set('clutchMaxTorqueNm', Math.max(cfg.clutchMaxTorqueNm, finalHp * 1.2), 'Upgraded clutch for power');
    }

    // Shorter final drive for acceleration
    if (finalHp < 250) {
      set('finalDriveRatio', 4.785, 'Shorter final drive for acceleration');
    }
  }

  // Top speed optimization
  if (goal.targetType === 'top_speed') {
    // Check if gearing limits top speed
    const topGearRatio = cfg.gearRatios[cfg.gearRatios.length - 1];
    const totalRatio = topGearRatio * cfg.finalDriveRatio;
    const tireCircumFt = cfg.tireDiameterIn * Math.PI / 12;
    const currentGearLimit = (cfg.redlineRpm / totalRatio) * tireCircumFt * 60 / 5280;

    if (currentGearLimit < goal.targetValue * 1.05) {
      // Need taller gearing
      set('finalDriveRatio', 4.058, 'Taller final drive for top speed');
      set('gearRatios', [3.230, 2.105, 1.458, 1.107, 0.756], 'Taller 5th gear for top speed');
      notes.push('Gearing changed for higher top speed');
    }

    // Aero optimization
    set('dragCoefficient', Math.max(cfg.dragCoefficient - 0.03, 0.25), 'Aero optimization');
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 7: ECU TUNING (timing, fueling, VTEC)
  // ═══════════════════════════════════════════════════════════════════
  if (finalHp > 180) {
    set('baseTimingDeg', 14, 'Optimized base timing');
    set('maxAdvanceDeg', cfg.turboEnabled ? 32 : 42, 'Optimized advance limit');
    set('vtecEngageRpm', 4800, 'Earlier VTEC engagement');
    set('targetAfrCruise', 14.7, 'Stoich cruise for efficiency');
  }

  if (finalHp > 250) {
    set('o2SensorType', 'wideband', 'Wideband O2 for precise tuning');
    set('dataLogEnabled', true, 'Data logging for tuning');
    set('dataLogRateHz', 50, 'High-rate data logging');
    set('egtSensorEnabled', true, 'EGT monitoring');
  }

  // Safety systems for high-power builds
  if (finalHp > 350) {
    if (c.safetyRating === 'full_cage') {
      set('rollCageType', '10_point', '10-point roll cage for safety');
      set('harnessType', '5_point', '5-point harness');
      set('fireExtinguisherType', 'plumbed', 'Plumbed fire suppression');
      set('killSwitchEnabled', true, 'Battery kill switch');
    }
    set('shiftTimeMs', 150, 'Faster shift times with upgraded components');
  }

  // ═══════════════════════════════════════════════════════════════════
  // FINAL ESTIMATION
  // ═══════════════════════════════════════════════════════════════════
  const estHp = estimateHp(cfg);
  const estTorque = estimateTorque(cfg, estHp);
  const estQm = estimateQuarterMile(cfg, estHp);
  const estTop = estimateTopSpeed(cfg, estHp);

  const feasible = (() => {
    switch (goal.targetType) {
      case 'horsepower': return estHp >= goal.targetValue * 0.95;
      case 'torque': return estTorque >= goal.targetValue * 0.95;
      case 'quarter_mile': return estQm <= goal.targetValue * 1.05;
      case 'top_speed': return estTop >= goal.targetValue * 0.95;
      default: return true;
    }
  })();

  if (!feasible) {
    notes.push(`⚠️ Target may not be fully achievable with current constraints. Estimated: ${
      goal.targetType === 'quarter_mile' ? `${estQm}s` :
      goal.targetType === 'top_speed' ? `${estTop} MPH` :
      goal.targetType === 'horsepower' ? `${estHp} HP` :
      `${estTorque} ft-lb`
    }`);
  }

  const elapsed = performance.now() - t0;
  log.info('autoTune', `Auto-tune complete in ${elapsed.toFixed(1)}ms`, {
    estHp, estTorque, estQm, estTop, feasible, changesCount: changes.length,
  });

  return {
    config: cfg,
    changes,
    estimatedHp: estHp,
    estimatedTorque: estTorque,
    estimatedQuarterMile: estQm,
    estimatedTopSpeed: estTop,
    feasible,
    notes,
  };
}
