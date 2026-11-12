/**
 * Board domain types for Brazilian draughts (64 squares).
 *
 * Coordinates: `BoardState[row][col]`, where row 0 is rank 8 (top of the
 * board as seen by White) and col 0 is file "a". Square a1 is dark and sits
 * at White's bottom-left, so the long diagonal (a1–h8) is on each player's
 * left, as the CBJD rules require.
 *
 * This file must not contain runtime values: the import script consumes it
 * through `import type`, which Node erases when stripping types.
 */

export type PieceColor = 'WHITE' | 'BLACK';
export type PieceType = 'MAN' | 'KING';

export interface BoardPiece {
  readonly color: PieceColor;
  readonly type: PieceType;
}

/** 8×8 grid. Light squares are always `null`. */
export type BoardState = (BoardPiece | null)[][];

export interface SquareRef {
  readonly row: number;
  readonly col: number;
}

/** A fully resolved legal move (simple move or complete capture sequence). */
export interface EngineMove {
  readonly from: SquareRef;
  readonly to: SquareRef;
  /** Every landing square, from origin to destination (inclusive). */
  readonly path: readonly SquareRef[];
  /** Squares of the captured pieces, in capture order. */
  readonly captured: readonly SquareRef[];
  readonly promotes: boolean;
}
