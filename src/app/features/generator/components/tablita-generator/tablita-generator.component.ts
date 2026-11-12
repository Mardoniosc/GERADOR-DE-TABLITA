import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import type { SquareRef } from '../../../../core/models/board.model';
import { BoardService } from '../../../../core/services/board.service';
import { TablitaService } from '../../../../core/services/tablita.service';
import { CheckersBoardComponent } from '../../../../shared/components/checkers-board/checkers-board.component';
import { TablitaResultComponent } from '../tablita-result/tablita-result.component';

/** Visual feedback length; the draw itself is synchronous and never waits on it. */
const DRAW_FEEDBACK_MS = 420;

@Component({
  selector: 'app-tablita-generator',
  imports: [CheckersBoardComponent, TablitaResultComponent],
  templateUrl: './tablita-generator.component.html',
  styleUrl: './tablita-generator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablitaGeneratorComponent implements OnInit {
  protected readonly tablitas = inject(TablitaService);
  private readonly boardService = inject(BoardService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly initialBoard = this.boardService.initialBoard();
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  /** True for a short moment after each draw (animation only). */
  protected readonly drawing = signal(false);

  protected readonly current = this.tablitas.current;
  protected readonly available = computed(() => this.tablitas.eligible().length);

  protected readonly board = computed(() => this.current()?.result.board ?? this.initialBoard);

  protected readonly highlights = computed<{ origins: SquareRef[]; targets: SquareRef[] }>(() => {
    const drawn = this.current();
    if (!drawn) return { origins: [], targets: [] };
    const steps = drawn.result.steps;
    if (drawn.result.category === 'POSITIONS') {
      return { origins: steps.map((s) => s.from), targets: steps.map((s) => s.to) };
    }
    const last = steps.at(-1);
    return last ? { origins: [last.from], targets: [last.to] } : { origins: [], targets: [] };
  });

  protected readonly tabuaName = computed(() => {
    const drawn = this.current();
    return drawn ? this.tablitas.codexTabuaName(drawn.record) : null;
  });

  protected readonly boardLabel = computed(() => {
    const drawn = this.current();
    return drawn ? `Tablita ${drawn.record.code}` : 'Posição inicial';
  });

  ngOnInit(): void {
    void this.tablitas.load();
    this.destroyRef.onDestroy(() => {
      if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    });
  }

  protected generate(): void {
    if (this.tablitas.status() !== 'ready') return;
    this.tablitas.generate();
    this.drawing.set(true);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.drawing.set(false), DRAW_FEEDBACK_MS);
  }

  protected selectEdition(id: string): void {
    this.tablitas.selectEdition(id);
  }

  protected retry(): void {
    void this.tablitas.load();
  }
}
