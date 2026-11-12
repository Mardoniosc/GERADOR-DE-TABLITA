import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { normalizeNotation } from '../engine/draughts-engine';
import type {
  CodexTabua,
  EditionMetadata,
  InterpretationResult,
  TablitaCategory,
  TablitaMetadata,
  TablitaRecord,
} from '../models/tablita.model';
import { TablitaNotationService } from './tablita-notation.service';

export const TABLITAS_URL = 'assets/data/tablitas.json';
export const METADATA_URL = 'assets/data/metadata.json';
const EDITION_STORAGE_KEY = 'gerador-tablita.edition';

/** Returns a uniformly distributed integer in [0, maxExclusive). Injectable for tests. */
export type RandomIndex = (maxExclusive: number) => number;

export const RANDOM_INDEX = new InjectionToken<RandomIndex>('RANDOM_INDEX', {
  providedIn: 'root',
  factory: () => cryptoRandomIndex,
});

/** Unbiased random index via `crypto.getRandomValues` and rejection sampling. */
export function cryptoRandomIndex(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError('maxExclusive deve ser um inteiro positivo.');
  }
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % maxExclusive;
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DrawnTablita {
  readonly record: TablitaRecord;
  readonly result: Extract<InterpretationResult, { ok: true }>;
  /** Monotonic counter, so the UI can react to repeated draws of the same record. */
  readonly drawNumber: number;
}

export interface ValidationReport {
  readonly total: number;
  readonly eligible: number;
  readonly excluded: readonly { readonly id: string; readonly reason: string }[];
}

// ---------------------------------------------------------------------------
// Runtime validation of the JSON files (no `any`, no blind casts).
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is TablitaCategory {
  return value === 'MOVES' || value === 'POSITIONS';
}

function isTabua(value: unknown): value is CodexTabua {
  return value === 'A' || value === 'B' || value === 'C';
}

export function isTablitaRecord(value: unknown): value is TablitaRecord {
  if (!isObject(value)) return false;
  return (
    typeof value['id'] === 'string' &&
    typeof value['code'] === 'string' &&
    typeof value['edition'] === 'string' &&
    typeof value['index'] === 'number' &&
    typeof value['column'] === 'string' &&
    typeof value['row'] === 'number' &&
    (value['category'] === null || isCategory(value['category'])) &&
    typeof value['categoryName'] === 'string' &&
    (value['codexTabua'] === null || isTabua(value['codexTabua'])) &&
    typeof value['notation'] === 'string' &&
    typeof value['notationNormalized'] === 'string' &&
    typeof value['source'] === 'string' &&
    typeof value['verified'] === 'boolean' &&
    (value['status'] === 'VALID' || value['status'] === 'PENDING' || value['status'] === 'INVALID') &&
    Array.isArray(value['issues']) &&
    value['issues'].every((i) => typeof i === 'string')
  );
}

export function isTablitaMetadata(value: unknown): value is TablitaMetadata {
  if (!isObject(value)) return false;
  const mapping = value['codexMapping'];
  return (
    typeof value['defaultEdition'] === 'string' &&
    typeof value['consultedAt'] === 'string' &&
    Array.isArray(value['editions']) &&
    value['editions'].every((e) => isObject(e) && typeof e['id'] === 'string' && typeof e['records'] === 'number') &&
    isObject(value['categories']) &&
    isObject(mapping) &&
    isObject(mapping['byCategory']) &&
    isObject(mapping['tabuaNames']) &&
    Array.isArray(value['withdrawnSlots'])
  );
}

/**
 * Loads the local Tablita collection, validates it and draws records.
 *
 * Only records that are marked VALID by the importer *and* re-validated here
 * by the notation engine are eligible, so a draw never leaves the official
 * collection and never shows an unverified entry.
 */
@Injectable({ providedIn: 'root' })
export class TablitaService {
  private readonly http = inject(HttpClient);
  private readonly notation = inject(TablitaNotationService);
  private readonly randomIndex = inject(RANDOM_INDEX);

  private readonly _status = signal<LoadStatus>('idle');
  private readonly _error = signal<string | null>(null);
  private readonly _records = signal<readonly TablitaRecord[]>([]);
  private readonly _metadata = signal<TablitaMetadata | null>(null);
  private readonly _eligibleIds = signal<ReadonlySet<string>>(new Set());
  private readonly _edition = signal<string | null>(null);
  private readonly _current = signal<DrawnTablita | null>(null);
  private readonly _validation = signal<ValidationReport | null>(null);
  private drawCounter = 0;
  private loading: Promise<void> | null = null;

  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly records = this._records.asReadonly();
  readonly metadata = this._metadata.asReadonly();
  readonly current = this._current.asReadonly();
  readonly validation = this._validation.asReadonly();

  readonly editions = computed<readonly EditionMetadata[]>(() => this._metadata()?.editions ?? []);

  readonly edition = computed<EditionMetadata | null>(() => {
    const id = this._edition();
    return this.editions().find((e) => e.id === id) ?? null;
  });

  /** Records of the selected edition. */
  readonly editionRecords = computed(() => {
    const id = this._edition();
    return this._records().filter((r) => r.edition === id);
  });

  /** Records of the selected edition that may be drawn. */
  readonly eligible = computed(() => {
    const ids = this._eligibleIds();
    return this.editionRecords().filter((r) => ids.has(r.id));
  });

  readonly countsByCategory = computed<Readonly<Record<TablitaCategory, number>>>(() => {
    const counts: Record<TablitaCategory, number> = { MOVES: 0, POSITIONS: 0 };
    for (const r of this.eligible()) {
      if (r.category) counts[r.category]++;
    }
    return counts;
  });

  /** Loads and validates the local JSON files once. Safe to call repeatedly. */
  load(): Promise<void> {
    this.loading ??= this.doLoad();
    return this.loading;
  }

  private async doLoad(): Promise<void> {
    this._status.set('loading');
    this._error.set(null);
    try {
      const [rawRecords, rawMetadata] = await Promise.all([
        firstValueFrom(this.http.get<unknown>(TABLITAS_URL)),
        firstValueFrom(this.http.get<unknown>(METADATA_URL)),
      ]);
      if (!isTablitaMetadata(rawMetadata)) {
        throw new Error('metadata.json está em formato inválido.');
      }
      if (!Array.isArray(rawRecords)) {
        throw new Error('tablitas.json deve conter uma lista de registros.');
      }
      const records = rawRecords.filter(isTablitaRecord);
      if (records.length !== rawRecords.length) {
        throw new Error(`tablitas.json contém ${rawRecords.length - records.length} registro(s) malformado(s).`);
      }
      const report = this.validate(records, rawMetadata);
      this._records.set(records);
      this._metadata.set(rawMetadata);
      this._eligibleIds.set(new Set(records.map((r) => r.id).filter((id) => !report.excluded.some((e) => e.id === id))));
      this._validation.set(report);
      this._edition.set(this.initialEdition(rawMetadata));
      this._status.set('ready');
    } catch (err: unknown) {
      this.loading = null;
      this._status.set('error');
      this._error.set(err instanceof Error ? err.message : 'Falha ao carregar as Tablitas.');
    }
  }

  /**
   * Integrity checks. Fatal problems (duplicate ids, counts that disagree with
   * metadata) throw; individual unusable records are only excluded.
   */
  validate(records: readonly TablitaRecord[], metadata: TablitaMetadata): ValidationReport {
    const ids = new Set<string>();
    for (const r of records) {
      if (ids.has(r.id)) {
        throw new Error(`Identificador duplicado: ${r.id}.`);
      }
      ids.add(r.id);
    }
    for (const edition of metadata.editions) {
      const count = records.filter((r) => r.edition === edition.id).length;
      if (count !== edition.records) {
        throw new Error(`Edição ${edition.id}: metadata indica ${edition.records} registros, mas há ${count}.`);
      }
    }
    const excluded: { id: string; reason: string }[] = [];
    for (const r of records) {
      if (r.status !== 'VALID' || !r.verified) {
        excluded.push({ id: r.id, reason: `Registro ${r.status.toLowerCase()}: ${r.issues.join(' ')}` });
        continue;
      }
      if (normalizeNotation(r.notation) !== r.notationNormalized) {
        excluded.push({ id: r.id, reason: 'Notação normalizada não corresponde à original.' });
        continue;
      }
      const result = this.notation.interpretRecord(r);
      if (!result.ok) {
        excluded.push({ id: r.id, reason: result.errors.join(' ') });
      } else if (result.category !== r.category) {
        excluded.push({ id: r.id, reason: 'Categoria divergente da notação.' });
      }
    }
    return { total: records.length, eligible: records.length - excluded.length, excluded };
  }

  private initialEdition(metadata: TablitaMetadata): string {
    try {
      const saved = localStorage.getItem(EDITION_STORAGE_KEY);
      if (saved && metadata.editions.some((e) => e.id === saved)) {
        return saved;
      }
    } catch {
      // Storage unavailable (private mode, blocked): fall back to the default.
    }
    return metadata.defaultEdition;
  }

  selectEdition(id: string): void {
    if (!this.editions().some((e) => e.id === id) || id === this._edition()) {
      return;
    }
    this._edition.set(id);
    this._current.set(null);
    try {
      localStorage.setItem(EDITION_STORAGE_KEY, id);
    } catch {
      // Preference is a convenience only.
    }
  }

  /** Draws one eligible record uniformly at random and interprets it. */
  generate(): DrawnTablita | null {
    const pool = this.eligible();
    if (pool.length === 0) {
      return null;
    }
    const record = pool[this.randomIndex(pool.length)];
    const result = this.notation.interpretRecord(record);
    if (!result.ok) {
      // Cannot happen for eligible records; guard anyway.
      this._error.set(`Falha ao interpretar ${record.code}: ${result.errors.join(' ')}`);
      return null;
    }
    const drawn: DrawnTablita = { record, result, drawNumber: ++this.drawCounter };
    this._current.set(drawn);
    return drawn;
  }

  /** Display name of the CODEX table for a record, or null while unconfirmed. */
  codexTabuaName(record: TablitaRecord): string | null {
    const meta = this._metadata();
    if (!meta) return null;
    const tabua =
      record.codexTabua ??
      (meta.codexMapping.status === 'CONFIRMED' && record.category
        ? meta.codexMapping.byCategory[record.category]
        : null);
    return tabua ? meta.codexMapping.tabuaNames[tabua] : null;
  }
}
