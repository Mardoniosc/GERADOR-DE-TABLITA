/**
 * Caminhos e base-href do projeto, lidos da configuração real
 * (angular.json, package.json, variáveis de ambiente, git), sem nomes fixos.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface AngularJson {
  projects: Record<string, { architect?: { build?: { options?: { outputPath?: unknown } } } }>;
}

/** Nome do projeto Angular (o único em angular.json). */
export function angularProjectName(): string {
  const angular = JSON.parse(readFileSync(join(ROOT, 'angular.json'), 'utf8')) as AngularJson;
  const names = Object.keys(angular.projects);
  if (names.length !== 1) {
    throw new Error(`angular.json deve ter exatamente um projeto (encontrados: ${names.join(', ') || 'nenhum'}).`);
  }
  return names[0];
}

/**
 * Pasta publicada pelo builder `@angular/build:application`:
 * `<outputPath>/browser`, onde outputPath padrão é `dist/<projeto>`.
 */
export function browserOutputDir(): string {
  const angular = JSON.parse(readFileSync(join(ROOT, 'angular.json'), 'utf8')) as AngularJson;
  const name = angularProjectName();
  const configured = angular.projects[name].architect?.build?.options?.outputPath;
  let base = `dist/${name}`;
  let browser = 'browser';
  if (typeof configured === 'string') {
    base = configured;
  } else if (configured && typeof configured === 'object') {
    const o = configured as { base?: unknown; browser?: unknown };
    if (typeof o.base === 'string') base = o.base;
    if (typeof o.browser === 'string') browser = o.browser;
  }
  return join(ROOT, base, browser);
}

/** Normaliza para o formato exigido pelo Angular: "/" ou "/nome/". */
export function normalizeBaseHref(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? '/' : `/${trimmed}/`;
}

function repoNameFromRemote(): string | null {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const match = /[/:]([^/]+?)(?:\.git)?$/.exec(url);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Repositórios "<usuário>.github.io" são publicados na raiz do domínio. */
function baseFromRepoName(repo: string): string {
  return /\.github\.io$/i.test(repo) ? '/' : normalizeBaseHref(repo);
}

export interface BaseHrefResolution {
  readonly baseHref: string;
  readonly source: string;
}

/**
 * Ordem de prioridade:
 *  1. Variável BASE_HREF (no CI vem de actions/configure-pages, que já
 *     considera domínio próprio e repositórios <usuário>.github.io).
 *  2. package.json → config.pagesBaseHref, se preenchido (ajuste manual).
 *  3. GITHUB_REPOSITORY (owner/repo) quando roda no GitHub Actions.
 *  4. Nome do repositório do remote "origin" do git.
 *  5. "/".
 */
export function resolveBaseHref(): BaseHrefResolution {
  const env = process.env['BASE_HREF'];
  if (env !== undefined && env !== '') {
    return { baseHref: normalizeBaseHref(env), source: 'variável BASE_HREF' };
  }
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { config?: { pagesBaseHref?: unknown } };
  const configured = pkg.config?.pagesBaseHref;
  if (typeof configured === 'string' && configured.trim() !== '') {
    return { baseHref: normalizeBaseHref(configured), source: 'package.json (config.pagesBaseHref)' };
  }
  const repository = process.env['GITHUB_REPOSITORY'];
  if (repository?.includes('/')) {
    return { baseHref: baseFromRepoName(repository.split('/')[1]), source: 'GITHUB_REPOSITORY' };
  }
  const remote = repoNameFromRemote();
  if (remote) {
    return { baseHref: baseFromRepoName(remote), source: 'git remote origin' };
  }
  return { baseHref: '/', source: 'padrão' };
}
