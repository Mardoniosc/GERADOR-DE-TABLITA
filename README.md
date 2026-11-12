# Gerador de Tablita – Damas Brasileiras (64 casas)

Aplicação web Angular, 100% local e instalável (PWA), que sorteia uma **Tablita oficial** e mostra a posição resultante no tabuleiro.

As posições vêm das **tabelas oficiais de sorteio da IDF** (International Draughts Federation, Seção 64) para Damas Brasileiras. Cada registro foi importado do documento original e executado por um motor de regras próprio antes de entrar no sorteio. Nenhuma posição foi inventada ou completada por inferência.

> Leia o **[relatório de auditoria](docs/RELATORIO-AUDITORIA.md)**: fontes, contagens, duplicidades, pendências e divergências (745 × 772; Tábuas A/B/C).

## Requisitos

- Node.js **22.18 ou superior** (os scripts de importação usam o *type stripping* nativo do Node)
- npm 10+

## Instalação e execução

```bash
npm install
```

```bash
npm start
```

Abra http://localhost:4200.

### Produção

```bash
npm run build
```

O build fica em `dist/gerador-de-tablita/browser`. Ele pode ser publicado em qualquer hospedagem estática com HTTPS. O service worker só funciona em HTTPS ou `localhost`.

Para testar o build, inclusive offline e instalação como app:

```bash
npm run serve:prod
```

Abra http://localhost:8080, aguarde o primeiro carregamento e depois teste sem rede.

### Testes

```bash
npm test
```

São 62 testes em Vitest: motor de regras, interpretação da notação, amostras reais de cada categoria, integridade da coleção, serviço de sorteio, tabuleiro e botão **GERAR TABLITA**.

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Servidor de desenvolvimento |
| `npm run build` | Build de produção com service worker |
| `npm test` | Testes unitários (Vitest), execução única |
| `npm run test:watch` | Testes em modo observação |
| `npm run import:tablitas` | Reimporta as tabelas oficiais de `data-sources/` e regera `tablitas.json`, `metadata.json` e o relatório de auditoria |
| `npm run serve:prod` | Serve o build de produção em http://localhost:8080 |
| `npm run icons` | Regera os ícones PWA |

## Dados

| Arquivo | Conteúdo |
|---|---|
| `src/assets/data/tablitas.json` | 1508 registros: 772 da edição vigente (IDF 2024) + 736 da edição 2017 ("745") |
| `src/assets/data/metadata.json` | Edições, contagens, casas retiradas (`***`), categorias, mapeamento CODEX (pendente) |
| `data-sources/idf/` | Documentos originais da IDF (DOCX/DOC/PDF) e extrações de texto usadas na importação |
| `data-sources/codex/` | Regras CBJD e trecho do CODEX (arts. 85, 86 e 94) |
| `docs/RELATORIO-AUDITORIA.md` | Relatório gerado pelo importador |

Exemplo de registro:

```json
{
  "id": "BR2024-XVII-09",
  "code": "XVII-9",
  "edition": "IDF-2024-BR-772",
  "category": "MOVES",
  "categoryName": "Sorteio de lances",
  "codexTabua": null,
  "notation": "ed4 bc5 db6 ca5 ab4 ab6",
  "source": "IDF – Table of draw in IDF competitions (772 positions) for Brazilian draughts…",
  "verified": true,
  "status": "VALID"
}
```

- `code` é a localização na tabela oficial: coluna em algarismos romanos + linha.
- `notation` preserva o texto da célula exatamente como está no documento.
- Só entram no sorteio registros `VALID` que o app também valida novamente ao carregar.

### Duas categorias estruturais

As tabelas da IDF têm dois tipos de entrada:

- **Sorteio de lances** (`MOVES`): `ab4 ba5 ed4` = coluna de origem + casa de destino, alternando brancas e pretas a partir da posição inicial. Capturas seguem a mesma forma (`db6` = d4 tomando c5).
- **Posição com peças deslocadas** (`POSITIONS`): `a3-a5 f6-g5` = desloca uma pedra branca e uma preta. `---` significa sem deslocamento. As brancas iniciam.

### Pendências (não resolvidas por inferência)

1. **Tábuas A/B/C do CODEX.** O CODEX (art. 85) cria as três tábuas, mas não lista seus lances, e nenhuma fonte acessível as relaciona às entradas da IDF. Por isso `codexTabua` é `null` e o app mostra "Tábua CODEX a confirmar". Quando houver confirmação documental, preencha `codexMapping.byCategory` em `scripts/import-tablitas.ts` (ou `codexTabua` por registro), mude o status para `CONFIRMED` e rode `npm run import:tablitas`. O app passa a exibir, por exemplo, "TÁBUA A – SORTEIO CONVENCIONAL".
2. **745 × 772.** A edição brasileira de 2017 ("745") está inativa na IDF desde 01/01/2024 e tem 736 posições efetivas. A vigente tem 772. As duas foram importadas e podem ser trocadas no app; a padrão é a vigente.
3. **Casa II-1 (`a1-a5`).** A notação está incompleta nos documentos oficiais. O registro ficou pendente e fora do sorteio.
4. **Numeração 1–32.** É convenção de exibição (b8 = 1 … g1 = 32). As tabelas usam notação algébrica.

## Arquitetura

```
src/app/
  core/
    engine/draughts-engine.ts       Regras das Damas Brasileiras + notação da Tablita (TS puro, sem Angular)
    models/                         board.model.ts, tablita.model.ts (somente tipos)
    services/
      board.service.ts              Geometria/numeração para apresentação
      tablita-notation.service.ts   Interpreta notação → tabuleiro (usa o motor)
      tablita.service.ts            Carrega, valida e sorteia (signals)
    data/tablitas-integrity.spec.ts Validação automatizada da coleção
  features/generator/components/
    tablita-generator/              Página: cabeçalho, tabuleiro, botão, contador, edição
    tablita-result/                 Código, categoria, notação e lances interpretados
  shared/components/checkers-board/ Tabuleiro 8×8 reutilizável
scripts/                            Importador, gerador de ícones, servidor estático
```

- O motor de regras é um único módulo TypeScript sem dependências. O importador (Node) e o app (Angular) usam o mesmo código, então a lógica de notação não é duplicada.
- O motor implementa captura obrigatória para frente e para trás, lei da maioria, dama voadora, regra turca e promoção só ao terminar o lance na última fileira.
- O sorteio usa `crypto.getRandomValues` com amostragem por rejeição, o que dá distribuição uniforme sobre os registros elegíveis.
- PWA: `ngsw-config.json` faz *prefetch* do app, dos JSON e dos ícones. Depois do primeiro carregamento, o app funciona sem internet.

## Stack

Angular 21 (standalone, signals, zoneless), TypeScript strict, SCSS, Vitest + jsdom, @angular/service-worker.

O arquivo `.npmrc` define `legacy-peer-deps=true` para contornar uma falha do resolvedor de peer dependencies do npm 10 (`Cannot read properties of null (reading 'edgesOut')`) com os pacotes do Angular 21.
