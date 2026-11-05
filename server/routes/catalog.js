/**
 * Express REST API Routes for Satellite Components & Chassis Catalog
 * Endpoints:
 * - GET /api/catalog/components
 * - GET /api/catalog/chassis
 */

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COMPONENTS_FILE = path.resolve(__dirname, '../data/components.json');

let cachedData = null;

function getCatalogData() {
  if (!cachedData) {
    const raw = fs.readFileSync(COMPONENTS_FILE, 'utf8');
    cachedData = JSON.parse(raw);
  }
  return cachedData;
}

/**
 * GET /api/catalog/components
 * Returns all components with optional query filtering by category, tier, or chassisCompatibility.
 */
router.get('/components', (req, res) => {
  try {
    const data = getCatalogData();
    let components = data.components || [];

    const { category, tier, chassis } = req.query;

    if (category) {
      components = components.filter(c => c.category === category);
    }
    if (tier) {
      const tierNum = parseInt(tier, 10);
      components = components.filter(c => c.tier === tierNum);
    }
    if (chassis) {
      components = components.filter(c => !c.chassisCompatibility || c.chassisCompatibility.includes(chassis));
    }

    return res.json({
      meta: data.meta,
      total: components.length,
      components
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/catalog/chassis
 * Returns available structural bus frames and modular slot specs.
 */
router.get('/chassis', (req, res) => {
  try {
    const data = getCatalogData();
    const chassis = (data.components || []).filter(c => c.category === 'bus');
    return res.json({
      total: chassis.length,
      chassis
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
