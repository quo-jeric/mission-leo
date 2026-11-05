/**
 * Express Server Entry Point
 * 3D Low Earth Orbit Satellite Design & Simulation Game Engine
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import physicsRoutes from './routes/physics.js';
import catalogRoutes from './routes/catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// API Routes
app.use('/api/physics', physicsRoutes);
app.use('/api/catalog', catalogRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    game: 'Orbiterra LEO Simulation Engine',
    timestamp: new Date().toISOString()
  });
});

// Serve client static files if present
const clientPath = path.resolve(__dirname, '../client');
app.use(express.static(clientPath));

// Fallback to client index.html for SPA routing if requested
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(clientPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('<h1>Orbiterra API Server</h1><p>Client interface scaffolded. API endpoints online under <code>/api/*</code>.</p>');
    }
  });
});

// Only listen if executed directly (not when imported in tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Orbiterra Scientific Engine listening on http://localhost:${PORT}`);
  });
}

export default app;
