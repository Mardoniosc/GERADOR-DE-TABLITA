# Relatório de auditoria – Tablitas oficiais (Damas Brasileiras, 64 casas)

- **Data da consulta às fontes:** 2026-11-12
- **Gerado por:** `npm run import:tablitas` (scripts/import-tablitas.ts)
- **Validação:** cada entrada foi interpretada pelo motor de regras (`src/app/core/engine/draughts-engine.ts`): lances legais, captura obrigatória, lei da maioria e damas voadoras.

## 1. Fontes

| Fonte | Situação em 2026-11-12 | Uso |
|---|---|---|
| CODEX – https://ratingdamas.org/codex | Inacessível: domínio expirado (página de domínio expirado da Hostinger; HTTPS com erro de TLS) | Texto obtido no espelho https://damasciencias.com.br/codex/ |
| CODEX PDF – https://ratingdamas.org/assets/pdf/CODEX_2020.pdf | Inacessível (mesmo domínio) | Cópia no Internet Archive existe (snapshot 2026-07-16), mas web.archive.org não pôde ser acessado deste ambiente |
| Tablita – https://ratingdamas.org/tablita | Inacessível (mesmo domínio) | O snapshot de 2026-05-13 no Internet Archive também não pôde ser acessado |
| DamPlay – https://damplay.com/damas/ | Domínio estacionado (página da Hostinger, sem conteúdo) | Nenhum |
| **IDF – Tables of draw** – https://idf64.org/tables-of-draw/ | Acessível | **Fonte primária das posições** |
| CBJD – Regras Oficiais (PDF) | Acessível | Regras de movimentação, captura e orientação do tabuleiro |

A International Draughts Federation (IDF, Section 64) publica as tabelas oficiais de sorteio do jogo de 64 casas, incluindo versões específicas para as Damas Brasileiras. Arquivos originais e extrações estão em `data-sources/`.

### CODEX, artigos 85 e 86

> Artigo 85 – A tablita utilizada nas competições organizadas e realizadas no Brasil conterá três tábuas de lances, sendo: a) Tábua A – lances de sorteio convencional. b) Tábua B – lances de sorteio voadores. c) Tábua C – lances denominados promotions.
>
> Artigo 86 – Fica a critério de cada organização utilizar uma, duas ou as três tábuas juntas, desde que, tal decisão seja informada em regulamento da competição ou antes do início da competição em congresso técnico.

O CODEX **não contém** as listas de lances das tábuas.

## 2. Edições encontradas

| Edição | Aprovação | Situação | Casas na grade | Retiradas (`***`) | Registros | Lances | Posições | Verificados | Pendentes | Inválidos |
|---|---|---|---|---|---|---|---|---|---|---|
| IDF 2024 · 772 posições (vigente) | Aprovada pela diretoria da IDF em 16/12/2023; válida a partir de 01/01/2024 | Vigente para competições oficiais da IDF desde 01/01/2024. | 780 | 8 | 772 | 361 | 410 | 771 | 1 | 0 |
| IDF 2017 · "745" (inativa) | Aprovada pela diretoria da IDF em 20/09/2017 | Inativa: a IDF informa que não deve ser usada em competições oficiais a partir de 01/01/2024. | 745 | 9 | 736 | 342 | 393 | 735 | 1 | 0 |

### 2.1 Sobre o número 745

- A tabela geral da IDF de 2017 (`Table_of_draw_745-03.07.2017`, damas russas) tem **745** posições.
- A versão brasileira de 2017 (`Table_of_draw_745Braz-20.09.2017`) reutiliza a mesma grade de 745 casas, mas marca **9** com `***` ("New draw": posição retirada; se sorteada, sorteia-se de novo).
- Logo, o número 745 corresponde ao total de casas da grade herdada da tabela geral. A edição brasileira de 2017 tem **736** posições efetivamente sorteáveis.
- A edição vigente (2024) declara 772 posições: 780 casas na grade, 8 retiradas e **772** registros, o que confere com o título do documento.

Casas retiradas na edição de 2017 e o que a tabela geral de 2017 traz na mesma casa:

| Casa | Tabela geral 2017 (mesma casa) |
|---|---|
| I-17 | `ab4 ba5 ed4 dc5 bd6 ce5` |
| XI-18 | `cd4 ba5 gf4 fe5 df6 eg5` |
| XIII-3 | `cd4 dc5 bc3 cd6 ab2 de5` |
| XIV-22 | `c3-f4 h8-h4` |
| XV-12 | `cd4 fg5 gf4 gf6 bc3 hg7` |
| XV-16 | `cd4 fg5 gh4 dc5 hf6 eg5` |
| XV-18 | `cd4 fg5 gh4 gf4` |
| XXIII-20 | `gf4 ba5 cd4 fe5 df6 eg5` |
| XXVI-5 | `f2-f4 h8-e5` |

Casas retiradas na edição de 2024: I-21, XI-14, XI-22, XIV-6, XV-3, XV-7, XV-9, XXIV-5.

## 3. Notação

- **Lances** (`ab4 ba5 ed4`): cada lance indica a coluna de origem e a casa de destino. As brancas jogam o 1º lance e as cores se alternam. A casa de origem é identificada entre os lances legais da posição. Capturas são escritas da mesma forma (ex.: `bd6`, de b4 tomando c5).
- **Posições** (`a3-a5 f6-g5`): o primeiro termo desloca uma pedra branca e o segundo uma preta. `---` = sem deslocamento. As duas pedras são retiradas e depois recolocadas; as brancas iniciam a partida, como no exemplo do blog worldamas: "retirará a peça branca de a3 e a colocará em a5".
- Tabuleiro: casa a1 escura no canto inferior esquerdo das brancas (grande diagonal à esquerda de cada jogador, conforme as Regras Oficiais da CBJD).

## 4. Integridade

### IDF 2024 · 772 posições (vigente)

- Registros: 772 (lances: 361; posições: 410; não classificados: 1).
- Células vazias na grade (fora da tabela): 0.
- Identificadores duplicados: 0.
- Notações duplicadas: 1 → XXI-26 = XXIII-4.
- Posições resultantes idênticas (mesma posição e mesmo lado a jogar) com notações diferentes: 2 → XIX-14 (`ed4 fg5 gh4 gf6`) = XIX-20 (`ed4 hg5 gh4 gh6`); XXI-26 (`gf4 ba5 cb4 ac3 bd4 fg5`) = XXIII-4 (`gf4 ba5 cb4 ac3 bd4 fg5`).
- Conferência com o PDF oficial (texto extraído com pdftotext): 772/772 notações encontradas literalmente.
- Lances por sequência: 1 lance(s): 7; 2 lance(s): 33; 3 lance(s): 19; 4 lance(s): 107; 5 lance(s): 70; 6 lance(s): 125.
- Sequências com captura: 72.

**Registros inválidos ou pendentes de confirmação:**

| Código | Notação original | Situação | Observação |
|---|---|---|---|
| II-1 | `"a1-a5"` | PENDING | Notação "a1-a5" não corresponde a nenhum formato reconhecido. Formato fora do padrão do documento; não foi completado por inferência. Requer confirmação da IDF. |

### IDF 2017 · "745" (inativa)

- Registros: 736 (lances: 342; posições: 393; não classificados: 1).
- Células vazias na grade (fora da tabela): 14.
- Identificadores duplicados: 0.
- Notações duplicadas: 0.
- Posições resultantes idênticas (mesma posição e mesmo lado a jogar) com notações diferentes: 2 → I-13 (`ab4 ba5 ed4 ab6 fe3 dc5`) = XVII-8 (`ed4 ba5 fe3 ab6 ab4 dc5`); XXI-5 (`ed4 fg5 gh4 gf6`) = XXI-11 (`ed4 hg5 gh4 gh6`).
- Conferência com o PDF oficial (texto extraído com pdftotext): 734/736 notações encontradas literalmente; não localizadas por quebra de layout: XXXI-1, XXXI-2.
- Lances por sequência: 1 lance(s): 7; 2 lance(s): 33; 3 lance(s): 17; 4 lance(s): 104; 5 lance(s): 64; 6 lance(s): 117.
- Sequências com captura: 65.

**Registros inválidos ou pendentes de confirmação:**

| Código | Notação original | Situação | Observação |
|---|---|---|---|
| II-1 | `"a1-a5 "` | PENDING | Notação "a1-a5" não corresponde a nenhum formato reconhecido. Formato fora do padrão do documento; não foi completado por inferência. Requer confirmação da IDF. |

## 5. Comparação entre edições (por notação)

- Em comum: 720.
- Presentes só em 2024: 52.
- Presentes só em 2017: 17.

<details><summary>Lista</summary>

Só em 2024: I-6 `ab4 ba5 ba3 ab6 gf4 de5`; I-8 `ab4 ba5 ba3 cb6 ef4 bc7`; I-9 `ab4 ba5 ba3 cb6 ef4 fg5`; I-14 `ab4 ba5 ed4 ab6 de3 dc5`; I-19 `ab4 ba5 ed4 cb6`; I-24 `ab4 ba5 ed4 de5 gh4 ef4`; II-5 `a1-a5 d6-e5`; II-7 `a1-a5 g7-b4`; II-11 `a1-a5 h8-g5`; II-16 `a1-b4 d6-c5`; III-10 `ab4 bc5 ba5 fg5 ef4`; III-25 `ab4 fe5 bc5 db4`; IV-24 `a3-d4 h6-g5`; V-20 `cb4 ba5 ef4 ac3 bd4`; V-21 `cb4 ba5 gh4`; VI-2 `a3-e5 g7-h4`; VI-7 `a3-f4 f6-e5`; VI-22 `a3-h4 d6-e5`; VII-14 `cb4 de5 ba5 fg5`; VIII-18 `b2-a5 h6-g5`; IX-10 `cb4 fg5 ed4 gh4`; X-22 `c1-a5 a7-e5`; X-24 `c1-c5 b6-e5`; X-25 `c1-d4 b6-c5`; X-26 `c1-d4 h6-g5`; XII-1 `c1-f4 d6-e5`; XII-2 `c1-f4 b8-h4`; XIII-15 `cd4 fe5 df6 ge5 ed4`; XV-12 `cd4 hg5 bc3 gf4 eg5`; XVII-18 `ed4 dc5 fe3 hg5 ef4`; XVIII-14 `e1-a5 f8-c5`; XVIII-15 `e1-b4 d6-c5`; XVIII-16 `e1-d4 b6-c5`; XVIII-17 `e1-d4 c7-e5`; XVIII-18 `e1-d4 e7-e5`; XIX-24 `ef4 ba5 fe3`; XX-20 `e3-d4 f8-c5`; XX-23 `e3-f4 b8-g5`; XXI-20 `ef4 fg5 fe5 df4 ge5 gh4`; XXI-21 `ef4 fg5 fe3 gh4 ef2 de5`; XXII-1 `e3-f4 h8-g5`; XXIII-3 `gf4 ba5 cb4 ac3 bd4 de5`; XXIV-15 `g1-b4 d6-e5`; XXIV-20 `g1-e5 g7-a5`; XXIV-21 `g1-f4 d6-c5`; XXIV-22 `g1-f4 d6-e5`; XXIV-23 `g1-f4 h8-a5`; XXV-2 `gf4 fe5 hg3 ef6 cd4`; XXV-12 `gh4 ba5 fg3 fe5 ed4 ef4`; XXVI-3 `g1-h4 h6-g5`; XXX-23 `--- h6-f4`; XXX-25 `--- h8-g5`

Só em 2017: I-5 `ab4 ba5 ba3 ab6 ab2 de5`; II-20 `a1-d4 f6-e5`; II-21 `a1-d4 h8-e5`; II-22 `a1-d4 h6-g5`; II-23 `a1-c5 g7-g5`; IV-1 `a1-e5 d6-g5`; IV-2 `a1-e5 g7-h4`; IV-3 `a1-f4 a7-c5`; IV-4 `a1-f4 b6-c5`; IV-5 `a1-f4 c7-a5`; IV-6 `a1-f4 d6-c5`; IV-7 `a1-f4 e7-e5`; IV-8 `a1-f4 f6-e5`; IV-9 `a1-g5 d6-e5`; XVII-8 `ed4 ba5 fe3 ab6 ab4 dc5`; XXIX-5 `gh4 de5 hg3 cd6`; XXXIII-5 `h2-h4 d6-h2`

</details>

## 6. Pendências e divergências

1. **Mapeamento Tábua A/B/C (CODEX) → entradas da IDF: pendente.** Nenhuma fonte acessível relaciona as tábuas do CODEX às entradas da tabela. O site aprendadamas.com.br chama a tabela de 772 de "Tablitas e Promotions", o que não basta para definir as três tábuas. Por isso todos os registros têm `codexTabua: null` e o app mostra o tipo estrutural (lances / posição). Para confirmar, preencha `codexMapping.byCategory` (ou `codexTabua` por registro, se o mapeamento não for por tipo) em `scripts/import-tablitas.ts` e rode `npm run import:tablitas`.
2. **Número oficial brasileiro: divergência entre 745 e 772.** A referência secundária (ratingdamas) fala em 745. A IDF considera inativa a tabela "745Braz" (736 posições efetivas) e vigente a tabela de 772 desde 01/01/2024. As duas edições foram importadas, sem escolher uma por inferência. O app abre na edição vigente da IDF e permite trocar de edição. Falta confirmar qual edição a CBD adota.
3. **Casa II-1 (`a1-a5`)**: a mesma forma aparece nas três tabelas da IDF (2017 geral, 2017 Brasil e 2024). Falta o segundo termo, que seria `---` no padrão do documento. O registro ficou como PENDENTE e fora do sorteio.
4. **Numeração 1–32**: as tabelas oficiais usam notação algébrica. A numeração exibida (b8 = 1 … g1 = 32) é convenção de exibição e não participa da interpretação.
5. **ratingdamas.org e damplay.com** estavam fora do ar na data da consulta. Assim que voltarem, vale conferir a página /tablita com este relatório.

## 7. Amostras verificadas manualmente

- **I-2** `ab4 ba5` → a3-b4, b6-a5; joga: brancas.
- **III-4** `ab4 bc5 ba5 cb4` → a3-b4, b6-c5, b4-a5, c5-b4; joga: brancas.
- **II-2** `a1-a5 a7-h4` → a1→a5, a7→h4; joga: brancas.
- **IV-1** `a3-a5 f6-a3` → a3→a5, f6→a3; joga: brancas.

Posição inicial do motor: 12 brancas (a1, c1, e1, g1, …) e 12 pretas; a casa a1 (a1) é escura.
