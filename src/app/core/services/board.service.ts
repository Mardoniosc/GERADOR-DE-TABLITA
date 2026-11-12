import { Injectable } from '@angular/core';

import {
  BOARD_SIZE,
  createInitialBoard,
  isDarkSquare,
  squareNumber,
  toAlgebraic,
} from '../engine/draughts-engine';
import type { BoardState } from '../models/board.model';

/** A rendered square, ready for the board component. */
export interface BoardSquareView {
  readonly row: number;
  readonly col: number;
  readonly dark: boolean;
  /** 1–32 on dark squares, null on light squares. */
  readonly number: number | null;
  readonly algebraic: string;
}

/** Board geometry and the initial position, for presentation code. */
@Injectable({ providedIn: 'root' })
export class BoardService {
  /** The 64 squares in render order: rank 8 to rank 1, file a to h. */
  readonly squares: readonly BoardSquareView[] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
    const row = Math.floor(i / BOARD_SIZE);
    const col = i % BOARD_SIZE;
    return {
      row,
      col,
      dark: isDarkSquare(row, col),
      number: squareNumber(row, col),
      algebraic: toAlgebraic({ row, col }),
    };
  });

  readonly files: readonly string[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  readonly ranks: readonly number[] = [8, 7, 6, 5, 4, 3, 2, 1];

  initialBoard(): BoardState {
    return createInitialBoard();
  }
}
