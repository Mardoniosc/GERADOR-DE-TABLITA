import { boardFrom, occupied } from '../../../testing/tablita-fixtures';
import {
  classifyNotation,
  countPieces,
  createInitialBoard,
  generateLegalMoves,
  applyMove,
  interpretTablita,
  isDarkSquare,
  normalizeNotation,
  parseSquare,
  squareNumber,
  toAlgebraic,
} from './draughts-engine';

const longMoves = (moves: ReturnType<typeof generateLegalMoves>): string[] =>
  moves.map((m) => m.path.map(toAlgebraic).join(m.captured.length ? ':' : '-')).sort();

describe('draughts-engine – tabuleiro e posição inicial', () => {
  it('tem 64 casas, 32 escuras jogáveis, com a1 escura no canto das brancas', () => {
    let dark = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (isDarkSquare(r, c)) dark++;
    expect(dark).toBe(32);
    const a1 = parseSquare('a1');
    const h8 = parseSquare('h8');
    expect(a1 && isDarkSquare(a1.row, a1.col)).toBe(true);
    expect(h8 && isDarkSquare(h8.row, h8.col)).toBe(true);
  });

  it('numera as casas escuras de 1 (b8) a 32 (g1), sem repetir', () => {
    const numbers: number[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const n = squareNumber(r, c);
        if (isDarkSquare(r, c)) numbers.push(n ?? -1);
        else expect(n).toBeNull();
      }
    }
    expect(numbers).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    const at = (s: string): number | null => {
      const ref = parseSquare(s);
      return ref ? squareNumber(ref.row, ref.col) : null;
    };
    expect(at('b8')).toBe(1);
    expect(at('h8')).toBe(4);
    expect(at('a1')).toBe(29);
    expect(at('g1')).toBe(32);
  });

  it('monta a posição inicial com 12 pedras brancas (1ª–3ª fileiras) e 12 pretas (6ª–8ª)', () => {
    const board = createInitialBoard();
    expect(countPieces(board, 'WHITE')).toBe(12);
    expect(countPieces(board, 'BLACK')).toBe(12);
    expect(occupied(board, 'WHITE')).toEqual(
      ['a1', 'c1', 'e1', 'g1', 'b2', 'd2', 'f2', 'h2', 'a3', 'c3', 'e3', 'g3'].sort(),
    );
    expect(occupied(board, 'BLACK')).toEqual(
      ['b6', 'd6', 'f6', 'h6', 'a7', 'c7', 'e7', 'g7', 'b8', 'd8', 'f8', 'h8'].sort(),
    );
    expect(board.flat().every((p) => p === null || p.type === 'MAN')).toBe(true);
  });

  it('as brancas têm 7 lances possíveis na posição inicial', () => {
    expect(longMoves(generateLegalMoves(createInitialBoard(), 'WHITE'))).toEqual(
      ['a3-b4', 'c3-b4', 'c3-d4', 'e3-d4', 'e3-f4', 'g3-f4', 'g3-h4'].sort(),
    );
  });
});

describe('draughts-engine – regras de movimentação', () => {
  it('captura é obrigatória', () => {
    const board = boardFrom({ d4: 'w', a1: 'w', e5: 'b' });
    expect(longMoves(generateLegalMoves(board, 'WHITE'))).toEqual(['d4:f6']);
  });

  it('a pedra captura para trás', () => {
    const board = boardFrom({ c5: 'w', d4: 'b' });
    expect(longMoves(generateLegalMoves(board, 'WHITE'))).toEqual(['c5:e3']);
  });

  it('aplica a lei da maioria (captura que toma mais peças)', () => {
    // a3 pode tomar b4 (1 peça); e3 pode tomar f4 e depois f6 (2 peças).
    const board = boardFrom({ a3: 'w', e3: 'w', b4: 'b', f4: 'b', f6: 'b' });
    expect(longMoves(generateLegalMoves(board, 'WHITE'))).toEqual(['e3:g5:e7']);
  });

  it('a dama é voadora: anda e captura à distância, parando em qualquer casa livre após a peça', () => {
    const quiet = generateLegalMoves(boardFrom({ a1: 'W' }), 'WHITE');
    expect(quiet).toHaveLength(7);
    const capture = generateLegalMoves(boardFrom({ a1: 'W', d4: 'b' }), 'WHITE');
    expect(longMoves(capture)).toEqual(['a1:e5', 'a1:f6', 'a1:g7', 'a1:h8']);
  });

  it('peças capturadas permanecem até o fim do lance (regra turca) e não são tomadas duas vezes', () => {
    const board = boardFrom({ a1: 'W', c3: 'b', e5: 'b', f6: 'b' });
    // c3 é tomada; e5+f6 juntas bloqueiam a diagonal.
    const moves = generateLegalMoves(board, 'WHITE');
    for (const m of moves) {
      const keys = m.captured.map(toAlgebraic);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(longMoves(moves)).toEqual(['a1:d4']);
  });

  it('promove a pedra que termina o lance na última fileira', () => {
    const board = boardFrom({ g7: 'w' });
    const move = generateLegalMoves(board, 'WHITE').find((m) => toAlgebraic(m.to) === 'h8');
    expect(move?.promotes).toBe(true);
    const after = move ? applyMove(board, move) : board;
    expect(after[0][7]).toEqual({ color: 'WHITE', type: 'KING' });
  });

  it('não promove a pedra que apenas passa pela última fileira durante a captura', () => {
    const board = boardFrom({ b6: 'w', c7: 'b', e7: 'b' });
    const moves = generateLegalMoves(board, 'WHITE');
    expect(longMoves(moves)).toEqual(['b6:d8:f6']);
    const after = applyMove(board, moves[0]);
    expect(after[2][5]).toEqual({ color: 'WHITE', type: 'MAN' });
  });
});

describe('draughts-engine – notação da Tablita', () => {
  it('classifica os formatos encontrados nas tabelas oficiais', () => {
    expect(classifyNotation('ab4')).toBe('MOVES');
    expect(classifyNotation('ab4 ba5 ed4 ab6 fe3 hg5')).toBe('MOVES');
    expect(classifyNotation('a3-a5 f6-g5')).toBe('POSITIONS');
    expect(classifyNotation('--- a7-a5')).toBe('POSITIONS');
    expect(classifyNotation('b2-a5 ---')).toBe('POSITIONS');
    expect(classifyNotation('a1-a5')).toBeNull();
    expect(classifyNotation('--- ---')).toBeNull();
    expect(classifyNotation('***')).toBeNull();
    expect(classifyNotation('ab9')).toBeNull();
  });

  it('normaliza espaços sem alterar os lances', () => {
    expect(normalizeNotation('  cd4 fg5  gh4 ba5 ')).toBe('cd4 fg5 gh4 ba5');
  });

  it('interpreta lances identificando origem, destino e lado a jogar', () => {
    const result = interpretTablita('ab4 ba5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps.map((s) => s.longNotation)).toEqual(['a3-b4', 'b6-a5']);
    expect(result.sideToMove).toBe('WHITE');
    expect(occupied(result.board, 'WHITE')).toContain('b4');
    expect(occupied(result.board, 'WHITE')).not.toContain('a3');
    expect(occupied(result.board, 'BLACK')).toContain('a5');
  });

  it('identifica capturas na notação abreviada', () => {
    const result = interpretTablita('ed4 bc5 db6');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const capture = result.steps[2];
    expect(capture.longNotation).toBe('d4:b6');
    expect(capture.captured.map(toAlgebraic)).toEqual(['c5']);
    expect(countPieces(result.board, 'BLACK')).toBe(11);
  });

  it('rejeita lance ilegal e lance que ignora captura obrigatória', () => {
    const illegal = interpretTablita('ab5');
    expect(illegal.ok).toBe(false);
    // Após "ed4 bc5" as brancas são obrigadas a capturar (db6).
    const ignoresCapture = interpretTablita('ed4 bc5 ab4');
    expect(ignoresCapture.ok).toBe(false);
  });

  it('aplica deslocamentos de posição (exemplo do sorteio "a3-a5 f6-g5")', () => {
    const result = interpretTablita('a3-a5 f6-g5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sideToMove).toBe('WHITE');
    expect(occupied(result.board, 'WHITE')).toContain('a5');
    expect(occupied(result.board, 'WHITE')).not.toContain('a3');
    expect(occupied(result.board, 'BLACK')).toContain('g5');
    expect(occupied(result.board, 'BLACK')).not.toContain('f6');
    expect(countPieces(result.board)).toBe(24);
  });

  it('permite que uma cor ocupe a casa liberada pela outra (deslocamento simultâneo)', () => {
    const result = interpretTablita('f2-c5 a7-f2');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(occupied(result.board, 'BLACK')).toContain('f2');
    expect(occupied(result.board, 'WHITE')).toContain('c5');
  });

  it('rejeita deslocamentos impossíveis', () => {
    expect(interpretTablita('a3-c3 ---').ok).toBe(false); // casa ocupada
    expect(interpretTablita('a3-a4 ---').ok).toBe(false); // casa clara
    expect(interpretTablita('a7-a5 ---').ok).toBe(false); // peça da cor errada
    expect(interpretTablita('d4-e5 ---').ok).toBe(false); // origem vazia
  });
});
