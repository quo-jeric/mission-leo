import { describe, it, expect } from 'vitest';
import {
  computeSunVectorECI,
  computeShadow,
  computeSolarFlux
} from '../../server/physics/shadow.js';
import {
  R_EARTH_EQUATORIAL,
  SOLAR_CONSTANT
} from '../../server/physics/constants.js';

describe('Solar Ephemeris & Shadow Eclipse Geometry', () => {
  it('computes unit-normalized Sun position vector in ECI', () => {
    const epoch = 1730000000;
    const sEci = computeSunVectorECI(epoch);

    expect(sEci.length).toBe(3);
    const mag = Math.sqrt(sEci[0] * sEci[0] + sEci[1] * sEci[1] + sEci[2] * sEci[2]);
    expect(mag).toBeCloseTo(1.0, 6);
  });

  it('detects daylight condition when satellite is on the sunward side', () => {
    const sunVector = [1.0, 0.0, 0.0]; // Sun along +X
    const rSatSunSide = [7000000.0, 0.0, 0.0]; // Satellite along +X

    const shadow = computeShadow(rSatSunSide, sunVector);
    expect(shadow.isEclipse).toBe(false);
    expect(shadow.sunFraction).toBe(1.0);
    expect(shadow.shadowType).toBe('sun');
  });

  it('detects total umbra eclipse when directly behind Earth', () => {
    const sunVector = [1.0, 0.0, 0.0]; // Sun along +X
    // Satellite directly behind Earth on -X axis, close to shadow axis
    const rSatDarkSide = [-7000000.0, 1000.0, 0.0]; // Altitude ~620 km, rPerp ~1 km << R_EARTH

    const shadow = computeShadow(rSatDarkSide, sunVector);
    expect(shadow.isEclipse).toBe(true);
    expect(shadow.sunFraction).toBe(0.0);
    expect(shadow.shadowType).toBe('umbra');
  });

  it('detects full sun when behind Earth but outside the shadow cylinder', () => {
    const sunVector = [1.0, 0.0, 0.0];
    // Satellite behind Earth along -X, but high perpendicular distance (e.g. over polar region outside shadow cylinder)
    const rSatOutside = [-7000000.0, 2.0 * R_EARTH_EQUATORIAL, 0.0];

    const shadow = computeShadow(rSatOutside, sunVector);
    expect(shadow.isEclipse).toBe(false);
    expect(shadow.sunFraction).toBe(1.0);
    expect(shadow.shadowType).toBe('sun');
  });

  it('calculates expected solar flux in sun and eclipse', () => {
    const epoch = 1730000000;
    const sunVec = computeSunVectorECI(epoch);

    // Sunlit position
    const rSun = [sunVec[0] * 7000000, sunVec[1] * 7000000, sunVec[2] * 7000000];
    const fluxSun = computeSolarFlux(rSun, epoch);
    expect(fluxSun.solarFluxWPerM2).toBeCloseTo(SOLAR_CONSTANT, 1);
    expect(fluxSun.isEclipse).toBe(false);

    // Eclipsed position
    const rEclipse = [-sunVec[0] * 7000000, -sunVec[1] * 7000000, -sunVec[2] * 7000000];
    const fluxEclipse = computeSolarFlux(rEclipse, epoch);
    expect(fluxEclipse.solarFluxWPerM2).toBe(0.0);
    expect(fluxEclipse.isEclipse).toBe(true);
  });
});
