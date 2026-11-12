import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';

/** How often an open app asks the server for a new deployment. */
export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => () => location.reload(),
});

/**
 * Keeps the PWA from running an old deployment indefinitely.
 *
 * The Angular service worker downloads a new version in the background
 * (ngsw.json carries a hash of every file). This service:
 *  - checks for updates on start, every 30 min and whenever the app returns
 *    to the foreground (installed PWAs may stay open for days);
 *  - exposes `updateReady` so the UI can offer "Atualizar";
 *  - reloads automatically if the cached version became unusable.
 * A fresh page load always gets the newest version that is ready.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly reload = inject(PAGE_RELOAD);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;

  private readonly _updateReady = signal(false);
  readonly updateReady = this._updateReady.asReadonly();

  get enabled(): boolean {
    return this.swUpdate?.isEnabled ?? false;
  }

  start(): void {
    const sw = this.swUpdate;
    if (this.started || !sw?.isEnabled) {
      return;
    }
    this.started = true;

    sw.versionUpdates.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        this._updateReady.set(true);
      }
    });
    sw.unrecoverable.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reload());

    const timer = setInterval(() => void this.checkForUpdate(), UPDATE_CHECK_INTERVAL_MS);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void this.checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });

    void this.checkForUpdate();
  }

  /** Resolves true when a new version was found. Network errors are ignored (offline). */
  async checkForUpdate(): Promise<boolean> {
    if (!this.swUpdate?.isEnabled) return false;
    try {
      return await this.swUpdate.checkForUpdate();
    } catch {
      return false;
    }
  }

  /** Switches to the downloaded version and reloads the page. */
  async applyUpdate(): Promise<void> {
    try {
      await this.swUpdate?.activateUpdate();
    } finally {
      this.reload();
    }
  }
}
