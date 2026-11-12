import { TestBed } from '@angular/core/testing';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { AppUpdateService, PAGE_RELOAD, UPDATE_CHECK_INTERVAL_MS } from './app-update.service';

class FakeSwUpdate {
  isEnabled = true;
  readonly versionUpdates = new Subject<VersionEvent>();
  readonly unrecoverable = new Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>();
  readonly checkForUpdate = vi.fn(() => Promise.resolve(false));
  readonly activateUpdate = vi.fn(() => Promise.resolve(true));
}

const version = { hash: 'abc' };

describe('AppUpdateService', () => {
  let sw: FakeSwUpdate;
  let reload: ReturnType<typeof vi.fn>;
  let service: AppUpdateService;

  function setup(enabled = true): void {
    sw = new FakeSwUpdate();
    sw.isEnabled = enabled;
    reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: sw },
        { provide: PAGE_RELOAD, useValue: reload },
      ],
    });
    service = TestBed.inject(AppUpdateService);
  }

  afterEach(() => vi.useRealTimers());

  it('verifica atualizações ao iniciar', () => {
    setup();
    service.start();
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('sinaliza nova versão somente quando ela está pronta', () => {
    setup();
    service.start();
    sw.versionUpdates.next({ type: 'VERSION_DETECTED', version });
    expect(service.updateReady()).toBe(false);
    sw.versionUpdates.next({ type: 'VERSION_READY', currentVersion: version, latestVersion: { hash: 'def' } });
    expect(service.updateReady()).toBe(true);
  });

  it('aplica a atualização e recarrega a página', async () => {
    setup();
    await service.applyUpdate();
    expect(sw.activateUpdate).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('recarrega se o cache ficar irrecuperável', () => {
    setup();
    service.start();
    sw.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'teste' });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('volta a verificar periodicamente', () => {
    vi.useFakeTimers();
    setup();
    service.start();
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS * 2);
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(3);
  });

  it('ignora falha de rede ao verificar (modo offline)', async () => {
    setup();
    sw.checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    await expect(service.checkForUpdate()).resolves.toBe(false);
  });

  it('não faz nada sem service worker (desenvolvimento)', () => {
    setup(false);
    service.start();
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
    expect(service.enabled).toBe(false);
  });
});
