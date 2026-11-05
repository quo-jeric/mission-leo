import { describe, it, expect } from 'vitest';
import {
  computeHohmannTransfer,
  computePlaneChange,
  computeCombinedTransfer,
  computeDeorbitBurn,
  computePropellantUsage,
  planManeuver
} from '../../server/physics/maneuvers.js';
import {
  R_EARTH_EQUATORIAL,
  DEG_TO_RAD
} from '../../server/physics/constants.js';

describe('Orbital Maneuvers & Tsiolkovsky Engine', () => {
  it('accurately calculates textbook Hohmann transfer between 400 km and 800 km circular orbits', () => {
    const r1 = R_EARTH_EQUATORIAL + 400000.0;
    const r2 = R_EARTH_EQUATORIAL + 800000.0;

    const result = computeHohmannTransfer(r1, r2);

    // Textbook values:
    // deltaV1 ~ 109.8 m/s, deltaV2 ~ 107.5 m/s, totalDeltaV ~ 217.3 m/s
    // Transfer duration ~ 2800 - 2900 seconds (~47 minutes)
    expect(result.deltaV1).toBeGreaterThan(108.0);
    expect(result.deltaV1).toBeLessThan(112.0);
    expect(result.deltaV2).toBeGreaterThan(106.0);
    expect(result.deltaV2).toBeLessThan(109.0);
    expect(result.totalDeltaV).toBeGreaterThan(215.0);
    expect(result.totalDeltaV).toBeLessThan(220.0);

    const transferMinutes = result.transferTimeSec / 60.0;
    expect(transferMinutes).toBeGreaterThan(45.0);
    expect(transferMinutes).toBeLessThan(50.0);
  });

  it('calculates inclination plane change delta-v', () => {
    const r = R_EARTH_EQUATORIAL + 500000.0;
    // 5 degree inclination change
    const deltaI = 5.0 * DEG_TO_RAD;
    const pc = computePlaneChange(r, deltaI);

    // v ~ 7612 m/s -> deltaV = 2 * v * sin(2.5 deg) ~ 664 m/s
    expect(pc.deltaV).toBeGreaterThan(650.0);
    expect(pc.deltaV).toBeLessThan(680.0);
  });

  it('calculates de-orbit retrograde burn to 80 km perigee', () => {
    const rInitial = R_EARTH_EQUATORIAL + 500000.0; // 500 km orbit
    const deorbit = computeDeorbitBurn(rInitial, 80000.0);

    // Typical deorbit delta-v from 500 km is ~115 - 125 m/s
    expect(deorbit.deltaV).toBeGreaterThan(110.0);
    expect(deorbit.deltaV).toBeLessThan(130.0);
    expect(deorbit.targetPerigeeRadiusM).toBe(R_EARTH_EQUATORIAL + 80000.0);
  });

  it('computes fuel consumed and mass ratios via Tsiolkovsky equation', () => {
    const wetMassKg = 10.0;
    const ispSeconds = 220.0; // Hydrazine thruster
    const deltaV = 200.0; // 200 m/s burn

    const prop = computePropellantUsage({
      deltaV,
      wetMassKg,
      ispSeconds,
      thrustN: 1.0 // 1 Newton thruster
    });

    // delta_m = m_wet * (1 - exp(-dv / (isp * g0)))
    // 200 / (220 * 9.80665) = 200 / 2157.463 = 0.09270
    // 1 - exp(-0.09270) = 0.08852 -> ~0.885 kg fuel
    expect(prop.fuelUsedKg).toBeGreaterThan(0.85);
    expect(prop.fuelUsedKg).toBeLessThan(0.92);
    expect(prop.finalMassKg).toBeCloseTo(wetMassKg - prop.fuelUsedKg, 5);
    expect(prop.burnDurationSec).toBeGreaterThan(1800); // ~1900 seconds for 1N thrust
  });

  it('executes end-to-end planManeuver API request handler', () => {
    const payload = {
      maneuverType: 'hohmann',
      currentOrbit: { altitudeKm: 400 },
      targetOrbit: { altitudeKm: 600 },
      satellite: { wetMassKg: 15.0, ispSeconds: 220.0, thrustN: 2.0 }
    };

    const planned = planManeuver(payload);
    expect(planned.totalDeltaVMPerSec).toBeGreaterThan(100.0);
    expect(planned.fuelUsedKg).toBeGreaterThan(0);
    expect(planned.finalMassKg).toBeLessThan(15.0);
    expect(planned.burnDurationSeconds).toBeGreaterThan(0);
  });
});

