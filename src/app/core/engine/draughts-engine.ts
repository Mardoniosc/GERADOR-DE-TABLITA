/**
 * Pure rules engine for Brazilian draughts (64 squares) and Tablita notation.
 *
 * Framework-free on purpose: it is used by the Angular services and by the
 * Node import script (`scripts/import-tablitas.ts`). Keep it a single module
 * whose only imports are `import type`, so Node can run it with type
 * stripping and no build step.
 *
 * Rules implemented (CBJD "Regras Oficiais", FMJD rules for Brazilian draughts):
 *  - White moves first; men move one square diagonally forward.
 *  - Capture is mandatory, forwards and backwards, for men and kings.
 *  - Majority law: the sequence capturing the most pieces must be played.
 *  - Flying kings: move and capture along whole diagonals and may land on any
 *    free square after the captured piece.
 *  - Turkish rule: captured pieces stay on the board until the move ends and
 *    cannot be jumped twice.
 *  - A man promotes only if it ends its move on the far rank; passing through
 *    it during a capture does not promote.
 */
import type { BoardPiece, BoardState, EngineMove, PieceColor, SquareRef } from '../models/board.model';
import type {
  InterpretationResult,
  InterpretedStep,
  TablitaCategory,
} from '../models/tablita.model';

export const BOARD_SIZE = 8;
const FILES = 'abcdefgh';
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

// ---------------------------------------------------------------------------
// Geometry and numbering
// ---------------------------------------------------------------------------

export function isInside(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/** Dark (playable) squares; a1 (row 7, col 0) is dark. */
export function isDarkSquare(row: number, col: number): boolean {
  return (row + col) % 2 === 1;
}

/** Rank 1..8 for a row index. */
export function rankOf(row: number): number {
  return BOARD_SIZE - row;
}

export function toAlgebraic(square: SquareRef): string {
  return `${FILES[square.col]}${rankOf(square.row)}`;
}

/** Parses "a1".."h8". Returns null for malformed input. */
export function parseSquare(text: string): SquareRef | null {
  const match = /^([a-h])([1-8])$/.exec(text);
  if (!match) {
    return null;
  }
  return { row: BOARD_SIZE - Number(match[2]), col: FILES.indexOf(match[1]) };
}

/**
 * Number 1–32 of a dark square, counted left to right from rank 8 down to
 * rank 1 as seen by White (b8 = 1 … g1 = 32). Returns null for light squares.
 *
 * This is the display convention adopted by the app. The official source
 * tables use algebraic notation only, so the numbering never takes part in
 * interpreting a Tablita.
 */
export function squareNumber(row: number, col: number): number | null {
  if (!isInside(row, col) || !isDarkSquare(row, col)) {
    return null;
  }
  return row * 4 + Math.floor(col / 2) + 1;
}

export function sameSquare(a: SquareRef, b: SquareRef): boolean {
  return a.row === b.row && a.col === b.col;
}

// ---------------------------------------------------------------------------
// Board construction
// ---------------------------------------------------------------------------

export function createEmptyBoard(): BoardState {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, (): BoardPiece | null => null),
  );
}

/** Initial position: 12 White men on ranks 1–3, 12 Black men on ranks 6–8. */
export function createInitialBoard(): BoardState {
  const board = createEmptyBoard();
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!isDarkSquare(row, col)) {
        continue;
      }
      if (row <= 2) {
        board[row][col] = { color: 'BLACK', type: 'MAN' };
      } else if (row >= 5) {
        board[row][col] = { color: 'WHITE', type: 'MAN' };
      }
    }
  }
  return board;
}

export function cloneBoard(board: BoardState): BoardState {
  return board.map((line) => line.map((piece) => (piece ? { ...piece } : null)));
}

export function countPieces(board: BoardState, color?: PieceColor): number {
  let total = 0;
  for (const line of board) {
    for (const piece of line) {
      if (piece && (color === undefined || piece.color === color)) {
        total++;
      }
    }
  }
  return total;
}

export function opponent(color: PieceColor): PieceColor {
  return color === 'WHITE' ? 'BLACK' : 'WHITE';
}

function forwardStep(color: PieceColor): number {
  return color === 'WHITE' ? -1 : 1;
}

function crowningRow(color: PieceColor): number {
  return color === 'WHITE' ? 0 : BOARD_SIZE - 1;
}

// ---------------------------------------------------------------------------
// Move generation
// ---------------------------------------------------------------------------

interface CaptureState {
  readonly at: SquareRef;
  readonly path: SquareRef[];
  readonly captured: SquareRef[];
}

/**
 * Every complete capture sequence available to the piece on `from`.
 * The moving piece is lifted off its origin, so the origin counts as empty.
 */
function captureSequences(board: BoardState, from: SquareRef): EngineMove[] {
  const piece = board[from.row][from.col];
  if (!piece) {
    return [];
  }
  const results: EngineMove[] = [];
  const isCaptured = (captured: readonly SquareRef[], r: number, c: number): boolean =>
    captured.some((s) => s.row === r && s.col === c);
  const isEmpty = (r: number, c: number): boolean =>
    (r === from.row && c === from.col) || board[r][c] === null;

  const explore = (state: CaptureState): void => {
    let extended = false;
    for (const [dr, dc] of DIRECTIONS) {
      if (piece.type === 'MAN') {
        const midR = state.at.row + dr;
        const midC = state.at.col + dc;
        const landR = midR + dr;
        const landC = midC + dc;
        if (!isInside(landR, landC)) {
          continue;
        }
        const target = board[midR][midC];
        if (
          target &&
          target.color !== piece.color &&
          !isCaptured(state.captured, midR, midC) &&
          isEmpty(landR, landC)
        ) {
          extended = true;
          const land = { row: landR, col: landC };
          explore({
            at: land,
            path: [...state.path, land],
            captured: [...state.captured, { row: midR, col: midC }],
          });
        }
      } else {
        // Flying king: slide over empty squares up to the first piece.
        let r = state.at.row + dr;
        let c = state.at.col + dc;
        while (isInside(r, c) && isEmpty(r, c)) {
          r += dr;
          c += dc;
        }
        if (!isInside(r, c)) {
          continue;
        }
        const target = board[r][c];
        if (!target || target.color === piece.color || isCaptured(state.captured, r, c)) {
          continue;
        }
        const victim = { row: r, col: c };
        let landR = r + dr;
        let landC = c + dc;
        while (isInside(landR, landC) && isEmpty(landR, landC)) {
          extended = true;
          const land = { row: landR, col: landC };
          explore({
            at: land,
            path: [...state.path, land],
            captured: [...state.captured, victim],
          });
          landR += dr;
          landC += dc;
        }
      }
    }
    if (!extended && state.captured.length > 0) {
      results.push({
        from,
        to: state.at,
        path: state.path,
        captured: state.captured,
        promotes: piece.type === 'MAN' && state.at.row === crowningRow(piece.color),
      });
    }
  };

  explore({ at: from, path: [from], captured: [] });
  return results;
}

function simpleMoves(board: BoardState, from: SquareRef): EngineMove[] {
  const piece = board[from.row][from.col];
  if (!piece) {
    return [];
  }
  const moves: EngineMove[] = [];
  if (piece.type === 'MAN') {
    const dr = forwardStep(piece.color);
    for (const dc of [-1, 1]) {
      const r = from.row + dr;
      const c = from.col + dc;
      if (isInside(r, c) && board[r][c] === null) {
        const to = { row: r, col: c };
        moves.push({ from, to, path: [from, to], captured: [], promotes: r === crowningRow(piece.color) });
      }
    }
  } else {
    for (const [dr, dc] of DIRECTIONS) {
      let r = from.row + dr;
      let c = from.col + dc;
      while (isInside(r, c) && board[r][c] === null) {
        const to = { row: r, col: c };
        moves.push({ from, to, path: [from, to], captured: [], promotes: false });
        r += dr;
        c += dc;
      }
    }
  }
  return moves;
}

/** All legal moves for `color`, applying mandatory capture and the majority law. */
export function generateLegalMoves(board: BoardState, color: PieceColor): EngineMove[] {
  const captures: EngineMove[] = [];
  const quiet: EngineMove[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== color) {
        continue;
      }
      const from = { row, col };
      captures.push(...captureSequences(board, from));
      quiet.push(...simpleMoves(board, from));
    }
  }
  if (captures.length === 0) {
    return quiet;
  }
  const most = Math.max(...captures.map((m) => m.captured.length));
  return captures.filter((m) => m.captured.length === most);
}

export function applyMove(board: BoardState, move: EngineMove): BoardState {
  const next = cloneBoard(board);
  const piece = next[move.from.row][move.from.col];
  if (!piece) {
    throw new Error(`Não há peça em ${toAlgebraic(move.from)}.`);
  }
  next[move.from.row][move.from.col] = null;
  for (const s of move.captured) {
    next[s.row][s.col] = null;
  }
  next[move.to.row][move.to.col] = move.promotes ? { color: piece.color, type: 'KING' } : piece;
  return next;
}

// ---------------------------------------------------------------------------
// Tablita notation
// ---------------------------------------------------------------------------

const MOVE_TOKEN = /^([a-h])([a-h][1-8])$/;
const RELOCATION_TOKEN = /^([a-h][1-8])-([a-h][1-8])$/;
const NO_RELOCATION = '---';

/** Collapses runs of whitespace; the raw text is preserved elsewhere. */
export function normalizeNotation(raw: string): string {
  return raw.trim().split(/\s+/).filter(Boolean).join(' ');
}

/**
 * Structural kind of an entry, or null if it matches neither IDF format.
 *  - MOVES:     "ab4", "ab4 ba5 ed4 ..." (origin file + destination square)
 *  - POSITIONS: exactly two tokens, White then Black, each "x9-y9" or "---"
 */
export function classifyNotation(raw: string): TablitaCategory | null {
  const tokens = normalizeNotation(raw).split(' ').filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => MOVE_TOKEN.test(t))) {
    return 'MOVES';
  }
  if (
    tokens.length === 2 &&
    tokens.every((t) => t === NO_RELOCATION || RELOCATION_TOKEN.test(t)) &&
    !(tokens[0] === NO_RELOCATION && tokens[1] === NO_RELOCATION)
  ) {
    return 'POSITIONS';
  }
  return null;
}

function colorName(color: PieceColor): string {
  return color === 'WHITE' ? 'brancas' : 'pretas';
}

function longNotation(move: EngineMove): string {
  const sep = move.captured.length > 0 ? ':' : '-';
  return move.path.map(toAlgebraic).join(sep);
}

/** Plays a sequence of short-notation moves from the initial position. */
function interpretMoves(tokens: readonly string[]): InterpretationResult {
  let board = createInitialBoard();
  let color: PieceColor = 'WHITE';
  const steps: InterpretedStep[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const match = MOVE_TOKEN.exec(token);
    const to = match ? parseSquare(match[2]) : null;
    if (!match || !to) {
      return { ok: false, category: 'MOVES', errors: [`Lance ${i + 1} ("${token}") malformado.`] };
    }
    const fromCol = FILES.indexOf(match[1]);
    const legal = generateLegalMoves(board, color);
    const candidates = legal.filter((m) => m.from.col === fromCol && sameSquare(m.to, to));
    if (candidates.length === 0) {
      const options = legal.map(longNotation).join(', ') || 'nenhum';
      return {
        ok: false,
        category: 'MOVES',
        errors: [
          `Lance ${i + 1} ("${token}") das ${colorName(color)} não é legal nesta posição. Lances legais: ${options}.`,
        ],
      };
    }
    // Several routes may reach the same square; they are interchangeable only
    // if they capture the same pieces from the same origin.
    const first = candidates[0];
    const ambiguous = candidates.some(
      (m) =>
        !sameSquare(m.from, first.from) ||
        m.captured.length !== first.captured.length ||
        !m.captured.every((s) => first.captured.some((f) => sameSquare(f, s))),
    );
    if (ambiguous) {
      return {
        ok: false,
        category: 'MOVES',
        errors: [
          `Lance ${i + 1} ("${token}") é ambíguo: ${candidates.map(longNotation).join(' | ')}.`,
        ],
      };
    }
    board = applyMove(board, first);
    steps.push({
      ply: i + 1,
      color,
      token,
      from: first.from,
      to: first.to,
      captured: first.captured,
      longNotation: longNotation(first),
    });
    color = opponent(color);
  }

  return { ok: true, category: 'MOVES', board, sideToMove: color, steps };
}

/**
 * Applies the relocations of a POSITIONS entry ("a3-a5 f6-g5"): both men are
 * lifted from their original squares and then placed, so a destination may
 * be the square the other side just vacated. White moves first.
 */
function interpretPositions(tokens: readonly string[]): InterpretationResult {
  const initial = createInitialBoard();
  const board = cloneBoard(initial);
  const errors: string[] = [];
  const colors: readonly PieceColor[] = ['WHITE', 'BLACK'];
  const moves: { color: PieceColor; token: string; from: SquareRef; to: SquareRef }[] = [];

  tokens.forEach((token, i) => {
    if (token === NO_RELOCATION) {
      return;
    }
    const color = colors[i];
    const match = RELOCATION_TOKEN.exec(token);
    const from = match ? parseSquare(match[1]) : null;
    const to = match ? parseSquare(match[2]) : null;
    if (!from || !to) {
      errors.push(`Deslocamento "${token}" malformado.`);
      return;
    }
    const piece = initial[from.row][from.col];
    if (!piece || piece.color !== color) {
      errors.push(`"${token}": não há pedra das ${colorName(color)} em ${toAlgebraic(from)} na posição inicial.`);
    }
    if (!isDarkSquare(to.row, to.col)) {
      errors.push(`"${token}": ${toAlgebraic(to)} não é uma casa escura.`);
    }
    if (to.row === crowningRow(color)) {
      errors.push(`"${token}": destino na linha de coroação das ${colorName(color)}.`);
    }
    moves.push({ color, token, from, to });
  });
  if (errors.length > 0) {
    return { ok: false, category: 'POSITIONS', errors };
  }

  for (const m of moves) {
    board[m.from.row][m.from.col] = null;
  }
  for (const m of moves) {
    if (board[m.to.row][m.to.col] !== null) {
      errors.push(`"${m.token}": a casa ${toAlgebraic(m.to)} está ocupada.`);
    } else {
      board[m.to.row][m.to.col] = { color: m.color, type: 'MAN' };
    }
  }
  if (errors.length > 0) {
    return { ok: false, category: 'POSITIONS', errors };
  }

  const steps: InterpretedStep[] = moves.map((m, i) => ({
    ply: i + 1,
    color: m.color,
    token: m.token,
    from: m.from,
    to: m.to,
    captured: [],
    longNotation: `${toAlgebraic(m.from)}→${toAlgebraic(m.to)}`,
  }));
  return { ok: true, category: 'POSITIONS', board, sideToMove: 'WHITE', steps };
}

/**
 * Interprets the notation of a Tablita entry and validates it:
 * classifies it, plays or applies it, and checks that the side to move has
 * at least one legal move in the resulting position.
 */
export function interpretTablita(raw: string): InterpretationResult {
  const normalized = normalizeNotation(raw);
  const category = classifyNotation(normalized);
  if (category === null) {
    return {
      ok: false,
      category: null,
      errors: [`Notação "${normalized}" não corresponde a nenhum formato reconhecido.`],
    };
  }
  const tokens = normalized.split(' ');
  const result = category === 'MOVES' ? interpretMoves(tokens) : interpretPositions(tokens);
  if (result.ok && generateLegalMoves(result.board, result.sideToMove).length === 0) {
    return {
      ok: false,
      category,
      errors: [`As ${colorName(result.sideToMove)} não têm lances legais na posição resultante.`],
    };
  }
  return result;
}
