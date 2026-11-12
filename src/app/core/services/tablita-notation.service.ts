import { Injectable } from '@angular/core';

import { classifyNotation, interpretTablita, normalizeNotation } from '../engine/draughts-engine';
import type { InterpretationResult, TablitaCategory, TablitaRecord } from '../models/tablita.model';

/**
 * Interprets Tablita notation and builds the resulting board.
 *
 * The parsing and move rules live in the framework-free engine, which the
 * import script also uses; this service only exposes them to the app and
 * caches results (each notation is pure, so its result never changes).
 */
@Injectable({ providedIn: 'root' })
export class TablitaNotationService {
  private readonly cache = new Map<string, InterpretationResult>();

  /** Structural kind of a notation, or null when it matches no known format. */
  classify(notation: string): TablitaCategory | null {
    return classifyNotation(notation);
  }

  /** Parses, applies and validates a notation from the initial position. */
  interpret(notation: string): InterpretationResult {
    const key = normalizeNotation(notation);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const result = interpretTablita(key);
    this.cache.set(key, result);
    return result;
  }

  interpretRecord(record: TablitaRecord): InterpretationResult {
    return this.interpret(record.notationNormalized);
  }

  /** True when the notation is executable and leaves the side to move a legal move. */
  isExecutable(notation: string): boolean {
    return this.interpret(notation).ok;
  }
}
