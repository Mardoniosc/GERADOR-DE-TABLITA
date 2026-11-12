/**
 * Servidor estático que imita o GitHub Pages, para testar o build de
 * produção localmente (PWA, offline, subdiretório).
 *
 *   npm run build:pages && npm run serve:prod   →  http://localhost:8080/<repo>/
 *   npm run build       && npm run serve:prod   →  http://localhost:8080/
 *
 * - Publica a pasta de saída no caminho do <base href> do index.html gerado.
 * - Caminho inexistente → 404.html com status 404 (como o GitHub Pages).
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

import { browserOutputDir } from './project-paths.ts';

const ROOT = browserOutputDir();
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
  console.error('Build não encontrado. Rode "npm run build" ou "npm run build:pages" primeiro.');
  process.exit(1);
}
const BASE = /<base href="([^"]*)"/.exec(readFileSync(join(ROOT, 'index.html'), 'utf8'))?.[1] ?? '/';

function send(res: import('node:http').ServerResponse, status: number, path: string): void {
  res.writeHead(status, {
    'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
    'Cache-Control': 'max-age=600',
  });
  createReadStream(path).pipe(res);
}

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  if (BASE !== '/' && pathname === BASE.slice(0, -1)) {
    res.writeHead(301, { Location: BASE }).end();
    return;
  }
  const notFound = existsSync(join(ROOT, '404.html')) ? join(ROOT, '404.html') : null;
  if (!pathname.startsWith(BASE)) {
    if (notFound) send(res, 404, notFound);
    else res.writeHead(404).end('Not found');
    return;
  }
  let target = normalize(join(ROOT, pathname.slice(BASE.length)));
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
  if (existsSync(target) && statSync(target).isFile() && (target + sep).startsWith(ROOT)) {
    send(res, 200, target);
  } else if (notFound) {
    send(res, 404, notFound);
  } else {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Servindo ${ROOT} em http://localhost:${PORT}${BASE}`));
