import { ComponentFixture, TestBed } from '@angular/core/testing';

import { boardFrom } from '../../../../testing/tablita-fixtures';
import { createInitialBoard, interpretTablita } from '../../../core/engine/draughts-engine';
import type { BoardState } from '../../../core/models/board.model';
import { CheckersBoardComponent } from './checkers-board.component';

describe('CheckersBoardComponent', () => {
  let fixture: ComponentFixture<CheckersBoardComponent>;
  let el: HTMLElement;

  function render(board: BoardState, extra: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(CheckersBoardComponent);
    fixture.componentRef.setInput('board', board);
    for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    el = fixture.nativeElement;
  }

  it('renderiza 64 casas, sendo 32 escuras numeradas de 1 a 32', () => {
    render(createInitialBoard());
    expect(el.querySelectorAll('.square')).toHaveLength(64);
    const dark = el.querySelectorAll('.square.dark');
    expect(dark).toHaveLength(32);
    const numbers = Array.from(el.querySelectorAll('.number')).map((n) => Number(n.textContent));
    expect(numbers).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(el.querySelector('[data-square="b8"] .number')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('[data-square="g1"] .number')?.textContent?.trim()).toBe('32');
  });

  it('mantém a orientação oficial: a1 escura no canto inferior esquerdo', () => {
    render(createInitialBoard());
    const squares = el.querySelectorAll('.square');
    const bottomLeft = squares[56];
    const topRight = squares[7];
    expect(bottomLeft.getAttribute('data-square')).toBe('a1');
    expect(bottomLeft.classList.contains('dark')).toBe(true);
    expect(topRight.getAttribute('data-square')).toBe('h8');
  });

  it('renderiza as 24 pedras da posição inicial nas casas corretas', () => {
    render(createInitialBoard());
    expect(el.querySelectorAll('.piece.white')).toHaveLength(12);
    expect(el.querySelectorAll('.piece.black')).toHaveLength(12);
    expect(el.querySelector('[data-square="a1"] .piece.white')).not.toBeNull();
    expect(el.querySelector('[data-square="h8"] .piece.black')).not.toBeNull();
    expect(el.querySelectorAll('.square.light .piece')).toHaveLength(0);
  });

  it('diferencia damas das pedras comuns com uma coroa', () => {
    render(boardFrom({ a1: 'W', h8: 'b', c3: 'B' }));
    expect(el.querySelectorAll('.piece')).toHaveLength(3);
    expect(el.querySelectorAll('.piece.king')).toHaveLength(2);
    expect(el.querySelectorAll('.crown')).toHaveLength(2);
    expect(el.querySelector('[data-square="a1"] [data-piece="WHITE-KING"] .crown')).not.toBeNull();
    expect(el.querySelector('[data-square="h8"] .crown')).toBeNull();
  });

  it('renderiza a posição resultante de uma Tablita e destaca origem e destino', () => {
    const result = interpretTablita('a3-a5 f6-g5');
    if (!result.ok) throw new Error('falha na interpretação');
    render(result.board, {
      origins: result.steps.map((s) => s.from),
      targets: result.steps.map((s) => s.to),
    });
    expect(el.querySelector('[data-square="a5"] .piece.white')).not.toBeNull();
    expect(el.querySelector('[data-square="g5"] .piece.black')).not.toBeNull();
    expect(el.querySelector('[data-square="a3"] .piece')).toBeNull();
    expect(el.querySelector('[data-square="a5"]')?.classList.contains('target')).toBe(true);
    expect(el.querySelector('[data-square="f6"]')?.classList.contains('origin')).toBe(true);
  });

  it('descreve a posição para leitores de tela', () => {
    render(boardFrom({ a1: 'W', h8: 'b' }), { label: 'Teste' });
    const label = el.querySelector('.board')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Teste');
    expect(label).toContain('a1 (dama)');
    expect(label).toContain('Pretas: h8');
  });

  it('pode ocultar a numeração', () => {
    render(createInitialBoard(), { showNumbers: false });
    expect(el.querySelectorAll('.number')).toHaveLength(0);
  });
});
