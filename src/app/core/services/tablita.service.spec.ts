import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  CURRENT_EDITION,
  PREVIOUS_EDITION,
  loadMetadata,
  loadRecords,
  rawMetadata,
  rawTablitas,
} from '../../../testing/tablita-fixtures';
import type { TablitaRecord } from '../models/tablita.model';
import {
  METADATA_URL,
  RANDOM_INDEX,
  TABLITAS_URL,
  TablitaService,
  cryptoRandomIndex,
} from './tablita.service';

describe('TablitaService', () => {
  let service: TablitaService;
  let http: HttpTestingController;
  let nextIndex: (max: number) => number;

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RANDOM_INDEX, useValue: (max: number) => nextIndex(max) },
      ],
    });
    service = TestBed.inject(TablitaService);
    http = TestBed.inject(HttpTestingController);
  }

  async function loadReal(): Promise<void> {
    const done = service.load();
    http.expectOne(TABLITAS_URL).flush(rawTablitas);
    http.expectOne(METADATA_URL).flush(rawMetadata);
    await done;
  }

  beforeEach(() => {
    localStorage.clear();
    nextIndex = () => 0;
    setup();
  });

  afterEach(() => http.verify());

  it('carrega os registros locais e seleciona a edição padrão', async () => {
    expect(service.status()).toBe('idle');
    await loadReal();
    expect(service.status()).toBe('ready');
    expect(service.records().length).toBe(772 + 736);
    expect(service.edition()?.id).toBe(CURRENT_EDITION);
    expect(service.editionRecords().length).toBe(772);
  });

  it('considera elegíveis apenas os registros verificados', async () => {
    await loadReal();
    expect(service.eligible().length).toBe(771);
    expect(service.eligible().every((r) => r.status === 'VALID' && r.verified)).toBe(true);
    expect(service.eligible().some((r) => r.code === 'II-1')).toBe(false);
    expect(service.validation()?.excluded.map((e) => e.id).sort()).toEqual(['BR2017-II-01', 'BR2024-II-01']);
  });

  it('conta as posições disponíveis por categoria', async () => {
    await loadReal();
    expect(service.countsByCategory()).toEqual({ MOVES: 361, POSITIONS: 410 });
  });

  it('sorteia o registro do índice devolvido pela fonte aleatória e monta o tabuleiro', async () => {
    await loadReal();
    const pool = service.eligible();
    nextIndex = (max) => {
      expect(max).toBe(771);
      return 42;
    };
    const drawn = service.generate();
    expect(drawn?.record).toBe(pool[42]);
    expect(drawn?.result.ok).toBe(true);
    expect(service.current()).toBe(drawn);
  });

  it('com a fonte aleatória real, só sorteia registros elegíveis e cobre as duas categorias', async () => {
    nextIndex = cryptoRandomIndex;
    await loadReal();
    const eligible = new Set(service.eligible().map((r) => r.id));
    const seen = new Set<string>();
    const categories = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const drawn = service.generate();
      expect(drawn).not.toBeNull();
      if (!drawn) continue;
      expect(eligible.has(drawn.record.id)).toBe(true);
      seen.add(drawn.record.id);
      categories.add(drawn.record.category ?? '');
    }
    expect(categories).toEqual(new Set(['MOVES', 'POSITIONS']));
    // 3000 sorteios uniformes sobre 771 registros cobrem ~98% deles.
    expect(seen.size).toBeGreaterThan(700);
  });

  it('cryptoRandomIndex devolve inteiros no intervalo e rejeita limites inválidos', () => {
    for (let i = 0; i < 1000; i++) {
      const v = cryptoRandomIndex(7);
      expect(Number.isInteger(v) && v >= 0 && v < 7).toBe(true);
    }
    expect(() => cryptoRandomIndex(0)).toThrow(RangeError);
  });

  it('troca de edição, limpa o sorteio atual e lembra a escolha', async () => {
    await loadReal();
    service.generate();
    service.selectEdition(PREVIOUS_EDITION);
    expect(service.current()).toBeNull();
    expect(service.eligible().length).toBe(735);
    expect(localStorage.getItem('gerador-tablita.edition')).toBe(PREVIOUS_EDITION);
  });

  it('não informa Tábua do CODEX enquanto o mapeamento está pendente', async () => {
    await loadReal();
    const drawn = service.generate();
    expect(drawn && service.codexTabuaName(drawn.record)).toBeNull();
  });

  it('valida: rejeita identificadores duplicados', () => {
    const records = loadRecords();
    const duplicated: TablitaRecord[] = [...records, records[0]];
    expect(() => service.validate(duplicated, loadMetadata())).toThrow(/duplicado/);
  });

  it('valida: exclui registro marcado como válido mas não executável', () => {
    const records = loadRecords();
    const broken: TablitaRecord = { ...records[0], notation: 'ab5', notationNormalized: 'ab5' };
    const report = service.validate([broken, ...records.slice(1)], loadMetadata());
    expect(report.excluded.some((e) => e.id === broken.id)).toBe(true);
  });

  it('entra em estado de erro quando os dados não podem ser carregados', async () => {
    const done = service.load();
    http.expectOne(TABLITAS_URL).flush('falha', { status: 404, statusText: 'Not Found' });
    http.expectOne(METADATA_URL).flush(rawMetadata);
    await done;
    expect(service.status()).toBe('error');
    expect(service.error()).toBeTruthy();
    expect(service.generate()).toBeNull();
  });
});
