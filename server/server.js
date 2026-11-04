import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(root, '../client')));
app.get('/api/catalog/components', (_req, res) => res.sendFile(path.join(root, 'data/components.json')));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Mission: LEO available at http://localhost:${port}`));
