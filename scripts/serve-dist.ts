/**
 * Servidor estático mínimo para testar o build de produção (PWA / offline).
 * O service worker do Angular só é ativado no build de produção e exige
 * localhost ou HTTPS.
 *
 *   npm run build && npm run serve:prod    →  http://localhost:8080
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'gerador-de-tablita', 'browser');
const PORT = Number(process.env['PORT'] ?? 8080);

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error('Build não encontrado. Rode "npm run build" primeiro.');
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const target = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!target.startsWith(ROOT + sep) && target !== ROOT) {
    res.writeHead(403).end();
    return;
  }
  const file = existsSync(target) && statSync(target).isFile() ? target : join(ROOT, 'index.html');
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Servindo ${ROOT} em http://localhost:${PORT}`));
