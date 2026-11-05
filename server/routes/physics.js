/**
 * Express REST API Routes for Orbital Physics & Astrodynamics Engine
 * Endpoints:
 * - POST /api/physics/propagate
 * - POST /api/physics/maneuver
 * - POST /api/physics/link-budget
 * - POST /api/physics/drag-decay
 */

import { Router } from 'express';
import { propagateOrbit } from '../physics/kepler.js';
import { planManeuver } from '../physics/maneuvers.js';
import { computePassesAndDownlink } from '../physics/groundStation.js';
import { computeDragDecay } from '../physics/atmosphere.js';

const router = Router();

/**
 * POST /api/physics/propagate
 * Propagates orbital state vectors, geodetic coordinates, and eclipse data.
 */
router.post('/propagate', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.elements) {
      return res.status(400).json({ error: 'Missing orbital elements in request body' });
    }

    const result = propagateOrbit(payload);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/physics/maneuver
 * Plans Hohmann transfers, inclination changes, combined burns, or de-orbit burns.
 */
router.post('/maneuver', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.currentOrbit) {
      return res.status(400).json({ error: 'Missing currentOrbit in request body' });
    }

    const result = planManeuver(payload);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/physics/link-budget
 * Evaluates line-of-sight pass windows and downlink data capacity over ground stations.
 */
router.post('/link-budget', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.orbit) {
      return res.status(400).json({ error: 'Missing orbit elements in request body' });
    }

    const result = computePassesAndDownlink(payload);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/physics/drag-decay
 * Calculates atmospheric drag decay rate, daily altitude loss, and estimated orbital lifetime.
 */
router.post('/drag-decay', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || (!payload.semiMajorAxisM && !payload.altitudeKm)) {
      return res.status(400).json({ error: 'Must provide semiMajorAxisM or altitudeKm' });
    }

    const semiMajorAxisM = payload.semiMajorAxisM || (6378137.0 + payload.altitudeKm * 1000.0);
    const massKg = payload.massKg || payload.wetMassKg || 10.0;
    const dragAreaM2 = payload.dragAreaM2 || 0.05;
    const eccentricity = payload.eccentricity || payload.e || 0.0;
    const cd = payload.cd || 2.2;

    const result = computeDragDecay({
      semiMajorAxisM,
      eccentricity,
      massKg,
      dragAreaM2,
      cd
    });

    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
