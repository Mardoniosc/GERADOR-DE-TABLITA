/**
 * Valida o build antes da publicação. Sai com código 1 se algo estiver errado,
 * o que interrompe o pipeline.
 *
 *   npm run verify:dist
 *
 * Verifica: index.html, base-href, JS/CSS referenciados, JSON das Tablitas,
 * manifest e ícones, service worker (ngsw.json/ngsw-worker.js) e 404.html.
 */
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { browserOutputDir, resolveBaseHref } from './project-paths.ts';

const out = browserOutputDir();
const { baseHref: expectedBase, source } = resolveBaseHref();
const checks: { ok: boolean; label: string; detail?: string }[] = [];

function check(ok: boolean, label: string, detail?: string): boolean {
  checks.push({ ok, label, detail });
  return ok;
}

function file(rel: string): string {
  return join(out, ...rel.split('/'));
}

function exists(rel: string): boolean {
  const p = file(rel);
  return existsSync(p) && statSync(p).isFile() && statSync(p).size > 0;
}

function readJson(rel: string): unknown {
  try {
    return JSON.parse(readFileSync(file(rel), 'utf8'));
  } catch {
    return undefined;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// --- index.html e base-href ---------------------------------------------------
check(existsSync(out), 'Pasta de saída existe', out);
const indexOk = check(exists('index.html'), 'index.html existe');
const index = indexOk ? readFileSync(file('index.html'), 'utf8') : '';
const baseMatch = /<base href="([^"]*)"/.exec(index);
check(baseMatch?.[1] === expectedBase, `base-href = ${expectedBase} (${source})`, `encontrado: ${baseMatch?.[1] ?? 'nenhum'}`);

const refs = [...index.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((r) => !/^(https?:|data:|#)/.test(r));
const absolute = refs.filter((r) => r.startsWith('/') && r !== expectedBase);
check(absolute.length === 0, 'index.html sem caminhos absolutos (respeitam o base-href)', absolute.join(', '));
const scripts = refs.filter((r) => r.endsWith('.js'));
const styles = refs.filter((r) => r.endsWith('.css'));
check(scripts.length > 0 && scripts.every((r) => exists(r)), 'JavaScript referenciado existe', scripts.join(', '));
check(styles.length > 0 && styles.every((r) => exists(r)), 'CSS referenciado existe', styles.join(', '));
for (const r of refs.filter((x) => x !== expectedBase && !x.endsWith('.js') && !x.endsWith('.css'))) {
  check(exists(r), `Recurso do index.html existe: ${r}`);
}
check(index.includes('<app-root'), 'index.html contém <app-root>');

// --- 404.html (fallback de navegação no GitHub Pages) -------------------------
check(exists('404.html') && readFileSync(file('404.html'), 'utf8') === index, '404.html idêntico ao index.html');

// --- JSON das Tablitas ---------------------------------------------------------
const tablitas = readJson('assets/data/tablitas.json');
const metadata = readJson('assets/data/metadata.json');
const records = Array.isArray(tablitas) ? tablitas.length : -1;
check(records > 0, 'assets/data/tablitas.json existe e é uma lista', `${records} registros`);
let declared = -1;
if (isObject(metadata) && Array.isArray(metadata['editions'])) {
  declared = metadata['editions'].reduce<number>(
    (sum, e) => sum + (isObject(e) && typeof e['records'] === 'number' ? e['records'] : 0),
    0,
  );
}
check(declared === records, 'assets/data/metadata.json confere com tablitas.json', `metadata: ${declared}, tablitas: ${records}`);

// --- Manifest e ícones -----------------------------------------------------------
const manifest = readJson('manifest.webmanifest');
if (check(isObject(manifest), 'manifest.webmanifest existe e é JSON válido') && isObject(manifest)) {
  for (const key of ['start_url', 'scope'] as const) {
    const v = manifest[key];
    check(typeof v === 'string' && !v.startsWith('/'), `manifest.${key} é relativo`, String(v));
  }
  const icons = Array.isArray(manifest['icons']) ? manifest['icons'] : [];
  const srcs = icons.map((i) => (isObject(i) && typeof i['src'] === 'string' ? i['src'] : ''));
  check(srcs.length > 0 && srcs.every((s) => s !== '' && !s.startsWith('/') && exists(s)), 'Ícones do manifest existem (caminhos relativos)', srcs.join(', '));
  check(
    icons.some((i) => isObject(i) && i['sizes'] === '512x512') && icons.some((i) => isObject(i) && i['sizes'] === '192x192'),
    'Manifest tem ícones 192 e 512 (instalação)',
  );
}

// --- Service worker -------------------------------------------------------------
check(exists('ngsw-worker.js'), 'ngsw-worker.js existe');
const ngsw = readJson('ngsw.json');
if (check(isObject(ngsw), 'ngsw.json existe e é JSON válido') && isObject(ngsw)) {
  check(ngsw['index'] === `${expectedBase}index.html`, 'ngsw.json: index dentro do base-href', String(ngsw['index']));
  const groups = Array.isArray(ngsw['assetGroups']) ? ngsw['assetGroups'].filter(isObject) : [];
  const urls = groups.flatMap((g) => (Array.isArray(g['urls']) ? g['urls'].filter((u): u is string => typeof u === 'string') : []));
  check(urls.length > 0 && urls.every((u) => u.startsWith(expectedBase)), 'ngsw.json: URLs em cache dentro do base-href');
  check(urls.every((u) => exists(u.slice(expectedBase.length))), 'ngsw.json: todos os arquivos em cache existem');
  for (const needed of ['index.html', 'assets/data/tablitas.json', 'assets/data/metadata.json', 'manifest.webmanifest']) {
    check(urls.includes(`${expectedBase}${needed}`), `Service worker guarda em cache: ${needed}`);
  }
  check(isObject(ngsw['hashTable']) && Object.keys(ngsw['hashTable']).length > 0, 'ngsw.json: tabela de hashes presente (detecção de novas versões)');
}

// --- Resultado ------------------------------------------------------------------
const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? '✔' : '✘'} ${c.label}${!c.ok && c.detail ? ` — ${c.detail}` : ''}`);
}
console.log(`\n${checks.length - failed.length}/${checks.length} verificações OK em ${out}`);

const summary = process.env['GITHUB_STEP_SUMMARY'];
if (summary) {
  appendFileSync(
    summary,
    [
      '### Verificação do build',
      '',
      `base-href: \`${expectedBase}\` (${source})`,
      '',
      ...checks.map((c) => `- ${c.ok ? '✅' : '❌'} ${c.label}${!c.ok && c.detail ? ` — ${c.detail}` : ''}`),
      '',
    ].join('\n'),
  );
}

if (failed.length > 0) {
  console.error(`\n${failed.length} verificação(ões) falharam. Publicação interrompida.`);
  process.exit(1);
}
