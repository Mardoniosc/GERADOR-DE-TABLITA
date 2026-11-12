import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppUpdateService } from './core/services/app-update.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    @if (updates.updateReady()) {
      <div class="update" role="status">
        <span>Nova versão disponível.</span>
        <button type="button" (click)="updates.applyUpdate()">Atualizar</button>
      </div>
    }
    <router-outlet />
  `,
  styles: `
    .update {
      position: fixed;
      top: max(10px, env(safe-area-inset-top));
      left: 50%;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: calc(100% - 32px);
      padding: 8px 8px 8px 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-2);
      color: var(--text-strong);
      font-size: 0.86rem;
      box-shadow: 0 10px 30px -10px rgb(0 0 0 / 0.7);
      transform: translateX(-50%);
    }
    button {
      padding: 6px 12px;
      border: 0;
      border-radius: 8px;
      background: var(--accent);
      color: #1b1408;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  protected readonly updates = inject(AppUpdateService);

  ngOnInit(): void {
    this.updates.start();
  }
}
