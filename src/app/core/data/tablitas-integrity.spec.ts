/**
 * Automated integrity check of the final collection (src/assets/data).
 * Any re-import that changes counts, breaks a notation or invents a CODEX
 * mapping fails here.
 */
import { CURRENT_EDITION, PREVIOUS_EDITION, loadMetadata, loadRecords } from '../../../testing/tablita-fixtures';
import { interpretTablita, normalizeNotation } from '../engine/draughts-engine';

describe('Integridade da coleção de Tablitas', () => {
  const records = loadRecords();
  const metadata = loadMetadata();
  const of = (edition: string) => records.filter((r) => r.edition === edition);

  it('carrega os registros das duas edições oficiais da IDF', () => {
    expect(records.length).toBe(772 + 736);
    expect(new Set(records.map((r) => r.edition))).toEqual(new Set([CURRENT_EDITION, PREVIOUS_EDITION]));
  });

  it('edição vigente (2024) tem as 772 posições declaradas no documento', () => {
    const current = of(CURRENT_EDITION);
    const meta = metadata.editions.find((e) => e.id === CURRENT_EDITION);
    expect(current.length).toBe(772);
    expect(meta?.declaredTotal).toBe(772);
    expect(meta?.slots).toBe(780);
    expect(meta?.withdrawn).toBe(8);
  });

  it('edição 2017 tem grade de 745 casas, das quais 9 retiradas (736 registros)', () => {
    const previous = of(PREVIOUS_EDITION);
    const meta = metadata.editions.find((e) => e.id === PREVIOUS_EDITION);
    expect(previous.length).toBe(736);
    expect(meta?.slots).toBe(745);
    expect(meta?.withdrawn).toBe(9);
    expect(metadata.withdrawnSlots.filter((w) => w.edition === PREVIOUS_EDITION)).toHaveLength(9);
  });

  it('distribuição por categoria confere com o metadata', () => {
    const count = (edition: string, category: 'MOVES' | 'POSITIONS') =>
      of(edition).filter((r) => r.category === category).length;
    expect(count(CURRENT_EDITION, 'MOVES')).toBe(361);
    expect(count(CURRENT_EDITION, 'POSITIONS')).toBe(410);
    expect(count(PREVIOUS_EDITION, 'MOVES')).toBe(342);
    expect(count(PREVIOUS_EDITION, 'POSITIONS')).toBe(393);
    for (const e of metadata.editions) {
      expect(of(e.id).length).toBe(e.records);
      expect(count(e.id, 'MOVES')).toBe(e.byCategory.MOVES);
      expect(count(e.id, 'POSITIONS')).toBe(e.byCategory.POSITIONS);
    }
  });

  it('não há identificadores duplicados nem casas repetidas na mesma edição', () => {
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length);
    expect(new Set(records.map((r) => `${r.edition}|${r.code}`)).size).toBe(records.length);
  });

  it('casas retiradas ("***") não aparecem como registros', () => {
    for (const w of metadata.withdrawnSlots) {
      expect(records.some((r) => r.edition === w.edition && r.code === w.code)).toBe(false);
    }
    expect(records.some((r) => r.notationNormalized.includes('*'))).toBe(false);
  });

  it('preserva a notação original e a forma normalizada é derivada dela', () => {
    for (const r of records) {
      expect(r.notation.trim().length).toBeGreaterThan(0);
      expect(normalizeNotation(r.notation)).toBe(r.notationNormalized);
    }
  });

  it('todo registro verificado é executável no tabuleiro e coerente com sua categoria', () => {
    const valid = records.filter((r) => r.status === 'VALID');
    expect(valid.length).toBe(771 + 735);
    for (const r of valid) {
      expect(r.verified).toBe(true);
      const result = interpretTablita(r.notationNormalized);
      expect(result.ok, `${r.id}: ${result.ok ? '' : result.errors.join(' ')}`).toBe(true);
      expect(result.category).toBe(r.category);
    }
  });

  it('o único pendente é a casa II-1 ("a1-a5"), sem completar a notação por inferência', () => {
    const pending = records.filter((r) => r.status !== 'VALID');
    expect(pending.map((r) => `${r.edition}:${r.code}`).sort()).toEqual(
      [`${CURRENT_EDITION}:II-1`, `${PREVIOUS_EDITION}:II-1`].sort(),
    );
    for (const r of pending) {
      expect(r.verified).toBe(false);
      expect(r.notationNormalized).toBe('a1-a5');
      expect(r.category).toBeNull();
    }
  });

  it('não atribui Tábua do CODEX enquanto o mapeamento não for confirmado', () => {
    expect(metadata.codexMapping.status).toBe('PENDING');
    expect(records.every((r) => r.codexTabua === null)).toBe(true);
    expect(Object.values(metadata.codexMapping.byCategory).every((v) => v === null)).toBe(true);
  });

  it('cada registro cita a fonte oficial', () => {
    for (const r of records) {
      expect(r.source).toContain('IDF');
      expect(r.source).toContain('https://idf64.org/');
    }
  });

  it('documenta a duplicidade existente no documento oficial de 2024 (XXI-26 = XXIII-4)', () => {
    const dup = of(CURRENT_EDITION).filter((r) => r.notationNormalized === 'gf4 ba5 cb4 ac3 bd4 fg5');
    expect(dup.map((r) => r.code).sort()).toEqual(['XXI-26', 'XXIII-4']);
    for (const r of dup) {
      expect(r.issues.some((i) => i.includes('idêntica'))).toBe(true);
    }
  });
});
