/**
 * Test helpers that load the real collection shipped with the app
 * (src/assets/data), validated through the same type guards used at runtime.
 */
import { createEmptyBoard, parseSquare } from '../app/core/engine/draughts-engine';
import type { BoardPiece, BoardState } from '../app/core/models/board.model';
import type { TablitaMetadata, TablitaRecord } from '../app/core/models/tablita.model';
import { isTablitaMetadata, isTablitaRecord } from '../app/core/services/tablita.service';
import metadataJson from '../assets/data/metadata.json';
import tablitasJson from '../assets/data/tablitas.json';

export const CURRENT_EDITION = 'IDF-2024-BR-772';
export const PREVIOUS_EDITION = 'IDF-2017-BR-745';

export function loadRecords(): TablitaRecord[] {
  const data: unknown = tablitasJson;
  if (!Array.isArray(data)) throw new Error('tablitas.json não é uma lista.');
  const records = data.filter(isTablitaRecord);
  if (records.length !== data.length) throw new Error('tablitas.json contém registros malformados.');
  return records;
}

export function loadMetadata(): TablitaMetadata {
  const data: unknown = metadataJson;
  if (!isTablitaMetadata(data)) throw new Error('metadata.json malformado.');
  return data;
}

/** Raw JSON payloads, as the HTTP layer would deliver them. */
export const rawTablitas = tablitasJson;
export const rawMetadata = metadataJson;

export function findByNotation(edition: string, notation: string): TablitaRecord {
  const record = loadRecords().find((r) => r.edition === edition && r.notationNormalized === notation);
  if (!record) throw new Error(`Registro "${notation}" não encontrado em ${edition}.`);
  return record;
}

/** Builds a board from a map like { d4: 'w', e5: 'b', a1: 'W' } (upper case = king). */
export function boardFrom(pieces: Record<string, 'w' | 'b' | 'W' | 'B'>): BoardState {
  const board = createEmptyBoard();
  for (const [square, code] of Object.entries(pieces)) {
    const ref = parseSquare(square);
    if (!ref) throw new Error(`Casa inválida: ${square}`);
    const piece: BoardPiece = {
      color: code.toLowerCase() === 'w' ? 'WHITE' : 'BLACK',
      type: code === code.toUpperCase() ? 'KING' : 'MAN',
    };
    board[ref.row][ref.col] = piece;
  }
  return board;
}

/** Squares occupied by a colour, as sorted algebraic names. */
export function occupied(board: BoardState, color: BoardPiece['color']): string[] {
  const files = 'abcdefgh';
  const out: string[] = [];
  board.forEach((line, row) =>
    line.forEach((piece, col) => {
      if (piece?.color === color) out.push(`${files[col]}${8 - row}`);
    }),
  );
  return out.sort();
}
