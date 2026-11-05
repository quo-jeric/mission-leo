import { describe, it, expect } from 'vitest';
import {
  computeGMST,
  eciToEcef,
  ecefToEci,
  ecefToGeodetic,
  geodeticToEcef,
  topocentricSEZ
} from '../../server/physics/coordinates.js';
import {
  R_EARTH_EQUATORIAL,
  R_EARTH_POLAR,
  DEG_TO_RAD
} from '../../server/physics/constants.js';

describe('Coordinate Transforms & WGS-84 Geodesy', () => {
  it('computes GMST correctly and ensures periodic continuity', () => {
    const epoch1 = 1730000000;
    const gmst1 = computeGMST(epoch1);
    expect(gmst1).toBeGreaterThanOrEqual(0);
    expect(gmst1).toBeLessThan(2 * Math.PI);

    // After 1 sidereal day (~86164s), GMST rotates ~2*PI
    const epoch2 = epoch1 + 86164.0905;
    const gmst2 = computeGMST(epoch2);
    expect(Math.abs(gmst2 - gmst1)).toBeLessThan(0.01);
  });

  it('performs lossless ECI to ECEF and reverse transform', () => {
    const rEci = [7000000, 1000000, -2000000];
    const gmst = 1.234;

    const { rEcef } = eciToEcef(rEci, null, gmst);
    const rEciBack = ecefToEci(rEcef, gmst);

    expect(rEciBack[0]).toBeCloseTo(rEci[0], 5);
    expect(rEciBack[1]).toBeCloseTo(rEci[1], 5);
    expect(rEciBack[2]).toBeCloseTo(rEci[2], 5);
  });

  it('accurately converts geodetic lat/lon/alt to ECEF and back via Bowrings algorithm', () => {
    // Test known locations: Equator, North Pole, Mid-latitude (Madrid: 40.43N, 4.25W, alt 780m)
    const testCases = [
      { latDeg: 0.0, lonDeg: 0.0, altM: 500000 },
      { latDeg: 90.0, lonDeg: 0.0, altM: 400000 },
      { latDeg: -90.0, lonDeg: 45.0, altM: 600000 },
      { latDeg: 40.43, lonDeg: -4.25, altM: 780 }
    ];

    for (const tc of testCases) {
      const latRad = tc.latDeg * DEG_TO_RAD;
      const lonRad = tc.lonDeg * DEG_TO_RAD;
      const rEcef = geodeticToEcef(latRad, lonRad, tc.altM);

      const recovered = ecefToGeodetic(rEcef);

      expect(recovered.latDeg).toBeCloseTo(tc.latDeg, 4);
      expect(recovered.lonDeg).toBeCloseTo(tc.lonDeg, 4);
      expect(recovered.altM).toBeCloseTo(tc.altM, 1);
    }
  });

  it('calculates topocentric elevation and azimuth from a ground station', () => {
    // Station on equator at (0, 0, alt=0)
    const stationLatRad = 0.0;
    const stationLonRad = 0.0;
    const stationAltM = 0.0;

    // Satellite directly overhead at (0, 0, alt=500km)
    const satOverhead = geodeticToEcef(0.0, 0.0, 500000);
    const topoOverhead = topocentricSEZ(satOverhead, stationLatRad, stationLonRad, stationAltM);

    expect(topoOverhead.elevationDeg).toBeCloseTo(90.0, 2);
    expect(topoOverhead.rangeM).toBeCloseTo(500000, 1);
    expect(topoOverhead.isVisible).toBe(true);

    // Satellite below horizon (opposite side of Earth)
    const satOpposite = geodeticToEcef(0.0, Math.PI, 500000);
    const topoOpposite = topocentricSEZ(satOpposite, stationLatRad, stationLonRad, stationAltM);
    expect(topoOpposite.elevationDeg).toBeLessThan(0);
    expect(topoOpposite.isVisible).toBe(false);
  });
});

