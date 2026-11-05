import { describe, it, expect } from 'vitest';
import {
  getAtmosphericDensity,
  computeDragDecay
} from '../../server/physics/atmosphere.js';
import { R_EARTH_EQUATORIAL } from '../../server/physics/constants.js';

describe('Atmospheric Density & Drag Decay Models', () => {
  it('computes realistic atmospheric density decreasing with altitude', () => {
    const rho200 = getAtmosphericDensity(200000);
    const rho400 = getAtmosphericDensity(400000);
    const rho600 = getAtmosphericDensity(600000);

    expect(rho200).toBeGreaterThan(rho400);
    expect(rho400).toBeGreaterThan(rho600);

    // Standard density at 400 km is ~10^-12 to 10^-11 kg/m^3
    expect(rho400).toBeGreaterThan(1e-12);
    expect(rho400).toBeLessThan(1e-11);
  });

  it('calculates secular drag decay rates for a typical CubeSat at 350 km', () => {
    const semiMajorAxisM = R_EARTH_EQUATORIAL + 350000.0;
    const decay = computeDragDecay({
      semiMajorAxisM,
      massKg: 4.0, // 3U CubeSat
      dragAreaM2: 0.03,
      cd: 2.2
    });

    expect(decay.daDtMPerSec).toBeLessThan(0); // decaying
    expect(decay.altitudeLossMPerDay).toBeGreaterThan(1.0); // noticeably decaying per day at 350 km
    expect(decay.isTerminalReentry).toBe(false);
    expect(decay.estimatedLifetimeDays).toBeGreaterThan(10);
  });

  it('flags terminal reentry when perigee drops below 120 km', () => {
    const semiMajorAxisM = R_EARTH_EQUATORIAL + 110000.0;
    const decay = computeDragDecay({
      semiMajorAxisM,
      massKg: 4.0,
      dragAreaM2: 0.03
    });

    expect(decay.isTerminalReentry).toBe(true);
  });
});

