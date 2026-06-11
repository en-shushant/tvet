#!/usr/bin/env node
// TVETtrack local server — serves the static frontend AND proxies /api/* to Railway.
// Used by the macOS .app launcher (scripts/app-it.config.json).
//
// Usage: PORT=3000 node scripts/serve-local.js
//   - Serves the project root on PORT (defaults to 3000)
//   - Proxies /api/* → https://tvettrack-api-production.up.railway.app/api/*
//
// To point at a different backend, set BACKEND_URL:
//   BACKEND_URL=https://my-api.example.com PORT=3000 node scripts/serve-local.js

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'https://tvettrack-api-production.up.railway.app';
const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let filePath = path.join(ROOT, pathname === '/' ? '/index.html' : pathname);
  // SPA fallback: if file doesn't exist and pathname doesn't have an extension, serve index.html
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    if (!path.extname(pathname)) {
      filePath = path.join(ROOT, 'index.html');
    } else {
      return send(res, 404, 'Not found\n', { 'Content-Type': 'text/plain' });
    }
  }
  const ext = path.extname(filePath).toLowerCase();
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => send(res, 500, 'Internal error\n', { 'Content-Type': 'text/plain' }));
  stream.on('open', () => {
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    stream.pipe(res);
  });
}

function proxyApi(req, res) {
  const target = new URL(BACKEND_URL + req.url);
  const opts = {
    method: req.method,
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: target.pathname + target.search,
    headers: { ...req.headers, host: target.host },
  };
  const transport = target.protocol === 'https:' ? https : http;
  const upstream = transport.request(opts, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on('error', err => {
    console.error('Proxy error:', err.message);
    send(res, 502, JSON.stringify({ error: 'Backend unreachable: ' + err.message }), { 'Content-Type': 'application/json' });
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (pathname.startsWith('/api/')) {
    return proxyApi(req, res);
  }
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`TVETtrack local server`);
  console.log(`  Frontend: http://localhost:${PORT}/`);
  console.log(`  Backend:  ${BACKEND_URL}`);
  console.log(`  /api/* → proxied to backend`);
});
