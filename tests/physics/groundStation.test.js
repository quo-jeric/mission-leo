import { describe, it, expect } from 'vitest';
import {
  loadGroundStations,
  computePassesAndDownlink
} from '../../server/physics/groundStation.js';

describe('Ground Station Pass & Downlink Engine', () => {
  it('loads default ground stations including polar and equatorial stations', () => {
    const stations = loadGroundStations();
    expect(stations.length).toBeGreaterThanOrEqual(5);

    const svalbard = stations.find(s => s.id === 'gs_svalbard');
    expect(svalbard).toBeDefined();
    expect(svalbard.latDeg).toBeGreaterThan(70.0);

    const kourou = stations.find(s => s.id === 'gs_kourou');
    expect(kourou).toBeDefined();
    expect(kourou.latDeg).toBeLessThan(10.0);
  });

  it('detects multiple high-latitude ground passes over Svalbard for a Polar/SSO orbit in 24 hours', () => {
    const result = computePassesAndDownlink({
      orbit: {
        altitudeKm: 600,
        inclinationDeg: 98.0,
        eccentricity: 0.001,
        epoch: 1730000000
      },
      duration: 86400, // 24 hours
      step: 30,
      comms: {
        downlinkMbps: 20.0,
        minElevationDeg: 5.0
      },
      stationIds: ['gs_svalbard']
    });

    // Polar satellites see Svalbard nearly every orbit (~14 orbits/day)
    expect(result.totalPasses).toBeGreaterThanOrEqual(10);
    expect(result.totalContactTimeSec).toBeGreaterThan(3000); // multiple thousands of seconds
    expect(result.totalDataCapacityMB).toBeGreaterThan(5000); // thousands of MB downlinked

    const pass0 = result.passes[0];
    expect(pass0.stationId).toBe('gs_svalbard');
    expect(pass0.durationSeconds).toBeGreaterThan(60);
    expect(pass0.maxElevationDeg).toBeGreaterThan(5.0);
    expect(pass0.dataDownlinkedMB).toBeCloseTo((20.0 * pass0.durationSeconds) / 8.0, 1);
  });
});
