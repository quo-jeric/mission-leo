/**
 * Solar Ephemeris & Shadow Eclipse Geometry
 * Computes solar vector, cylindrical Earth shadow, conical umbra/penumbra, and solar flux fraction.
 */

import {
  ASTRONOMICAL_UNIT,
  R_SUN,
  R_EARTH_EQUATORIAL,
  SOLAR_CONSTANT,
  EARTH_OBLIQUITY_RAD,
  DEG_TO_RAD
} from './constants.js';

// Precomputed conical shadow vertex angles
const TAN_ALPHA_UMBRA = (R_SUN - R_EARTH_EQUATORIAL) / ASTRONOMICAL_UNIT;
const TAN_ALPHA_PENUMBRA = (R_SUN + R_EARTH_EQUATORIAL) / ASTRONOMICAL_UNIT;

/**
 * Computes the Sun unit vector in ECI frame for a given Unix epoch.
 * Reference: Astronomical Almanac low-precision solar coordinates (precision ~0.01 deg).
 * @param {number} epochSeconds Unix timestamp in seconds
 * @returns {[number, number, number]} Unit vector pointing from Earth to Sun in ECI
 */
export function computeSunVectorECI(epochSeconds) {
  // Convert Unix epoch to Julian Date and Julian Centuries from J2000.0
  const jd = epochSeconds / 86400.0 + 2440587.5;
  const tJc = (jd - 2451545.0) / 36525.0;

  // Geometric mean longitude of the Sun (deg)
  const l0 = (280.46646 + 36000.76983 * tJc) % 360.0;

  // Mean anomaly of the Sun (deg)
  const mSun = (357.52911 + 35999.05029 * tJc) % 360.0;
  const mSunRad = mSun * DEG_TO_RAD;

  // Sun equation of center (deg)
  const c = (1.914602 - 0.004817 * tJc) * Math.sin(mSunRad) +
            (0.019993 - 0.000101 * tJc) * Math.sin(2.0 * mSunRad) +
            0.000289 * Math.sin(3.0 * mSunRad);

  // Ecliptic longitude of the Sun (rad)
  const lambdaSunRad = (l0 + c) * DEG_TO_RAD;

  // Sun unit vector in ECI (assuming obliquity of ecliptic)
  const cosLambda = Math.cos(lambdaSunRad);
  const sinLambda = Math.sin(lambdaSunRad);
  const cosEps = Math.cos(EARTH_OBLIQUITY_RAD);
  const sinEps = Math.sin(EARTH_OBLIQUITY_RAD);

  const sx = cosLambda;
  const sy = sinLambda * cosEps;
  const sz = sinLambda * sinEps;

  return [sx, sy, sz];
}

/**
 * Computes Earth shadow status (cylindrical and conical) for a satellite at rEci.
 * @param {[number, number, number]} rEci Satellite position vector in ECI meters
 * @param {[number, number, number]} sEci Sun unit vector in ECI
 * @returns {{ isEclipse: boolean, sunFraction: number, shadowType: "sun" | "penumbra" | "umbra", sParallelM: number, rPerpM: number }}
 */
export function computeShadow(rEci, sEci) {
  // sParallel: projection of satellite position onto Earth-Sun direction (meters)
  // Positive = Sun-facing hemisphere (day)
  // Negative = Anti-Sun hemisphere (behind Earth / night)
  const sParallelM = rEci[0] * sEci[0] + rEci[1] * sEci[1] + rEci[2] * sEci[2];

  // rPerp: perpendicular distance from the Earth-Sun shadow axis (meters)
  const rPerp2 = (rEci[0] * rEci[0] + rEci[1] * rEci[1] + rEci[2] * rEci[2]) - (sParallelM * sParallelM);
  const rPerpM = Math.sqrt(Math.max(0, rPerp2));

  // If satellite is on the sunward side of Earth, it's always in full sunlight
  if (sParallelM >= 0) {
    return {
      isEclipse: false,
      sunFraction: 1.0,
      shadowType: 'sun',
      sParallelM,
      rPerpM
    };
  }

  // Distance behind the Earth along anti-solar axis
  const distBehindEarthM = -sParallelM;

  // Conical shadow boundaries at distance distBehindEarthM
  const rUmbraM = Math.max(0, R_EARTH_EQUATORIAL - distBehindEarthM * TAN_ALPHA_UMBRA);
  const rPenumbraM = R_EARTH_EQUATORIAL + distBehindEarthM * TAN_ALPHA_PENUMBRA;

  if (rPerpM >= rPenumbraM) {
    // Outside shadow cone
    return {
      isEclipse: false,
      sunFraction: 1.0,
      shadowType: 'sun',
      sParallelM,
      rPerpM
    };
  }

  if (rPerpM <= rUmbraM) {
    // Inside total umbra shadow (full eclipse)
    return {
      isEclipse: true,
      sunFraction: 0.0,
      shadowType: 'umbra',
      sParallelM,
      rPerpM
    };
  }

  // In penumbra (partial eclipse)
  const penumbraWidth = rPenumbraM - rUmbraM;
  const sunFraction = penumbraWidth > 0 ? (rPerpM - rUmbraM) / penumbraWidth : 0.0;

  return {
    isEclipse: true,
    sunFraction: Math.max(0.0, Math.min(1.0, sunFraction)),
    shadowType: 'penumbra',
    sParallelM,
    rPerpM
  };
}

/**
 * Computes available solar power flux in W/m^2 given satellite position and epoch.
 * @param {[number, number, number]} rEci Satellite position in ECI meters
 * @param {number} epochSeconds Unix timestamp in seconds
 * @returns {{ solarFluxWPerM2: number, sunFraction: number, isEclipse: boolean, sunVectorECI: [number, number, number] }}
 */
export function computeSolarFlux(rEci, epochSeconds) {
  const sunVector = computeSunVectorECI(epochSeconds);
  const shadow = computeShadow(rEci, sunVector);
  const solarFluxWPerM2 = SOLAR_CONSTANT * shadow.sunFraction;

  return {
    solarFluxWPerM2,
    sunFraction: shadow.sunFraction,
    isEclipse: shadow.isEclipse,
    sunVectorECI: sunVector
  };
}

