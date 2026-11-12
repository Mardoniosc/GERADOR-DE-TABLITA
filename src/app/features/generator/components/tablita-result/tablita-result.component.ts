import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { toAlgebraic } from '../../../../core/engine/draughts-engine';
import type { InterpretedStep } from '../../../../core/models/tablita.model';
import type { DrawnTablita } from '../../../../core/services/tablita.service';

interface MovePair {
  readonly number: number;
  readonly white: InterpretedStep | null;
  readonly black: InterpretedStep | null;
}

/** Shows the drawn Tablita: code, category, original notation and decoded moves. */
@Component({
  selector: 'app-tablita-result',
  templateUrl: './tablita-result.component.html',
  styleUrl: './tablita-result.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablitaResultComponent {
  readonly drawn = input.required<DrawnTablita>();
  /** CODEX table name, or null while the mapping is unconfirmed. */
  readonly tabuaName = input<string | null>(null);
  readonly editionLabel = input('');
  readonly total = input(0);

  readonly record = computed(() => this.drawn().record);
  readonly result = computed(() => this.drawn().result);

  readonly heading = computed(() => (this.tabuaName() ?? this.record().categoryName).toUpperCase());

  readonly sideToMove = computed(() => (this.result().sideToMove === 'WHITE' ? 'brancas' : 'pretas'));

  /** Move sequences grouped as numbered White/Black pairs. */
  readonly pairs = computed<readonly MovePair[]>(() => {
    const steps = this.result().steps;
    const pairs: MovePair[] = [];
    for (let i = 0; i < steps.length; i += 2) {
      pairs.push({ number: i / 2 + 1, white: steps[i] ?? null, black: steps[i + 1] ?? null });
    }
    return pairs;
  });

  /** Relocations of a POSITIONS entry, with "sem deslocamento" made explicit. */
  readonly relocations = computed(() => {
    const steps = this.result().steps;
    const find = (color: InterpretedStep['color']) => steps.find((s) => s.color === color) ?? null;
    return (['WHITE', 'BLACK'] as const).map((color) => {
      const step = find(color);
      return {
        color,
        name: color === 'WHITE' ? 'Brancas' : 'Pretas',
        text: step ? `${toAlgebraic(step.from)} → ${toAlgebraic(step.to)}` : 'sem deslocamento',
      };
    });
  });
}
