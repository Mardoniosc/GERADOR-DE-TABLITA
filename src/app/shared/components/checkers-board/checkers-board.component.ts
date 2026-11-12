import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { toAlgebraic } from '../../../core/engine/draughts-engine';
import type { BoardPiece, BoardState, SquareRef } from '../../../core/models/board.model';
import { BoardService, type BoardSquareView } from '../../../core/services/board.service';

interface SquareCell extends BoardSquareView {
  readonly piece: BoardPiece | null;
  readonly origin: boolean;
  readonly target: boolean;
  readonly label: string;
}

const PIECE_NAMES: Record<BoardPiece['color'], Record<BoardPiece['type'], string>> = {
  WHITE: { MAN: 'pedra branca', KING: 'dama branca' },
  BLACK: { MAN: 'pedra preta', KING: 'dama preta' },
};

/**
 * 8×8 Brazilian draughts board. Purely presentational: it renders whatever
 * `BoardState` it receives and knows nothing about rules or notation.
 */
@Component({
  selector: 'app-checkers-board',
  templateUrl: './checkers-board.component.html',
  styleUrl: './checkers-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckersBoardComponent {
  private readonly boardService = inject(BoardService);

  /** Position to render, `BoardState[row][col]` with row 0 = rank 8. */
  readonly board = input.required<BoardState>();
  /** Squares pieces left (drawn with a subtle ring). */
  readonly origins = input<readonly SquareRef[]>([]);
  /** Squares pieces arrived on (drawn highlighted). */
  readonly targets = input<readonly SquareRef[]>([]);
  readonly showNumbers = input(true);
  readonly showCoordinates = input(true);
  /** Change it to replay the piece entrance animation. */
  readonly revision = input(0);
  readonly label = input('Tabuleiro de damas');

  readonly files = this.boardService.files;
  readonly ranks = this.boardService.ranks;

  readonly cells = computed<readonly SquareCell[]>(() => {
    const board = this.board();
    const origins = new Set(this.origins().map(toAlgebraic));
    const targets = new Set(this.targets().map(toAlgebraic));
    return this.boardService.squares.map((sq) => {
      const piece = board[sq.row]?.[sq.col] ?? null;
      const parts = [sq.algebraic];
      if (sq.number !== null) parts.push(`casa ${sq.number}`);
      parts.push(piece ? PIECE_NAMES[piece.color][piece.type] : 'vazia');
      return {
        ...sq,
        piece,
        origin: origins.has(sq.algebraic),
        target: targets.has(sq.algebraic),
        label: parts.join(', '),
      };
    });
  });

  /** Text summary of the position for screen readers. */
  readonly description = computed(() => {
    const list = (color: BoardPiece['color']): string =>
      this.cells()
        .filter((c) => c.piece?.color === color)
        .map((c) => (c.piece?.type === 'KING' ? `${c.algebraic} (dama)` : c.algebraic))
        .join(', ') || 'nenhuma';
    return `${this.label()}. Brancas: ${list('WHITE')}. Pretas: ${list('BLACK')}.`;
  });
}
