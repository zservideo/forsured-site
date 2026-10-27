// Tiny static server that behaves like GitHub Pages for the test run:
// folders serve index.html, folders without a trailing slash redirect, missing files 404, and
// what Jekyll leaves out of the published site (names starting with _ or ., and the
// `exclude` list in _config.yml) 404 too.
// Started automatically by playwright.config.js; run `node tests/server.js` to browse locally.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

// The `exclude:` list from _config.yml (one "  - name" per line).
const config = fs.existsSync(path.join(ROOT, '_config.yml')) ? fs.readFileSync(path.join(ROOT, '_config.yml'), 'utf8') : '';
const EXCLUDED = (config.match(/^exclude:\s*\n((?:\s+-\s+.+\n?)+)/m) || ['', ''])[1]
  .split('\n')
  .map((l) => l.replace(/^\s+-\s+/, '').trim())
  .filter(Boolean);

function unpublished(rel) {
  const parts = rel.split(/[\\/]/).filter(Boolean);
  return parts.some((p) => p.startsWith('_') || p.startsWith('.')) || EXCLUDED.includes(parts[0]);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT) || unpublished(file.slice(ROOT.length))) {
      res.writeHead(404).end('Not found');
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { Location: url.pathname + '/' + url.search }).end();
        return;
      }
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const body = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  })
  .listen(PORT, () => console.log(`forsured-site test server on http://localhost:${PORT}`));
