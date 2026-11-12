import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { rawMetadata, rawTablitas } from '../../../../../testing/tablita-fixtures';
import { METADATA_URL, RANDOM_INDEX, TABLITAS_URL, TablitaService } from '../../../../core/services/tablita.service';
import { TablitaGeneratorComponent } from './tablita-generator.component';

describe('TablitaGeneratorComponent', () => {
  let fixture: ComponentFixture<TablitaGeneratorComponent>;
  let el: HTMLElement;
  let http: HttpTestingController;
  let nextIndex: number;

  const button = (): HTMLButtonElement => {
    const b = el.querySelector<HTMLButtonElement>('[data-testid="generate"]');
    if (!b) throw new Error('botão GERAR TABLITA ausente');
    return b;
  };
  const text = (id: string): string => el.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() ?? '';

  beforeEach(async () => {
    localStorage.clear();
    nextIndex = 0;
    TestBed.configureTestingModule({
      imports: [TablitaGeneratorComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RANDOM_INDEX, useValue: () => nextIndex },
      ],
    });
    fixture = TestBed.createComponent(TablitaGeneratorComponent);
    el = fixture.nativeElement;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  async function flushData(): Promise<void> {
    http.expectOne(TABLITAS_URL).flush(rawTablitas);
    http.expectOne(METADATA_URL).flush(rawMetadata);
    await TestBed.inject(TablitaService).load();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('mostra título, subtítulo e o tabuleiro na posição inicial', async () => {
    await flushData();
    expect(el.querySelector('h1')?.textContent).toContain('GERADOR DE TABLITA');
    expect(el.textContent).toContain('Damas Brasileiras – 64 Casas');
    expect(el.textContent).toContain('SUA TABLITA');
    expect(el.querySelectorAll('.piece')).toHaveLength(24);
  });

  it('desabilita o botão até os dados carregarem e depois mostra as posições disponíveis', async () => {
    expect(button().disabled).toBe(true);
    await flushData();
    expect(button().disabled).toBe(false);
    expect(button().textContent).toContain('GERAR TABLITA');
    expect(text('available-count')).toContain('771');
  });

  it('GERAR TABLITA exibe código, categoria, notação e a posição sorteada', async () => {
    await flushData();
    nextIndex = 0; // primeiro registro elegível da edição vigente: I-1 "ab4"
    button().click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(text('tablita-code')).toBe('TABLITA I-1');
    expect(text('tablita-category')).toContain('SORTEIO DE LANCES');
    expect(text('tablita-notation')).toBe('ab4');
    expect(el.textContent).toContain('Jogam as pretas');
    expect(el.querySelector('[data-square="b4"] .piece.white')).not.toBeNull();
    expect(el.querySelector('[data-square="a3"] .piece')).toBeNull();
  });

  it('cada clique sorteia novamente sem recarregar a página', async () => {
    await flushData();
    const service = TestBed.inject(TablitaService);
    const target = service.eligible().findIndex((r) => r.notationNormalized === 'a3-a5 f6-a3');
    nextIndex = target;
    button().click();
    fixture.detectChanges();
    expect(text('tablita-code')).toBe('TABLITA IV-1');
    expect(text('tablita-category')).toContain('POSIÇÃO COM PEÇAS DESLOCADAS');
    expect(el.querySelector('[data-square="a3"] .piece.black')).not.toBeNull();

    nextIndex = 0;
    button().click();
    fixture.detectChanges();
    expect(text('tablita-code')).toBe('TABLITA I-1');
  });
});
