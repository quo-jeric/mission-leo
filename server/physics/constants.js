/**
 * Astrodynamic and Planetary Constants
 * Standards: WGS-84 Earth Ellipsoid, Standard Gravitational Parameter, IAU Sun Constants
 */

// Gravitational parameter for Earth (m^3 / s^2)
export const MU_EARTH = 3.986004418e14; // m^3/s^2 (398,600.4418 km^3/s^2)

// WGS-84 Earth Ellipsoid Dimensions
export const R_EARTH_EQUATORIAL = 6378137.0; // Equatorial radius (semi-major axis) in meters
export const R_EARTH_POLAR = 6356752.314245; // Polar radius (semi-minor axis) in meters
export const R_EARTH_MEAN = 6371000.0; // Volumetric mean radius in meters
export const EARTH_FLATTENING = 1.0 / 298.257223563; // f = (a - b) / a

// First and second eccentricities squared of WGS-84 ellipsoid
export const EARTH_E2 = 2.0 * EARTH_FLATTENING - EARTH_FLATTENING * EARTH_FLATTENING; // ~0.00669437999014
export const EARTH_E_PRIME2 = (R_EARTH_EQUATORIAL * R_EARTH_EQUATORIAL - R_EARTH_POLAR * R_EARTH_POLAR) / (R_EARTH_POLAR * R_EARTH_POLAR); // ~0.00673949674228

// Earth Gravitational Harmonics
export const J2_EARTH = 1.08262668e-3; // Second zonal harmonic (oblateness perturbation)

// Earth Kinematics
export const EARTH_ROTATION_RATE = 7.2921159e-5; // rad/s (nominal angular velocity)
export const SIDEREAL_DAY_SECONDS = 86164.0905; // 23h 56m 4.0905s

// Standard Sea-Level Gravity
export const G0 = 9.80665; // m/s^2

// Astronomical & Solar Constants
export const ASTRONOMICAL_UNIT = 1.495978707e11; // 1 AU in meters
export const R_SUN = 6.9634e8; // Radius of the Sun in meters
export const SOLAR_CONSTANT = 1361.0; // W/m^2 at 1 AU
export const EARTH_OBLIQUITY_RAD = 0.409092804; // 23.4392911 degrees in radians

// Mathematical & Conversion Constants
export const DEG_TO_RAD = Math.PI / 180.0;
export const RAD_TO_DEG = 180.0 / Math.PI;
export const TWO_PI = 2.0 * Math.PI;

/**
 * Normalizes an angle to the range [0, 2*PI)
 * @param {number} angle in radians
 * @returns {number} normalized angle in radians
 */
export function normalizeAngle(angle) {
  let a = angle % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
}

/**
 * Normalizes longitude to [-180, 180] degrees
 * @param {number} lonDeg longitude in degrees
 * @returns {number} normalized longitude in degrees
 */
export function normalizeLongitudeDeg(lonDeg) {
  let l = ((lonDeg + 180) % 360) - 180;
  if (l < -180) l += 360;
  return l;
}

/**
 * Normalizes latitude to [-90, 90] degrees (clamped)
 * @param {number} latDeg latitude in degrees
 * @returns {number} clamped latitude in degrees
 */
export function clampLatitudeDeg(latDeg) {
  return Math.max(-90, Math.min(90, latDeg));
}

