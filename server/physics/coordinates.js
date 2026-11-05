/**
 * Coordinate Systems & Transformations
 * Standards: ECI (J2000), ECEF, WGS-84 Geodetic (Bowring's closed-form algorithm), Topocentric SEZ
 */

import {
  R_EARTH_EQUATORIAL,
  R_EARTH_POLAR,
  EARTH_E2,
  EARTH_E_PRIME2,
  EARTH_ROTATION_RATE,
  DEG_TO_RAD,
  RAD_TO_DEG,
  TWO_PI,
  normalizeAngle,
  normalizeLongitudeDeg
} from './constants.js';

/**
 * Computes Greenwich Mean Sidereal Time (GMST) in radians for a given UTC epoch in Unix seconds.
 * Reference: Astronomical Almanac / Vallado Fundamentals of Astrodynamics
 * @param {number} epochSeconds Unix timestamp in seconds
 * @returns {number} GMST in radians [0, 2*PI)
 */
export function computeGMST(epochSeconds) {
  // Convert Unix epoch to Julian Date (JD)
  // Unix epoch 0 (1970-01-01 00:00:00 UTC) = JD 2440587.5
  const jd = epochSeconds / 86400.0 + 2440587.5;
  const d = jd - 2451545.0; // Days from J2000.0

  // GMST in degrees: 280.46061837 + 360.98564736629 * d
  const gmstDeg = (280.46061837 + 360.98564736629 * d) % 360.0;
  const gmstRad = normalizeAngle((gmstDeg < 0 ? gmstDeg + 360.0 : gmstDeg) * DEG_TO_RAD);
  return gmstRad;
}

/**
 * Transforms position and velocity from ECI (Earth-Centered Inertial) to ECEF (Earth-Centered Earth-Fixed).
 * @param {[number, number, number]} rEci Position vector in meters [x, y, z]
 * @param {[number, number, number]} [vEci] Velocity vector in m/s [vx, vy, vz]
 * @param {number} gmstRad Greenwich Mean Sidereal Time in radians
 * @returns {{ rEcef: [number, number, number], vEcef?: [number, number, number] }}
 */
export function eciToEcef(rEci, vEci, gmstRad) {
  const cosT = Math.cos(gmstRad);
  const sinT = Math.sin(gmstRad);

  const xEci = rEci[0];
  const yEci = rEci[1];
  const zEci = rEci[2];

  // Rotate around Z axis by -gmst
  const xEcef = cosT * xEci + sinT * yEci;
  const yEcef = -sinT * xEci + cosT * yEci;
  const zEcef = zEci;

  const result = {
    rEcef: [xEcef, yEcef, zEcef]
  };

  if (vEci) {
    const vxEci = vEci[0];
    const vyEci = vEci[1];
    const vzEci = vEci[2];

    // Inertial velocity rotated into ECEF orientation
    const vxRot = cosT * vxEci + sinT * vyEci;
    const vyRot = -sinT * vxEci + cosT * vyEci;
    const vzRot = vzEci;

    // Relative velocity: v_ecef = v_rot - omega x r_ecef
    // omega x r_ecef = [-omega * yEcef, omega * xEcef, 0]
    const vxEcef = vxRot + EARTH_ROTATION_RATE * yEcef;
    const vyEcef = vyRot - EARTH_ROTATION_RATE * xEcef;
    const vzEcef = vzRot;

    result.vEcef = [vxEcef, vyEcef, vzEcef];
  }

  return result;
}

/**
 * Transforms position from ECEF to ECI.
 * @param {[number, number, number]} rEcef Position in meters [x, y, z]
 * @param {number} gmstRad Greenwich Mean Sidereal Time in radians
 * @returns {[number, number, number]} Position in ECI meters [x, y, z]
 */
export function ecefToEci(rEcef, gmstRad) {
  const cosT = Math.cos(gmstRad);
  const sinT = Math.sin(gmstRad);

  const x = cosT * rEcef[0] - sinT * rEcef[1];
  const y = sinT * rEcef[0] + cosT * rEcef[1];
  const z = rEcef[2];

  return [x, y, z];
}

/**
 * Converts ECEF coordinates to WGS-84 Geodetic coordinates using Bowring's closed-form algorithm.
 * High precision (< 1 mm error) for all practical LEO altitudes.
 * @param {[number, number, number]} rEcef Position in meters [x, y, z]
 * @returns {{ latDeg: number, lonDeg: number, altM: number, latRad: number, lonRad: number }}
 */
export function ecefToGeodetic(rEcef) {
  const x = rEcef[0];
  const y = rEcef[1];
  const z = rEcef[2];

  const p = Math.hypot(x, y); // sqrt(x^2 + y^2)

  // Longitude: atan2(y, x)
  const lonRad = Math.atan2(y, x);
  const lonDeg = normalizeLongitudeDeg(lonRad * RAD_TO_DEG);

  // Handle polar singularities
  if (p < 1e-6) {
    const latRad = z >= 0 ? Math.PI / 2.0 : -Math.PI / 2.0;
    const altM = Math.abs(z) - R_EARTH_POLAR;
    return {
      latDeg: latRad * RAD_TO_DEG,
      lonDeg,
      altM,
      latRad,
      lonRad
    };
  }

  // Bowring's parameter theta: atan((z * a) / (p * b))
  const theta = Math.atan2(z * R_EARTH_EQUATORIAL, p * R_EARTH_POLAR);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  // Geodetic latitude phi
  const num = z + EARTH_E_PRIME2 * R_EARTH_POLAR * sinTheta * sinTheta * sinTheta;
  const den = p - EARTH_E2 * R_EARTH_EQUATORIAL * cosTheta * cosTheta * cosTheta;
  const latRad = Math.atan2(num, den);

  // Prime vertical radius of curvature N(phi)
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const N = R_EARTH_EQUATORIAL / Math.sqrt(1.0 - EARTH_E2 * sinLat * sinLat);

  // Geodetic altitude above WGS-84 ellipsoid
  const altM = p / cosLat - N;

  return {
    latDeg: latRad * RAD_TO_DEG,
    lonDeg,
    altM,
    latRad,
    lonRad
  };
}

/**
 * Converts WGS-84 Geodetic coordinates to ECEF coordinates.
 * @param {number} latRad Geodetic latitude in radians
 * @param {number} lonRad Geodetic longitude in radians
 * @param {number} altM Geodetic altitude in meters
 * @returns {[number, number, number]} ECEF position in meters [x, y, z]
 */
export function geodeticToEcef(latRad, lonRad, altM) {
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);

  const N = R_EARTH_EQUATORIAL / Math.sqrt(1.0 - EARTH_E2 * sinLat * sinLat);

  const x = (N + altM) * cosLat * cosLon;
  const y = (N + altM) * cosLat * sinLon;
  const z = (N * (1.0 - EARTH_E2) + altM) * sinLat;

  return [x, y, z];
}

/**
 * Computes Topocentric SEZ (South, East, Zenith) coordinates and line-of-sight angles from a ground station.
 * @param {[number, number, number]} rEcefSat Satellite position in ECEF meters
 * @param {number} stationLatRad Ground station geodetic latitude in radians
 * @param {number} stationLonRad Ground station geodetic longitude in radians
 * @param {number} stationAltM Ground station geodetic altitude in meters
 * @returns {{ rangeM: number, elevationRad: number, elevationDeg: number, azimuthRad: number, azimuthDeg: number, isVisible: boolean }}
 */
export function topocentricSEZ(rEcefSat, stationLatRad, stationLonRad, stationAltM) {
  const rEcefStation = geodeticToEcef(stationLatRad, stationLonRad, stationAltM);

  // Relative range vector in ECEF
  const dx = rEcefSat[0] - rEcefStation[0];
  const dy = rEcefSat[1] - rEcefStation[1];
  const dz = rEcefSat[2] - rEcefStation[2];

  const sinLat = Math.sin(stationLatRad);
  const cosLat = Math.cos(stationLatRad);
  const sinLon = Math.sin(stationLonRad);
  const cosLon = Math.cos(stationLonRad);

  // Transform ECEF to topocentric SEZ frame:
  // S = sinLat * cosLon * dx + sinLat * sinLon * dy - cosLat * dz
  // E = -sinLon * dx + cosLon * dy
  // Z = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz
  const s = sinLat * cosLon * dx + sinLat * sinLon * dy - cosLat * dz;
  const e = -sinLon * dx + cosLon * dy;
  const z = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz;

  const rangeM = Math.sqrt(s * s + e * e + z * z);

  // Elevation angle: arcsin(z / range)
  const elevationRad = rangeM > 0 ? Math.asin(Math.max(-1.0, Math.min(1.0, z / rangeM))) : 0;
  const elevationDeg = elevationRad * RAD_TO_DEG;

  // Azimuth angle: atan2(E, -S) [0, 2*PI)
  let azimuthRad = Math.atan2(e, -s);
  if (azimuthRad < 0) azimuthRad += TWO_PI;
  const azimuthDeg = azimuthRad * RAD_TO_DEG;

  return {
    rangeM,
    elevationRad,
    elevationDeg,
    azimuthRad,
    azimuthDeg,
    isVisible: elevationDeg >= 0
  };
}

