/**
 * Tablita data model.
 *
 * Records come from the IDF "Table of draw" documents for Brazilian draughts
 * (see docs/RELATORIO-AUDITORIA.md). The IDF tables contain two structurally
 * different kinds of entry, which are kept apart here:
 *
 *  - `MOVES`: a sequence of opening moves in short algebraic notation
 *    (e.g. "ab4 ba5 ed4"), played from the initial position.
 *  - `POSITIONS`: the initial position with one White and/or one Black man
 *    relocated (e.g. "a3-a5 f6-g5"). White moves first.
 *
 * No source available to this project maps these kinds onto the CODEX
 * "Tábua A / B / C" (articles 85–86), so `codexTabua` stays `null` until
 * that mapping is confirmed in `metadata.json`.
 *
 * Like board.model.ts, this file holds types only.
 */
import type { BoardState, PieceColor, SquareRef } from './board.model';

export type TablitaCategory = 'MOVES' | 'POSITIONS';
export type CodexTabua = 'A' | 'B' | 'C';
export type RecordStatus = 'VALID' | 'PENDING' | 'INVALID';

export interface TablitaRecord {
  /** Unique, stable identifier, e.g. "BR2024-IX-05". */
  readonly id: string;
  /** Location in the source table: Roman column + row number, e.g. "IX-5". */
  readonly code: string;
  /** Edition this record belongs to (see `metadata.json`). */
  readonly edition: string;
  /** 1-based position of the record inside its edition. */
  readonly index: number;
  readonly column: string;
  readonly row: number;
  /** Structural kind of the entry, derived from its notation. */
  readonly category: TablitaCategory | null;
  readonly categoryName: string;
  /** CODEX table (art. 85); `null` while the mapping is unconfirmed. */
  readonly codexTabua: CodexTabua | null;
  /** Cell text exactly as found in the source document. */
  readonly notation: string;
  /** Same text with whitespace collapsed; used for parsing. */
  readonly notationNormalized: string;
  readonly source: string;
  /** True when the importer parsed and executed the notation successfully. */
  readonly verified: boolean;
  readonly status: RecordStatus;
  readonly issues: readonly string[];
}

export interface WithdrawnSlot {
  readonly edition: string;
  readonly code: string;
  readonly column: string;
  readonly row: number;
  readonly marker: string;
  readonly meaning: string;
}

export interface EditionMetadata {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly title: string;
  readonly approved: string;
  readonly validity: string;
  readonly active: boolean;
  readonly sourceUrl: string;
  readonly sourceFile: string;
  readonly declaredTotal: number | null;
  readonly slots: number;
  readonly records: number;
  readonly withdrawn: number;
  readonly byCategory: Readonly<Record<TablitaCategory, number>>;
  readonly verified: number;
  readonly pending: number;
  readonly invalid: number;
}

export interface CategoryInfo {
  readonly name: string;
  readonly description: string;
}

export interface TablitaMetadata {
  readonly schemaVersion: number;
  readonly generatedAt: string;
  readonly consultedAt: string;
  readonly defaultEdition: string;
  readonly editions: readonly EditionMetadata[];
  readonly categories: Readonly<Record<TablitaCategory, CategoryInfo>>;
  readonly codexMapping: {
    readonly status: 'PENDING' | 'CONFIRMED';
    readonly byCategory: Readonly<Record<TablitaCategory, CodexTabua | null>>;
    readonly tabuaNames: Readonly<Record<CodexTabua, string>>;
    readonly note: string;
  };
  readonly boardNumbering: {
    readonly status: 'PENDING' | 'CONFIRMED';
    readonly description: string;
  };
  readonly withdrawnSlots: readonly WithdrawnSlot[];
}

/** One applied step, ready for display or auditing. */
export interface InterpretedStep {
  readonly ply: number;
  readonly color: PieceColor;
  readonly token: string;
  readonly from: SquareRef;
  readonly to: SquareRef;
  readonly captured: readonly SquareRef[];
  /** Long form, e.g. "a3-b4" or "b4:d6". */
  readonly longNotation: string;
}

export type InterpretationResult =
  | {
      readonly ok: true;
      readonly category: TablitaCategory;
      readonly board: BoardState;
      readonly sideToMove: PieceColor;
      readonly steps: readonly InterpretedStep[];
    }
  | {
      readonly ok: false;
      readonly category: TablitaCategory | null;
      readonly errors: readonly string[];
    };
