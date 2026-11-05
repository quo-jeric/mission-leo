/**
 * Keplerian Orbital Mechanics & Perturbations Engine
 * Standards: 6-Element Keplerian Propagation, J2 Nodal/Apsidal Precession, Newton-Raphson Solver,
 * and Perifocal (PQW) to Earth-Centered Inertial (ECI) Vector Transforms.
 */

import {
  MU_EARTH,
  R_EARTH_EQUATORIAL,
  J2_EARTH,
  DEG_TO_RAD,
  RAD_TO_DEG,
  TWO_PI,
  normalizeAngle
} from './constants.js';
import {
  computeGMST,
  eciToEcef,
  ecefToGeodetic
} from './coordinates.js';
import {
  computeSolarFlux
} from './shadow.js';

/**
 * Solves Kepler's Equation M = E - e*sin(E) for Eccentric Anomaly E using Newton-Raphson.
 * @param {number} M Mean anomaly in radians
 * @param {number} e Eccentricity (0 <= e < 1)
 * @param {number} [tolerance=1e-11] Convergence tolerance
 * @param {number} [maxIter=25] Max iterations
 * @returns {number} Eccentric Anomaly E in radians
 */
export function solveKepler(M, e, tolerance = 1e-11, maxIter = 25) {
  // Normalize M to [0, 2*PI)
  const normM = normalizeAngle(M);

  // Initial guess E0
  let E = normM + e * Math.sin(normM) + 0.5 * e * e * Math.sin(2.0 * normM);

  for (let iter = 0; iter < maxIter; iter++) {
    const f = E - e * Math.sin(E) - normM;
    const fPrime = 1.0 - e * Math.cos(E);

    const deltaE = f / fPrime;
    E -= deltaE;

    if (Math.abs(deltaE) < tolerance) {
      return normalizeAngle(E);
    }
  }

  return normalizeAngle(E);
}

/**
 * Computes mean motion n and J2 secular drift rates for RAAN (Omega), Argument of Periapsis (omega), and Mean Anomaly (M).
 * @param {number} a Semi-major axis in meters
 * @param {number} e Eccentricity
 * @param {number} i Inclination in radians
 * @returns {{
 *   meanMotionRadPerSec: number,
 *   orbitalPeriodSec: number,
 *   raanDriftRateRadPerSec: number,
 *   raanDriftRateDegPerDay: number,
 *   argPDriftRateRadPerSec: number,
 *   argPDriftRateDegPerDay: number,
 *   meanAnomalyDriftRateRadPerSec: number
 * }}
 */
export function computeJ2DriftRates(a, e, i) {
  const n0 = Math.sqrt(MU_EARTH / (a * a * a));
  const period = TWO_PI / n0;

  const eta = 1.0 - e * e;
  const eta2 = eta * eta;
  const reOverA = R_EARTH_EQUATORIAL / a;
  const pFactor = reOverA * reOverA / eta2;

  const cosI = Math.cos(i);
  const cos2I = cosI * cosI;

  // Secular J2 drift rates
  // dOmega/dt = -1.5 * n0 * J2 * (Re / p)^2 * cos(i)
  const raanDriftRateRadPerSec = -1.5 * n0 * J2_EARTH * pFactor * cosI;

  // domega/dt = 0.75 * n0 * J2 * (Re / p)^2 * (5*cos^2(i) - 1)
  const argPDriftRateRadPerSec = 0.75 * n0 * J2_EARTH * pFactor * (5.0 * cos2I - 1.0);

  // dM/dt correction = 0.75 * n0 * J2 * (Re / p)^2 * sqrt(1 - e^2) * (3*cos^2(i) - 1)
  const meanAnomalyDriftRateRadPerSec = 0.75 * n0 * J2_EARTH * pFactor * Math.sqrt(eta) * (3.0 * cos2I - 1.0);

  const radPerSecToDegPerDay = (86400.0 * RAD_TO_DEG);

  return {
    meanMotionRadPerSec: n0,
    orbitalPeriodSec: period,
    raanDriftRateRadPerSec,
    raanDriftRateDegPerDay: raanDriftRateRadPerSec * radPerSecToDegPerDay,
    argPDriftRateRadPerSec,
    argPDriftRateDegPerDay: argPDriftRateRadPerSec * radPerSecToDegPerDay,
    meanAnomalyDriftRateRadPerSec
  };
}

/**
 * Converts classical Keplerian elements to Cartesian state vectors (rECI, vECI).
 * @param {object} elements
 * @param {number} elements.a Semi-major axis in meters
 * @param {number} elements.e Eccentricity (0 <= e < 1)
 * @param {number} elements.i Inclination in radians
 * @param {number} elements.raan Right Ascension of Ascending Node (Omega) in radians
 * @param {number} elements.argP Argument of Periapsis (omega) in radians
 * @param {number} [elements.nu] True anomaly in radians (if provided, skips Kepler solver)
 * @param {number} [elements.ma] Mean anomaly in radians (used if nu is not provided)
 * @returns {{
 *   rEci: [number, number, number],
 *   vEci: [number, number, number],
 *   rM: number,
 *   vMPerSec: number,
 *   nuRad: number,
 *   eccentricAnomalyRad: number
 * }}
 */
export function keplerToECI(elements) {
  const { a, e, i, raan, argP } = elements;

  if (a <= 0 || e < 0 || e >= 1.0) {
    throw new Error('Invalid orbital elements: a must be > 0 and 0 <= e < 1');
  }

  let nu = elements.nu;
  let E = 0;

  if (nu === undefined) {
    const ma = elements.ma !== undefined ? elements.ma : 0;
    E = solveKepler(ma, e);

    // True anomaly nu from E
    const sinNu = (Math.sqrt(1.0 - e * e) * Math.sin(E)) / (1.0 - e * Math.cos(E));
    const cosNu = (Math.cos(E) - e) / (1.0 - e * Math.cos(E));
    nu = Math.atan2(sinNu, cosNu);
  } else {
    // Eccentric anomaly E from nu
    const cosNu = Math.cos(nu);
    const sinNu = Math.sin(nu);
    E = Math.atan2(Math.sqrt(1.0 - e * e) * sinNu, e + cosNu);
  }

  // Orbital radius r
  const p = a * (1.0 - e * e); // Semi-latus rectum
  const r = p / (1.0 + e * Math.cos(nu));

  // Perifocal coordinates (PQW)
  const cosNu = Math.cos(nu);
  const sinNu = Math.sin(nu);

  const rP = r * cosNu;
  const rQ = r * sinNu;

  // Velocity components in PQW
  const sqrtMuOverP = Math.sqrt(MU_EARTH / p);
  const vP = -sqrtMuOverP * sinNu;
  const vQ = sqrtMuOverP * (e + cosNu);

  // Direction Cosine Matrix from PQW to ECI:
  // P vector (direction of periapsis in ECI)
  // Q vector (direction of nu = 90 deg in ECI)
  const cosRaan = Math.cos(raan);
  const sinRaan = Math.sin(raan);
  const cosArgP = Math.cos(argP);
  const sinArgP = Math.sin(argP);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);

  const Px = cosRaan * cosArgP - sinRaan * sinArgP * cosI;
  const Py = sinRaan * cosArgP + cosRaan * sinArgP * cosI;
  const Pz = sinArgP * sinI;

  const Qx = -cosRaan * sinArgP - sinRaan * cosArgP * cosI;
  const Qy = -sinRaan * sinArgP + cosRaan * cosArgP * cosI;
  const Qz = cosArgP * sinI;

  const rx = rP * Px + rQ * Qx;
  const ry = rP * Py + rQ * Qy;
  const rz = rP * Pz + rQ * Qz;

  const vx = vP * Px + vQ * Qx;
  const vy = vP * Py + vQ * Qy;
  const vz = vP * Pz + vQ * Qz;

  const vMag = Math.sqrt(vx * vx + vy * vy + vz * vz);

  return {
    rEci: [rx, ry, rz],
    vEci: [vx, vy, vz],
    rM: r,
    vMPerSec: vMag,
    nuRad: normalizeAngle(nu),
    eccentricAnomalyRad: normalizeAngle(E)
  };
}

/**
 * Normalizes user input orbital elements (supporting human-friendly units: km, degrees, or raw SI).
 * @param {object} input
 * @returns {{ a: number, e: number, i: number, raan: number, argP: number, ma: number, epoch: number }}
 */
export function normalizeOrbitalElements(input) {
  if (!input) throw new Error('Missing orbital elements input');

  // Semi-major axis
  let a;
  if (input.a !== undefined) {
    a = input.a > 100000 ? input.a : input.a * 1000.0; // If < 100,000, treat as km
  } else if (input.semiMajorAxisKm !== undefined) {
    a = input.semiMajorAxisKm * 1000.0;
  } else if (input.altitudeKm !== undefined) {
    a = R_EARTH_EQUATORIAL + input.altitudeKm * 1000.0;
  } else if (input.altM !== undefined) {
    a = R_EARTH_EQUATORIAL + input.altM;
  } else {
    throw new Error('Must provide semi-major axis (a, semiMajorAxisKm) or altitude (altitudeKm)');
  }

  // Eccentricity
  const e = input.e !== undefined ? input.e : (input.eccentricity !== undefined ? input.eccentricity : 0.0);

  // Inclination
  let i;
  if (input.inclinationDeg !== undefined) {
    i = input.inclinationDeg * DEG_TO_RAD;
  } else if (input.i !== undefined) {
    // If > PI, likely provided in degrees
    i = input.i > Math.PI ? input.i * DEG_TO_RAD : input.i;
  } else {
    i = 0.0;
  }

  // RAAN (Longitude of Ascending Node)
  let raan;
  if (input.raanDeg !== undefined) {
    raan = input.raanDeg * DEG_TO_RAD;
  } else if (input.raan !== undefined) {
    raan = input.raan > TWO_PI ? input.raan * DEG_TO_RAD : input.raan;
  } else {
    raan = 0.0;
  }

  // Argument of Periapsis
  let argP;
  if (input.argPDeg !== undefined) {
    argP = input.argPDeg * DEG_TO_RAD;
  } else if (input.argP !== undefined) {
    argP = input.argP > TWO_PI ? input.argP * DEG_TO_RAD : input.argP;
  } else {
    argP = 0.0;
  }

  // Mean Anomaly
  let ma;
  if (input.maDeg !== undefined) {
    ma = input.maDeg * DEG_TO_RAD;
  } else if (input.ma !== undefined) {
    ma = input.ma > TWO_PI ? input.ma * DEG_TO_RAD : input.ma;
  } else if (input.nuDeg !== undefined) {
    // Convert true anomaly to mean anomaly for initialization
    const nu = input.nuDeg * DEG_TO_RAD;
    const cosNu = Math.cos(nu);
    const sinNu = Math.sin(nu);
    const E = Math.atan2(Math.sqrt(1.0 - e * e) * sinNu, e + cosNu);
    ma = E - e * Math.sin(E);
  } else {
    ma = 0.0;
  }

  // Epoch (Unix timestamp in seconds)
  const epoch = input.epoch !== undefined ? input.epoch : Math.floor(Date.now() / 1000);

  return {
    a,
    e,
    i: normalizeAngle(i),
    raan: normalizeAngle(raan),
    argP: normalizeAngle(argP),
    ma: normalizeAngle(ma),
    epoch
  };
}

/**
 * Propagates Keplerian elements over a time duration with J2 secular perturbations and shadow evaluation.
 * @param {object} params
 * @param {object} params.elements Orbital elements (normalized or human-friendly)
 * @param {number} [params.startTime] Epoch to start propagation (seconds, defaults to elements.epoch)
 * @param {number} params.duration Propagation duration in seconds
 * @param {number} [params.step=60] Time-step between trajectory points in seconds
 * @param {boolean} [params.includeSun=true] Whether to compute eclipse and solar illumination
 * @param {boolean} [params.enableJ2=true] Whether to apply J2 secular drift
 * @returns {{
 *   periodSec: number,
 *   semiMajorAxisM: number,
 *   eccentricity: number,
 *   inclinationDeg: number,
 *   driftRates: object,
 *   points: Array<{
 *     time: number,
 *     rECI: [number, number, number],
 *     vECI: [number, number, number],
 *     geodetic: { latDeg: number, lonDeg: number, altM: number },
 *     speedMPerSec: number,
 *     radiusM: number,
 *     trueAnomalyDeg: number,
 *     isEclipse?: boolean,
 *     sunFraction?: number,
 *     solarFluxWPerM2?: number
 *   }>
 * }}
 */
export function propagateOrbit(params) {
  const normElements = normalizeOrbitalElements(params.elements);
  const { a, e, i, raan, argP, ma, epoch } = normElements;

  const startTime = params.startTime !== undefined ? params.startTime : epoch;
  const duration = params.duration !== undefined ? params.duration : 6000;
  const step = Math.max(1, params.step !== undefined ? params.step : 60);
  const includeSun = params.includeSun !== false;
  const enableJ2 = params.enableJ2 !== false;

  const drift = computeJ2DriftRates(a, e, i);
  const n0 = drift.meanMotionRadPerSec;
  const dOmegaDt = enableJ2 ? drift.raanDriftRateRadPerSec : 0.0;
  const domegaDt = enableJ2 ? drift.argPDriftRateRadPerSec : 0.0;
  const dMDt = enableJ2 ? (n0 + drift.meanAnomalyDriftRateRadPerSec) : n0;

  const points = [];
  const numSteps = Math.floor(duration / step);

  for (let s = 0; s <= numSteps; s++) {
    const t = startTime + s * step;
    const dtFromEpoch = t - epoch;

    // Time-updated elements under J2
    const currentRaan = normalizeAngle(raan + dOmegaDt * dtFromEpoch);
    const currentArgP = normalizeAngle(argP + domegaDt * dtFromEpoch);
    const currentMa = normalizeAngle(ma + dMDt * dtFromEpoch);

    // Compute Cartesian ECI state
    const state = keplerToECI({
      a,
      e,
      i,
      raan: currentRaan,
      argP: currentArgP,
      ma: currentMa
    });

    // Compute ECEF & Geodetic
    const gmst = computeGMST(t);
    const ecef = eciToEcef(state.rEci, state.vEci, gmst);
    const geodetic = ecefToGeodetic(ecef.rEcef);

    const point = {
      time: t,
      rECI: [
        Number(state.rEci[0].toFixed(2)),
        Number(state.rEci[1].toFixed(2)),
        Number(state.rEci[2].toFixed(2))
      ],
      vECI: [
        Number(state.vEci[0].toFixed(3)),
        Number(state.vEci[1].toFixed(3)),
        Number(state.vEci[2].toFixed(3))
      ],
      geodetic: {
        latDeg: Number(geodetic.latDeg.toFixed(4)),
        lonDeg: Number(geodetic.lonDeg.toFixed(4)),
        altM: Number(geodetic.altM.toFixed(1))
      },
      speedMPerSec: Number(state.vMPerSec.toFixed(2)),
      radiusM: Number(state.rM.toFixed(1)),
      trueAnomalyDeg: Number((state.nuRad * RAD_TO_DEG).toFixed(3))
    };

    if (includeSun) {
      const solar = computeSolarFlux(state.rEci, t);
      point.isEclipse = solar.isEclipse;
      point.sunFraction = Number(solar.sunFraction.toFixed(3));
      point.solarFluxWPerM2 = Number(solar.solarFluxWPerM2.toFixed(1));
    }

    points.push(point);
  }

  return {
    periodSec: Number(drift.orbitalPeriodSec.toFixed(2)),
    semiMajorAxisM: a,
    eccentricity: e,
    inclinationDeg: Number((i * RAD_TO_DEG).toFixed(4)),
    driftRates: {
      raanDegPerDay: Number(drift.raanDriftRateDegPerDay.toFixed(5)),
      argPDegPerDay: Number(drift.argPDriftRateDegPerDay.toFixed(5))
    },
    points
  };
}
