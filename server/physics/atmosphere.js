/**
 * Atmospheric Density & Orbital Drag Decay Models
 * Standards: US Standard Atmosphere piecewise exponential density approximation for LEO (150 km - 1000 km)
 */

import {
  MU_EARTH,
  R_EARTH_EQUATORIAL,
  R_EARTH_MEAN
} from './constants.js';

// Piecewise atmospheric scale heights and base densities (US Standard Atmosphere)
// altitude in meters, base density in kg/m^3, scale height in meters
const ATMOSPHERE_TABLE = [
  { h0: 150000, rho0: 2.076e-9, H: 29740 },
  { h0: 200000, rho0: 2.789e-10, H: 37100 },
  { h0: 250000, rho0: 7.248e-11, H: 45540 },
  { h0: 300000, rho0: 2.418e-11, H: 53590 },
  { h0: 400000, rho0: 3.725e-12, H: 58200 },
  { h0: 500000, rho0: 6.967e-13, H: 64000 },
  { h0: 600000, rho0: 1.454e-13, H: 71000 },
  { h0: 700000, rho0: 3.614e-14, H: 79000 },
  { h0: 800000, rho0: 1.135e-14, H: 88000 },
  { h0: 1000000, rho0: 3.561e-15, H: 105000 }
];

/**
 * Computes atmospheric density at a given altitude using piecewise exponential interpolation.
 * @param {number} altitudeM Altitude above Earth surface in meters
 * @returns {number} Atmospheric density in kg/m^3
 */
export function getAtmosphericDensity(altitudeM) {
  // Below 120 km: dense atmosphere (terminal reentry zone)
  if (altitudeM <= 120000) {
    // Sea level to 120km rapid ramp
    return 1.225 * Math.exp(-altitudeM / 7200.0);
  }

  // Above 1000 km: negligible exosphere drag
  if (altitudeM >= 1000000) {
    const top = ATMOSPHERE_TABLE[ATMOSPHERE_TABLE.length - 1];
    return top.rho0 * Math.exp(-(altitudeM - top.h0) / top.H);
  }

  // Find corresponding altitude bracket
  let bracket = ATMOSPHERE_TABLE[0];
  for (let i = ATMOSPHERE_TABLE.length - 1; i >= 0; i--) {
    if (altitudeM >= ATMOSPHERE_TABLE[i].h0) {
      bracket = ATMOSPHERE_TABLE[i];
      break;
    }
  }

  return bracket.rho0 * Math.exp(-(altitudeM - bracket.h0) / bracket.H);
}

/**
 * Computes orbital drag decay rates for a satellite in Low Earth Orbit.
 * @param {object} params
 * @param {number} params.semiMajorAxisM Semi-major axis in meters
 * @param {number} [params.eccentricity=0.0] Eccentricity
 * @param {number} params.massKg Total satellite mass (wet or dry) in kg
 * @param {number} params.dragAreaM2 Cross-sectional drag area in m^2
 * @param {number} [params.cd=2.2] Drag coefficient (typically ~2.2 for LEO spacecraft)
 * @returns {{
 *   densityKgPerM3: number,
 *   daDtMPerSec: number,
 *   altitudeLossMPerDay: number,
 *   perigeeAltM: number,
 *   apogeeAltM: number,
 *   isTerminalReentry: boolean,
 *   estimatedLifetimeDays: number | null
 * }}
 */
export function computeDragDecay(params) {
  const {
    semiMajorAxisM,
    eccentricity = 0.0,
    massKg,
    dragAreaM2,
    cd = 2.2
  } = params;

  if (massKg <= 0 || dragAreaM2 <= 0) {
    throw new Error('Mass and drag area must be strictly positive');
  }

  const perigeeRadiusM = semiMajorAxisM * (1.0 - eccentricity);
  const apogeeRadiusM = semiMajorAxisM * (1.0 + eccentricity);
  const perigeeAltM = perigeeRadiusM - R_EARTH_EQUATORIAL;
  const apogeeAltM = apogeeRadiusM - R_EARTH_EQUATORIAL;

  const isTerminalReentry = perigeeAltM <= 120000;

  // Density at perigee (where drag force is dominant)
  const density = getAtmosphericDensity(perigeeAltM);

  // Secular rate of change of semi-major axis da/dt = - (rho * sqrt(mu * a) * Cd * A) / m
  const daDtMPerSec = - (density * Math.sqrt(MU_EARTH * semiMajorAxisM) * cd * dragAreaM2) / massKg;
  const altitudeLossMPerDay = Math.abs(daDtMPerSec * 86400.0);

  // Ballistic coefficient B = m / (Cd * A)
  const ballisticCoeff = massKg / (cd * dragAreaM2);

  // Approximate lifetime estimation (King-Hele analytical approximation for near-circular LEO)
  let estimatedLifetimeDays = null;
  if (!isTerminalReentry && altitudeLossMPerDay > 1e-4) {
    // Current scale height
    let scaleH = 50000;
    for (const entry of ATMOSPHERE_TABLE) {
      if (perigeeAltM >= entry.h0) scaleH = entry.H;
    }
    // Estimated days to decay down to 120 km
    const altDropM = Math.max(0, perigeeAltM - 120000);
    const estSec = (scaleH * ballisticCoeff) / (density * Math.sqrt(MU_EARTH * semiMajorAxisM));
    estimatedLifetimeDays = Math.max(0.1, (altDropM / scaleH) * (estSec / 86400.0));
  } else if (!isTerminalReentry) {
    // Higher orbits (>800 km) with decades/centuries lifetime
    estimatedLifetimeDays = 365.25 * 25.0; // Cap at 25+ years
  }

  return {
    densityKgPerM3: density,
    daDtMPerSec,
    altitudeLossMPerDay,
    perigeeAltM,
    apogeeAltM,
    isTerminalReentry,
    estimatedLifetimeDays
  };
}
