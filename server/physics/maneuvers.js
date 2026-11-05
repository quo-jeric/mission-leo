/**
 * Orbital Maneuver Planning & Tsiolkovsky Propellant Accounting
 * Standards: Hohmann Transfers, Inclination Adjustments, Combined Burns, Deorbit Burns,
 * and Tsiolkovsky Rocket Equation Impulsive Burn Approximations.
 */

import {
  MU_EARTH,
  R_EARTH_EQUATORIAL,
  G0,
  DEG_TO_RAD
} from './constants.js';

/**
 * Computes a coplanar Hohmann transfer between two circular orbits.
 * @param {number} r1 Initial orbit radius in meters
 * @param {number} r2 Target orbit radius in meters
 * @returns {{
 *   deltaV1: number,
 *   deltaV2: number,
 *   totalDeltaV: number,
 *   transferTimeSec: number,
 *   semiMajorAxisTransferM: number
 * }}
 */
export function computeHohmannTransfer(r1, r2) {
  if (r1 <= R_EARTH_EQUATORIAL || r2 <= R_EARTH_EQUATORIAL) {
    throw new Error('Orbit radii must be greater than Earth surface');
  }

  const aTx = (r1 + r2) / 2.0;

  // Initial circular orbit velocity
  const v1 = Math.sqrt(MU_EARTH / r1);

  // Transfer ellipse velocity at periapsis / burn 1
  const vTx1 = Math.sqrt(MU_EARTH * (2.0 / r1 - 1.0 / aTx));
  const deltaV1 = Math.abs(vTx1 - v1);

  // Transfer ellipse velocity at apoapsis / burn 2
  const vTx2 = Math.sqrt(MU_EARTH * (2.0 / r2 - 1.0 / aTx));

  // Target circular orbit velocity
  const v2 = Math.sqrt(MU_EARTH / r2);
  const deltaV2 = Math.abs(v2 - vTx2);

  const totalDeltaV = deltaV1 + deltaV2;

  // Transfer duration is half the orbital period of transfer ellipse
  const transferTimeSec = Math.PI * Math.sqrt((aTx * aTx * aTx) / MU_EARTH);

  return {
    deltaV1,
    deltaV2,
    totalDeltaV,
    transferTimeSec,
    semiMajorAxisTransferM: aTx
  };
}

/**
 * Computes pure orbital plane change (inclination change) delta-v.
 * @param {number} r Radius at maneuver point in meters
 * @param {number} deltaIRad Change in inclination in radians
 * @returns {{ deltaV: number }}
 */
export function computePlaneChange(r, deltaIRad) {
  const v = Math.sqrt(MU_EARTH / r);
  const deltaV = 2.0 * v * Math.sin(Math.abs(deltaIRad) / 2.0);
  return { deltaV };
}

/**
 * Computes fuel-optimal combined Hohmann transfer with plane change executed at apoapsis.
 * @param {number} r1 Initial orbit radius in meters
 * @param {number} r2 Target orbit radius in meters
 * @param {number} deltaIRad Total inclination change in radians
 * @returns {{
 *   deltaV1: number,
 *   deltaV2: number,
 *   totalDeltaV: number,
 *   transferTimeSec: number,
 *   semiMajorAxisTransferM: number
 * }}
 */
export function computeCombinedTransfer(r1, r2, deltaIRad) {
  const aTx = (r1 + r2) / 2.0;

  // Burn 1 at r1 (pure in-plane raise)
  const v1 = Math.sqrt(MU_EARTH / r1);
  const vTx1 = Math.sqrt(MU_EARTH * (2.0 / r1 - 1.0 / aTx));
  const deltaV1 = Math.abs(vTx1 - v1);

  // Burn 2 at r2: Vector subtraction of v2 and vTx2 with angle deltaI
  const vTx2 = Math.sqrt(MU_EARTH * (2.0 / r2 - 1.0 / aTx));
  const v2 = Math.sqrt(MU_EARTH / r2);

  // Law of Cosines for vector difference: |v2 - vTx2|^2 = vTx2^2 + v2^2 - 2*vTx2*v2*cos(deltaI)
  const deltaV2 = Math.sqrt(vTx2 * vTx2 + v2 * v2 - 2.0 * vTx2 * v2 * Math.cos(deltaIRad));

  const totalDeltaV = deltaV1 + deltaV2;
  const transferTimeSec = Math.PI * Math.sqrt((aTx * aTx * aTx) / MU_EARTH);

  return {
    deltaV1,
    deltaV2,
    totalDeltaV,
    transferTimeSec,
    semiMajorAxisTransferM: aTx
  };
}

/**
 * Computes a de-orbit retrograde burn to lower perigee to entry interface (default 80 km).
 * @param {number} rInitial Current orbit radius in meters
 * @param {number} [targetPerigeeAltM=80000] Target perigee altitude in meters
 * @returns {{ deltaV: number, targetPerigeeRadiusM: number, transferTimeSec: number }}
 */
export function computeDeorbitBurn(rInitial, targetPerigeeAltM = 80000) {
  const rTarget = R_EARTH_EQUATORIAL + targetPerigeeAltM;
  const aTx = (rInitial + rTarget) / 2.0;

  const vInitial = Math.sqrt(MU_EARTH / rInitial);
  const vApo = Math.sqrt(MU_EARTH * (2.0 / rInitial - 1.0 / aTx));

  const deltaV = vInitial - vApo;
  const transferTimeSec = Math.PI * Math.sqrt((aTx * aTx * aTx) / MU_EARTH);

  return {
    deltaV: Math.max(0, deltaV),
    targetPerigeeRadiusM: rTarget,
    transferTimeSec
  };
}

/**
 * Calculates propellant mass consumed and burn duration using the Tsiolkovsky rocket equation.
 * @param {object} params
 * @param {number} params.deltaV Required delta-v in m/s
 * @param {number} params.wetMassKg Spacecraft wet mass before burn in kg
 * @param {number} params.ispSeconds Thruster specific impulse in seconds
 * @param {number} [params.thrustN] Thruster force in Newtons (optional, for burn time calculation)
 * @returns {{
 *   fuelUsedKg: number,
 *   finalMassKg: number,
 *   massRatio: number,
 *   burnDurationSec?: number
 * }}
 */
export function computePropellantUsage(params) {
  const { deltaV, wetMassKg, ispSeconds, thrustN } = params;

  if (wetMassKg <= 0 || ispSeconds <= 0) {
    throw new Error('Wet mass and Isp must be strictly positive');
  }

  // Delta-V / (Isp * g0)
  const exponent = deltaV / (ispSeconds * G0);
  const massRatio = Math.exp(exponent);

  const finalMassKg = wetMassKg / massRatio;
  const fuelUsedKg = wetMassKg - finalMassKg;

  const result = {
    fuelUsedKg,
    finalMassKg,
    massRatio
  };

  if (thrustN && thrustN > 0) {
    // Mass flow rate m_dot = F / (Isp * g0)
    const mDot = thrustN / (ispSeconds * G0);
    result.burnDurationSec = fuelUsedKg / mDot;
  }

  return result;
}

/**
 * High-level maneuver calculation endpoint handler.
 * Accepts human-friendly orbit parameters and satellite stats.
 * @param {object} payload
 * @returns {object}
 */
export function planManeuver(payload) {
  const {
    maneuverType, // "hohmann" | "plane_change" | "combined" | "deorbit"
    currentOrbit,
    targetOrbit,
    satellite
  } = payload;

  if (!currentOrbit) throw new Error('Missing currentOrbit');

  const r1 = currentOrbit.a || (currentOrbit.altitudeKm ? R_EARTH_EQUATORIAL + currentOrbit.altitudeKm * 1000 : null);
  if (!r1) throw new Error('currentOrbit must specify altitudeKm or a');

  const wetMassKg = satellite?.wetMassKg || satellite?.massKg || 10.0;
  const ispSeconds = satellite?.ispSeconds || 220.0;
  const thrustN = satellite?.thrustN || null;

  let deltaVResult;

  if (maneuverType === 'deorbit') {
    const targetAltM = (targetOrbit?.altitudeKm ? targetOrbit.altitudeKm * 1000 : (targetOrbit?.altM || 80000));
    const deorbit = computeDeorbitBurn(r1, targetAltM);
    deltaVResult = {
      deltaV1: deorbit.deltaV,
      deltaV2: 0,
      totalDeltaV: deorbit.deltaV,
      transferTimeSec: deorbit.transferTimeSec
    };
  } else if (maneuverType === 'plane_change') {
    const i1 = currentOrbit.inclinationDeg !== undefined ? currentOrbit.inclinationDeg * DEG_TO_RAD : (currentOrbit.i || 0);
    const i2 = targetOrbit?.inclinationDeg !== undefined ? targetOrbit.inclinationDeg * DEG_TO_RAD : (targetOrbit?.i || 0);
    const deltaI = Math.abs(i2 - i1);
    const pc = computePlaneChange(r1, deltaI);
    deltaVResult = {
      deltaV1: pc.deltaV,
      deltaV2: 0,
      totalDeltaV: pc.deltaV,
      transferTimeSec: 0
    };
  } else if (maneuverType === 'combined') {
    const r2 = targetOrbit?.a || (targetOrbit?.altitudeKm ? R_EARTH_EQUATORIAL + targetOrbit.altitudeKm * 1000 : r1);
    const i1 = currentOrbit.inclinationDeg !== undefined ? currentOrbit.inclinationDeg * DEG_TO_RAD : (currentOrbit.i || 0);
    const i2 = targetOrbit?.inclinationDeg !== undefined ? targetOrbit.inclinationDeg * DEG_TO_RAD : (targetOrbit?.i || 0);
    const deltaI = Math.abs(i2 - i1);
    deltaVResult = computeCombinedTransfer(r1, r2, deltaI);
  } else {
    // Default: Hohmann transfer
    const r2 = targetOrbit?.a || (targetOrbit?.altitudeKm ? R_EARTH_EQUATORIAL + targetOrbit.altitudeKm * 1000 : null);
    if (!r2) throw new Error('targetOrbit must specify altitudeKm or a');
    deltaVResult = computeHohmannTransfer(r1, r2);
  }

  const propUsage = computePropellantUsage({
    deltaV: deltaVResult.totalDeltaV,
    wetMassKg,
    ispSeconds,
    thrustN
  });

  return {
    maneuverType: maneuverType || 'hohmann',
    deltaV1MPerSec: Number(deltaVResult.deltaV1.toFixed(2)),
    deltaV2MPerSec: Number(deltaVResult.deltaV2.toFixed(2)),
    totalDeltaVMPerSec: Number(deltaVResult.totalDeltaV.toFixed(2)),
    transferTimeSeconds: Number(deltaVResult.transferTimeSec.toFixed(1)),
    fuelUsedKg: Number(propUsage.fuelUsedKg.toFixed(3)),
    finalMassKg: Number(propUsage.finalMassKg.toFixed(3)),
    burnDurationSeconds: propUsage.burnDurationSec ? Number(propUsage.burnDurationSec.toFixed(1)) : null
  };
}

