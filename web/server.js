import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const app = express();

// /api and /covers go to the API container; everything else is the SPA.
app.use(
  createProxyMiddleware({
    target: process.env.API_URL || 'http://api:4000',
    pathFilter: ['/api', '/covers'],
    xfwd: true,
  })
);
app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(dist, { maxAge: 0 }));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = process.env.PORT || 8090;
app.listen(port, () => console.log(`[web] listening on :${port}`));
