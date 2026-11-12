import { TestBed } from '@angular/core/testing';

import { CURRENT_EDITION, PREVIOUS_EDITION, findByNotation, loadRecords, occupied } from '../../../testing/tablita-fixtures';
import { TablitaNotationService } from './tablita-notation.service';

const INITIAL_WHITE = ['a1', 'c1', 'e1', 'g1', 'b2', 'd2', 'f2', 'h2', 'a3', 'c3', 'e3', 'g3'];
const INITIAL_BLACK = ['b6', 'd6', 'f6', 'h6', 'a7', 'c7', 'e7', 'g7', 'b8', 'd8', 'f8', 'h8'];
const swap = (list: string[], remove: string[], add: string[]) =>
  [...list.filter((s) => !remove.includes(s)), ...add].sort();

/** Real samples from the official IDF tables, one group per category. */
describe('TablitaNotationService – amostras reais', () => {
  let service: TablitaNotationService;

  beforeEach(() => {
    service = TestBed.inject(TablitaNotationService);
  });

  describe('categoria MOVES (sorteio de lances)', () => {
    it('I-1 "ab4": um lance, jogam as pretas', () => {
      const record = findByNotation(CURRENT_EDITION, 'ab4');
      expect(record.code).toBe('I-1');
      const result = service.interpretRecord(record);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.sideToMove).toBe('BLACK');
      expect(occupied(result.board, 'WHITE')).toEqual(swap(INITIAL_WHITE, ['a3'], ['b4']));
      expect(occupied(result.board, 'BLACK')).toEqual([...INITIAL_BLACK].sort());
    });

    it('III-4 "ab4 bc5 ba5 cb4": quatro lances sem captura', () => {
      const result = service.interpretRecord(findByNotation(CURRENT_EDITION, 'ab4 bc5 ba5 cb4'));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.steps.map((s) => s.longNotation)).toEqual(['a3-b4', 'b6-c5', 'b4-a5', 'c5-b4']);
      expect(result.sideToMove).toBe('WHITE');
      expect(occupied(result.board, 'WHITE')).toEqual(swap(INITIAL_WHITE, ['a3'], ['a5']));
      expect(occupied(result.board, 'BLACK')).toEqual(swap(INITIAL_BLACK, ['b6'], ['b4']));
    });

    it('XVII-9 "ed4 bc5 db6 ca5 ab4 ab6": troca de peças com captura e recaptura', () => {
      const record = findByNotation(CURRENT_EDITION, 'ed4 bc5 db6 ca5 ab4 ab6');
      expect(record.code).toBe('XVII-9');
      const result = service.interpretRecord(record);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.steps.map((s) => s.longNotation)).toEqual(['e3-d4', 'b6-c5', 'd4:b6', 'c7:a5', 'a3-b4', 'a7-b6']);
      expect(occupied(result.board, 'WHITE')).toEqual(swap(INITIAL_WHITE, ['a3', 'e3'], ['b4']));
      expect(occupied(result.board, 'BLACK')).toEqual(swap(INITIAL_BLACK, ['a7', 'c7'], ['a5']));
      expect(result.sideToMove).toBe('WHITE');
    });

    it('todas as sequências de lances da edição vigente são executáveis', () => {
      const moves = loadRecords().filter((r) => r.edition === CURRENT_EDITION && r.category === 'MOVES');
      expect(moves.length).toBe(361);
      expect(moves.every((r) => service.isExecutable(r.notationNormalized))).toBe(true);
    });
  });

  describe('categoria POSITIONS (peças deslocadas)', () => {
    it('IV-1 "a3-a5 f6-a3": pedra preta ocupa a casa liberada pela branca', () => {
      const record = findByNotation(CURRENT_EDITION, 'a3-a5 f6-a3');
      expect(record.code).toBe('IV-1');
      const result = service.interpretRecord(record);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.sideToMove).toBe('WHITE');
      expect(occupied(result.board, 'WHITE')).toEqual(swap(INITIAL_WHITE, ['a3'], ['a5']));
      expect(occupied(result.board, 'BLACK')).toEqual(swap(INITIAL_BLACK, ['f6'], ['a3']));
    });

    it('VIII-13 "b2-a5 ---": só as brancas deslocam', () => {
      const record = findByNotation(CURRENT_EDITION, 'b2-a5 ---');
      expect(record.code).toBe('VIII-13');
      const result = service.interpretRecord(record);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(occupied(result.board, 'WHITE')).toEqual(swap(INITIAL_WHITE, ['b2'], ['a5']));
      expect(occupied(result.board, 'BLACK')).toEqual([...INITIAL_BLACK].sort());
    });

    it('"h2-a7 a7-d4": a branca vai para a casa de onde a preta saiu', () => {
      const result = service.interpretRecord(findByNotation(CURRENT_EDITION, 'h2-a7 a7-d4'));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(occupied(result.board, 'WHITE')).toEqual(swap(INITIAL_WHITE, ['h2'], ['a7']));
      expect(occupied(result.board, 'BLACK')).toEqual(swap(INITIAL_BLACK, ['a7'], ['d4']));
    });

    it('todas as posições da edição 2017 são aplicáveis', () => {
      const positions = loadRecords().filter((r) => r.edition === PREVIOUS_EDITION && r.category === 'POSITIONS');
      expect(positions.length).toBe(393);
      expect(positions.every((r) => service.isExecutable(r.notationNormalized))).toBe(true);
    });
  });

  describe('registro pendente (fora do padrão)', () => {
    it('II-1 "a1-a5" não é classificado nem executado', () => {
      const record = findByNotation(CURRENT_EDITION, 'a1-a5');
      expect(service.classify(record.notation)).toBeNull();
      const result = service.interpretRecord(record);
      expect(result.ok).toBe(false);
    });
  });
});
