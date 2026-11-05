import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../../server/server.js';

let server;
let baseUrl;

beforeAll(async () => {
  await new Promise((resolve) => {
    // Listen on ephemeral port 0
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise((resolve) => {
    server.close(resolve);
  });
});

describe('Express REST API Endpoints', () => {
  it('GET /api/health returns operational status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.game).toBe('Orbiterra LEO Simulation Engine');
  });

  it('GET /api/catalog/components returns components from components.json', async () => {
    const res = await fetch(`${baseUrl}/api/catalog/components`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBeGreaterThan(0);
    expect(Array.isArray(json.components)).toBe(true);

    const first = json.components[0];
    expect(first.id).toBeDefined();
    expect(first.category).toBeDefined();
    expect(first.costUSD).toBeDefined();
  });

  it('GET /api/catalog/chassis returns chassis options', async () => {
    const res = await fetch(`${baseUrl}/api/catalog/chassis`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBeGreaterThan(0);
    expect(json.chassis.every(c => c.category === 'bus')).toBe(true);
  });

  it('POST /api/physics/propagate generates 3D trajectory points and eclipse data', async () => {
    const payload = {
      elements: {
        altitudeKm: 500,
        inclinationDeg: 97.4,
        eccentricity: 0.001
      },
      duration: 300,
      step: 60
    };

    const res = await fetch(`${baseUrl}/api/physics/propagate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.points.length).toBe(6);
    expect(json.periodSec).toBeGreaterThan(5000);
    expect(json.points[0].rECI).toBeDefined();
    expect(json.points[0].geodetic).toBeDefined();
  });

  it('POST /api/physics/maneuver computes Hohmann transfer and propellant', async () => {
    const payload = {
      maneuverType: 'hohmann',
      currentOrbit: { altitudeKm: 400 },
      targetOrbit: { altitudeKm: 700 },
      satellite: { wetMassKg: 12.0, ispSeconds: 220.0, thrustN: 1.0 }
    };

    const res = await fetch(`${baseUrl}/api/physics/maneuver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totalDeltaVMPerSec).toBeGreaterThan(100);
    expect(json.fuelUsedKg).toBeGreaterThan(0);
    expect(json.finalMassKg).toBeLessThan(12.0);
  });

  it('POST /api/physics/drag-decay computes secular decay and lifetime', async () => {
    const payload = {
      altitudeKm: 350,
      massKg: 5.0,
      dragAreaM2: 0.04
    };

    const res = await fetch(`${baseUrl}/api/physics/drag-decay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.altitudeLossMPerDay).toBeGreaterThan(0);
    expect(json.isTerminalReentry).toBe(false);
  });

  it('POST /api/physics/link-budget computes ground station passes', async () => {
    const payload = {
      orbit: {
        altitudeKm: 550,
        inclinationDeg: 97.5,
        epoch: 1730000000
      },
      duration: 86400,
      step: 60,
      comms: { downlinkMbps: 15.0, minElevationDeg: 5.0 },
      stationIds: ['gs_svalbard']
    };

    const res = await fetch(`${baseUrl}/api/physics/link-budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totalPasses).toBeGreaterThan(0);
    expect(json.totalDataCapacityMB).toBeGreaterThan(0);
  });
});
