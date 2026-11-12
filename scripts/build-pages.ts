/**
 * Build de produção para o GitHub Pages (site em subdiretório).
 *
 *   npm run build:pages
 *
 * O base-href é resolvido automaticamente (ver resolveBaseHref em
 * project-paths.ts). Depois do build, copia index.html para 404.html: o
 * GitHub Pages entrega o 404.html para qualquer caminho inexistente, e assim
 * o próprio app (com <base href> absoluto) assume a navegação.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { ROOT, browserOutputDir, resolveBaseHref } from './project-paths.ts';

const { baseHref, source } = resolveBaseHref();
console.log(`base-href: ${baseHref} (origem: ${source})`);

const ngCli = join(ROOT, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
if (!existsSync(ngCli)) {
  console.error('Angular CLI não encontrado. Rode "npm ci" (ou "npm install") antes.');
  process.exit(1);
}

const build = spawnSync(process.execPath, [ngCli, 'build', '--configuration', 'production', '--base-href', baseHref], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const out = browserOutputDir();
copyFileSync(join(out, 'index.html'), join(out, '404.html'));
console.log(`Build pronto em ${out} (404.html criado como fallback de navegação).`);

// No GitHub Actions, expõe a pasta real de saída para o passo de upload.
const githubOutput = process.env['GITHUB_OUTPUT'];
if (githubOutput) {
  appendFileSync(githubOutput, `dist=${relative(ROOT, out).split(sep).join('/')}\nbase_href=${baseHref}\n`);
}
