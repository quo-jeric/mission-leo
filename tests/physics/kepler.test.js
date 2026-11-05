import { describe, it, expect } from 'vitest';
import {
  solveKepler,
  computeJ2DriftRates,
  keplerToECI,
  normalizeOrbitalElements,
  propagateOrbit
} from '../../server/physics/kepler.js';
import {
  MU_EARTH,
  R_EARTH_EQUATORIAL,
  DEG_TO_RAD,
  RAD_TO_DEG
} from '../../server/physics/constants.js';

describe('Keplerian Mechanics & Newton-Raphson Solver', () => {
  it('solves Kepler equation with high accuracy for circular and eccentric orbits', () => {
    // For circular orbit (e = 0), E = M
    expect(solveKepler(1.25, 0.0)).toBeCloseTo(1.25, 8);

    // For eccentric orbit (e = 0.1, M = PI / 4)
    const e = 0.1;
    const M = Math.PI / 4.0;
    const E = solveKepler(M, e);
    // Verify M = E - e * sin(E)
    const M_recomputed = E - e * Math.sin(E);
    expect(M_recomputed).toBeCloseTo(M, 8);
  });

  it('correctly calculates ISS-like orbit period and velocity at 400 km altitude', () => {
    const altM = 400000.0;
    const a = R_EARTH_EQUATORIAL + altM; // ~6,778,137 m
    const e = 0.001;
    const i = 51.6 * DEG_TO_RAD;

    const drift = computeJ2DriftRates(a, e, i);

    // ISS period is approximately 92.5 - 92.7 minutes
    const periodMinutes = drift.orbitalPeriodSec / 60.0;
    expect(periodMinutes).toBeGreaterThan(92.0);
    expect(periodMinutes).toBeLessThan(93.0);

    // Orbital speed at 400 km is approx 7.67 km/s (7670 m/s)
    const state = keplerToECI({ a, e, i, raan: 0, argP: 0, ma: 0 });
    expect(state.vMPerSec).toBeGreaterThan(7600);
    expect(state.vMPerSec).toBeLessThan(7750);
  });

  it('correctly calculates Sun-Synchronous Orbit (SSO) nodal precession (~0.9856 deg/day)', () => {
    // Standard 600 km SSO orbit has an inclination of ~97.79 degrees
    const altM = 600000.0;
    const a = R_EARTH_EQUATORIAL + altM;
    const e = 0.001;
    const i = 97.79 * DEG_TO_RAD;

    const drift = computeJ2DriftRates(a, e, i);

    // Earth revolves 360 deg in 365.24 days -> 0.9856 deg/day
    // For retrograde SSO, nodal precession is eastward (positive raan drift rate in right ascension)
    expect(drift.raanDriftRateDegPerDay).toBeCloseTo(0.9856, 1);
  });

  it('normalizes human-friendly input units (km, degrees) correctly', () => {
    const input = {
      altitudeKm: 500,
      eccentricity: 0.002,
      inclinationDeg: 98.2,
      raanDeg: 45.0,
      argPDeg: 30.0,
      maDeg: 10.0,
      epoch: 1730000000
    };

    const norm = normalizeOrbitalElements(input);
    expect(norm.a).toBeCloseTo(R_EARTH_EQUATORIAL + 500000, 1);
    expect(norm.e).toBe(0.002);
    expect(norm.i).toBeCloseTo(98.2 * DEG_TO_RAD, 6);
    expect(norm.raan).toBeCloseTo(45.0 * DEG_TO_RAD, 6);
    expect(norm.epoch).toBe(1730000000);
  });

  it('propagates orbital state vectors over time steps with geodetic and eclipse attributes', () => {
    const result = propagateOrbit({
      elements: {
        altitudeKm: 500,
        inclinationDeg: 97.5,
        eccentricity: 0.001
      },
      startTime: 1730000000,
      duration: 300,
      step: 60,
      includeSun: true,
      enableJ2: true
    });

    expect(result.points.length).toBe(6); // 0, 60, 120, 180, 240, 300
    const pt0 = result.points[0];
    expect(pt0.rECI.length).toBe(3);
    expect(pt0.vECI.length).toBe(3);
    expect(pt0.geodetic.latDeg).toBeDefined();
    expect(pt0.geodetic.lonDeg).toBeDefined();
    expect(pt0.geodetic.altM).toBeGreaterThan(450000);
    expect(typeof pt0.isEclipse).toBe('boolean');
    expect(pt0.sunFraction).toBeGreaterThanOrEqual(0.0);
    expect(pt0.sunFraction).toBeLessThanOrEqual(1.0);
  });
});
