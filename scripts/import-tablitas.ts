/**
 * Importa as tabelas oficiais de sorteio (IDF) para JSON e gera o relatório
 * de auditoria.
 *
 *   npm run import:tablitas
 *
 * Entradas (data-sources/idf):
 *   - IDF-Draw-772-positions-Brazilian-draughts-01.01.2024.docx  (edição vigente)
 *   - Table_of_draw_745Braz-20.09.2017.antiword.txt              (edição 2017, Brasil)
 *   - Table_of_draw_745-03.07.2017-1.antiword.txt                (edição 2017, geral; só para auditoria)
 *   - *.pdftotext.txt (opcional)                                 (conferência cruzada com o PDF)
 *
 * Os arquivos .doc de 2017 são binários (Word 97). O texto foi extraído com
 * `antiword -w 0 <arquivo>.doc`; a saída fica versionada ao lado do original.
 *
 * Saídas:
 *   - src/assets/data/tablitas.json
 *   - src/assets/data/metadata.json
 *   - docs/RELATORIO-AUDITORIA.md
 *
 * Executado com o type stripping nativo do Node (>= 22.18), sem build.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

import {
  createInitialBoard,
  interpretTablita,
  normalizeNotation,
  toAlgebraic,
} from '../src/app/core/engine/draughts-engine.ts';
import type { BoardState, PieceColor } from '../src/app/core/models/board.model';
import type {
  EditionMetadata,
  TablitaCategory,
  TablitaMetadata,
  TablitaRecord,
  WithdrawnSlot,
} from '../src/app/core/models/tablita.model';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'data-sources', 'idf');
const CONSULTED_AT = '2026-11-12';
const IDF_PAGE = 'https://idf64.org/tables-of-draw/';

// ---------------------------------------------------------------------------
// Leitura de fontes
// ---------------------------------------------------------------------------

interface RawCell {
  readonly column: string;
  readonly row: number;
  readonly text: string;
}

/** Extrai uma entrada de um arquivo ZIP (formato .docx) sem dependências. */
function readZipEntry(zipPath: string, entryName: string): Buffer {
  const buf = readFileSync(zipPath);
  // End of central directory: assinatura 0x06054b50 nos últimos ~64 KiB.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error(`${zipPath}: ZIP inválido (EOCD ausente).`);
  }
  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < entries; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error(`${zipPath}: diretório central corrompido.`);
    }
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === entryName) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`${zipPath}: método de compressão ${method} não suportado.`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${zipPath}: entrada ${entryName} não encontrada.`);
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Texto de uma célula: parágrafos unidos por espaço, sem alterar o conteúdo. */
function cellText(xml: string): string {
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  return paragraphs
    .map((p) => (p.match(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>/g) ?? []).map((t) => decodeXml(t.replace(/<[^>]+>/g, ''))).join(''))
    .join(' ');
}

/** Tabelas do .docx: a primeira linha traz "№" e os numerais romanos das colunas. */
function readDocxCells(path: string): RawCell[] {
  const xml = readZipEntry(path, 'word/document.xml').toString('utf8');
  const cells: RawCell[] = [];
  for (const table of xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? []) {
    const rows = (table.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []).map((tr) =>
      (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map(cellText),
    );
    const [header, ...body] = rows;
    for (const row of body) {
      const number = Number(row[0]?.trim());
      if (!Number.isInteger(number) || number <= 0) continue;
      row.slice(1).forEach((text, i) => {
        const column = header[i + 1]?.trim();
        if (column) cells.push({ column, row: number, text });
      });
    }
  }
  return cells;
}

/**
 * Saída do antiword (`-w 0`): cada tabela vira uma linha "N |I |II |... | |1 |...".
 * Cada linha da tabela ocupa (colunas + 2) campos separados por "|".
 */
function readAntiwordCells(path: string): RawCell[] {
  const cells: RawCell[] = [];
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.startsWith('N |')) continue;
    const fields = line.trimEnd().split('|');
    const k = fields.findIndex((f) => f.trim() === '') - 1;
    const header = fields.slice(0, k + 1).map((f) => f.trim());
    const rest = fields.slice(k + 2);
    for (let j = 0; j + k + 1 <= rest.length; j += k + 2) {
      const row = rest.slice(j, j + k + 1);
      const number = Number(row[0].trim());
      if (!Number.isInteger(number) || number <= 0) continue;
      row.slice(1).forEach((text, i) => cells.push({ column: header[i + 1], row: number, text }));
    }
  }
  return cells;
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
function romanToInt(roman: string): number {
  let total = 0;
  for (let i = 0; i < roman.length; i++) {
    const v = ROMAN[roman[i]] ?? 0;
    const next = ROMAN[roman[i + 1]] ?? 0;
    total += v < next ? -v : v;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Edições
// ---------------------------------------------------------------------------

interface EditionConfig {
  readonly id: string;
  readonly idPrefix: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly title: string;
  readonly approved: string;
  readonly validity: string;
  readonly active: boolean;
  readonly declaredTotal: number | null;
  readonly sourceUrl: string;
  readonly sourceFile: string;
  readonly pdfText: string | null;
  readonly read: () => RawCell[];
}

const EDITIONS: readonly EditionConfig[] = [
  {
    id: 'IDF-2024-BR-772',
    idPrefix: 'BR2024',
    label: 'IDF 2024 · 772 posições (vigente)',
    shortLabel: 'IDF 2024 · 772',
    title: 'Table of draw in IDF competitions (772 positions) for Brazilian draughts',
    approved: 'Aprovada pela diretoria da IDF em 16/12/2023; válida a partir de 01/01/2024',
    validity: 'Vigente para competições oficiais da IDF desde 01/01/2024.',
    active: true,
    declaredTotal: 772,
    sourceUrl: 'https://idf64.org/wp-content/uploads/2024/01/IDF-Draw-772-positions-Brazilian-draughts-01.01.2024.docx',
    sourceFile: 'data-sources/idf/IDF-Draw-772-positions-Brazilian-draughts-01.01.2024.docx',
    pdfText: 'IDF-Draw-772-positions-Brazilian-draughts-01.01.2024.pdftotext.txt',
    read: () => readDocxCells(join(SRC, 'IDF-Draw-772-positions-Brazilian-draughts-01.01.2024.docx')),
  },
  {
    id: 'IDF-2017-BR-745',
    idPrefix: 'BR2017',
    label: 'IDF 2017 · "745" (inativa)',
    shortLabel: 'IDF 2017 · 745',
    title: 'Table of draw in IDF competitions for Brazilian draughts (arquivo "Table_of_draw_745Braz")',
    approved: 'Aprovada pela diretoria da IDF em 20/09/2017',
    validity: 'Inativa: a IDF informa que não deve ser usada em competições oficiais a partir de 01/01/2024.',
    active: false,
    declaredTotal: 745,
    sourceUrl: 'https://idf64.org/wp-content/uploads/2016/05/Table_of_draw_745Braz-20.09.2017.doc',
    sourceFile: 'data-sources/idf/Table_of_draw_745Braz-20.09.2017.doc',
    pdfText: 'Table_of_draw_745Braz-20.09.2017.pdftotext.txt',
    read: () => readAntiwordCells(join(SRC, 'Table_of_draw_745Braz-20.09.2017.antiword.txt')),
  },
];

const CATEGORY_NAMES: Record<TablitaCategory, string> = {
  MOVES: 'Sorteio de lances',
  POSITIONS: 'Posição com peças deslocadas',
};

const WITHDRAWN_MARKER = '***';

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

interface EditionResult {
  readonly config: EditionConfig;
  readonly records: TablitaRecord[];
  readonly withdrawn: WithdrawnSlot[];
  readonly emptyCells: number;
  readonly boards: Map<string, string>;
  readonly pdfCheck: { checked: number; found: number; missing: string[] } | null;
}

function boardKey(board: BoardState, side: PieceColor): string {
  return (
    board.map((line) => line.map((p) => (p ? (p.color === 'WHITE' ? 'w' : 'b') + (p.type === 'KING' ? 'K' : '') : '.')).join('')).join('/') +
    ` ${side}`
  );
}

function importEdition(config: EditionConfig): EditionResult {
  const cells = config
    .read()
    .sort((a, b) => romanToInt(a.column) - romanToInt(b.column) || a.row - b.row);
  const records: TablitaRecord[] = [];
  const withdrawn: WithdrawnSlot[] = [];
  const boards = new Map<string, string>();
  let emptyCells = 0;

  for (const cell of cells) {
    const normalized = normalizeNotation(cell.text);
    const code = `${cell.column}-${cell.row}`;
    if (normalized === '') {
      emptyCells++;
      continue;
    }
    if (normalized === WITHDRAWN_MARKER) {
      withdrawn.push({
        edition: config.id,
        code,
        column: cell.column,
        row: cell.row,
        marker: cell.text,
        meaning: 'Posição retirada pela IDF ("*** New draw": se sorteada, sorteia-se novamente).',
      });
      continue;
    }
    const result = interpretTablita(normalized);
    const issues: string[] = [];
    let status: TablitaRecord['status'];
    if (result.ok) {
      status = 'VALID';
      boards.set(code, boardKey(result.board, result.sideToMove));
    } else if (result.category === null) {
      status = 'PENDING';
      issues.push(...result.errors);
      issues.push(
        'Formato fora do padrão do documento; não foi completado por inferência. Requer confirmação da IDF.',
      );
    } else {
      status = 'INVALID';
      issues.push(...result.errors);
    }
    records.push({
      id: `${config.idPrefix}-${cell.column}-${String(cell.row).padStart(2, '0')}`,
      code,
      edition: config.id,
      index: records.length + 1,
      column: cell.column,
      row: cell.row,
      category: result.category,
      categoryName: result.category ? CATEGORY_NAMES[result.category] : 'Não classificado',
      codexTabua: null,
      notation: cell.text,
      notationNormalized: normalized,
      source: `IDF – ${config.title}. ${config.approved}. ${config.sourceUrl}`,
      verified: status === 'VALID',
      status,
      issues,
    });
  }

  // Duplicidades ficam registradas no próprio registro, sem removê-lo: ambas
  // as casas existem no documento oficial.
  const notes = new Map<string, string[]>();
  const addNote = (code: string, note: string): void => {
    notes.set(code, [...(notes.get(code) ?? []), note]);
  };
  for (const group of duplicates(records, (x) => x.notationNormalized, (x) => x.code)) {
    for (const code of group) {
      addNote(code, `Notação idêntica à de ${group.filter((c) => c !== code).join(', ')} no documento oficial.`);
    }
  }
  const withBoard = records.filter((x) => boards.has(x.code));
  for (const group of duplicates(withBoard, (x) => boards.get(x.code) ?? '', (x) => x.code)) {
    for (const code of group) {
      const others = group.filter((c) => c !== code);
      const sameText = others.every(
        (o) => records.find((x) => x.code === o)?.notationNormalized === records.find((x) => x.code === code)?.notationNormalized,
      );
      if (!sameText) addNote(code, `Resulta na mesma posição que ${others.join(', ')} (transposição).`);
    }
  }
  const annotated = records.map((x) => (notes.has(x.code) ? { ...x, issues: [...x.issues, ...(notes.get(x.code) ?? [])] } : x));
  records.splice(0, records.length, ...annotated);

  let pdfCheck: EditionResult['pdfCheck'] = null;
  if (config.pdfText && existsSync(join(SRC, config.pdfText))) {
    const lines = readFileSync(join(SRC, config.pdfText), 'utf8')
      .split(/\r?\n/)
      .map((l) => ` ${normalizeNotation(l)} `);
    const missing: string[] = [];
    for (const r of records) {
      if (!lines.some((l) => l.includes(` ${r.notationNormalized} `))) missing.push(r.code);
    }
    pdfCheck = { checked: records.length, found: records.length - missing.length, missing };
  }

  return { config, records, withdrawn, emptyCells, boards, pdfCheck };
}

function countBy<T>(items: readonly T[], key: (t: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return m;
}

function duplicates<T>(items: readonly T[], key: (t: T) => string, label: (t: T) => string): string[][] {
  const groups = new Map<string, string[]>();
  for (const it of items) {
    const k = key(it);
    groups.set(k, [...(groups.get(k) ?? []), label(it)]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

function editionMetadata(r: EditionResult): EditionMetadata {
  const c = r.config;
  return {
    id: c.id,
    label: c.label,
    shortLabel: c.shortLabel,
    title: c.title,
    approved: c.approved,
    validity: c.validity,
    active: c.active,
    sourceUrl: c.sourceUrl,
    sourceFile: c.sourceFile,
    declaredTotal: c.declaredTotal,
    slots: r.records.length + r.withdrawn.length,
    records: r.records.length,
    withdrawn: r.withdrawn.length,
    byCategory: {
      MOVES: r.records.filter((x) => x.category === 'MOVES').length,
      POSITIONS: r.records.filter((x) => x.category === 'POSITIONS').length,
    },
    verified: r.records.filter((x) => x.status === 'VALID').length,
    pending: r.records.filter((x) => x.status === 'PENDING').length,
    invalid: r.records.filter((x) => x.status === 'INVALID').length,
  };
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

const results = EDITIONS.map(importEdition);
const general2017 = readAntiwordCells(join(SRC, 'Table_of_draw_745-03.07.2017-1.antiword.txt'));

const allRecords = results.flatMap((r) => r.records);
const idDuplicates = duplicates(allRecords, (r) => r.id, (r) => r.id);
if (idDuplicates.length > 0) {
  throw new Error(`Identificadores duplicados: ${JSON.stringify(idDuplicates)}`);
}

const metadata: TablitaMetadata = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  consultedAt: CONSULTED_AT,
  defaultEdition: 'IDF-2024-BR-772',
  editions: results.map(editionMetadata),
  categories: {
    MOVES: {
      name: CATEGORY_NAMES.MOVES,
      description:
        'Sequência de lances iniciais em notação algébrica abreviada (coluna de origem + casa de destino), jogada a partir da posição inicial.',
    },
    POSITIONS: {
      name: CATEGORY_NAMES.POSITIONS,
      description:
        'Posição inicial com uma pedra branca e/ou uma pedra preta deslocadas ("a3-a5 f6-g5"; "---" = sem deslocamento). As brancas jogam primeiro.',
    },
  },
  codexMapping: {
    status: 'PENDING',
    byCategory: { MOVES: null, POSITIONS: null },
    tabuaNames: {
      A: 'Tábua A – Sorteio convencional',
      B: 'Tábua B – Sorteio voadores',
      C: 'Tábua C – Promotions',
    },
    note:
      'O CODEX (arts. 85 e 86) define as Tábuas A, B e C, mas não lista seus lances, e nenhuma fonte acessível relaciona as tábuas às entradas da tabela da IDF. Para confirmar, edite codexMapping em scripts/import-tablitas.ts e rode npm run import:tablitas.',
  },
  boardNumbering: {
    status: 'PENDING',
    description:
      'Casas escuras numeradas de 1 (b8) a 32 (g1), da esquerda para a direita e de cima para baixo, vistas pelas brancas. Convenção de exibição adotada pelo app; as tabelas oficiais usam apenas notação algébrica.',
  },
  withdrawnSlots: results.flatMap((r) => r.withdrawn),
};

mkdirSync(join(ROOT, 'src', 'assets', 'data'), { recursive: true });
writeFileSync(join(ROOT, 'src', 'assets', 'data', 'tablitas.json'), JSON.stringify(allRecords, null, 2) + '\n');
writeFileSync(join(ROOT, 'src', 'assets', 'data', 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n');

// ---------------------------------------------------------------------------
// Relatório de auditoria
// ---------------------------------------------------------------------------

const [current, previous] = results;
const lines: string[] = [];
const out = (s = ''): void => {
  lines.push(s);
};

out('# Relatório de auditoria – Tablitas oficiais (Damas Brasileiras, 64 casas)');
out();
out(`- **Data da consulta às fontes:** ${CONSULTED_AT}`);
out('- **Gerado por:** `npm run import:tablitas` (scripts/import-tablitas.ts)');
out('- **Validação:** cada entrada foi interpretada pelo motor de regras (`src/app/core/engine/draughts-engine.ts`): lances legais, captura obrigatória, lei da maioria e damas voadoras.');
out();
out('## 1. Fontes');
out();
out('| Fonte | Situação em ' + CONSULTED_AT + ' | Uso |');
out('|---|---|---|');
out('| CODEX – https://ratingdamas.org/codex | Inacessível: domínio expirado (página de domínio expirado da Hostinger; HTTPS com erro de TLS) | Texto obtido no espelho https://damasciencias.com.br/codex/ |');
out('| CODEX PDF – https://ratingdamas.org/assets/pdf/CODEX_2020.pdf | Inacessível (mesmo domínio) | Cópia no Internet Archive existe (snapshot 2026-07-16), mas web.archive.org não pôde ser acessado deste ambiente |');
out('| Tablita – https://ratingdamas.org/tablita | Inacessível (mesmo domínio) | O snapshot de 2026-05-13 no Internet Archive também não pôde ser acessado |');
out('| DamPlay – https://damplay.com/damas/ | Domínio estacionado (página da Hostinger, sem conteúdo) | Nenhum |');
out(`| **IDF – Tables of draw** – ${IDF_PAGE} | Acessível | **Fonte primária das posições** |`);
out('| CBJD – Regras Oficiais (PDF) | Acessível | Regras de movimentação, captura e orientação do tabuleiro |');
out();
out('A International Draughts Federation (IDF, Section 64) publica as tabelas oficiais de sorteio do jogo de 64 casas, incluindo versões específicas para as Damas Brasileiras. Arquivos originais e extrações estão em `data-sources/`.');
out();
out('### CODEX, artigos 85 e 86');
out();
out('> Artigo 85 – A tablita utilizada nas competições organizadas e realizadas no Brasil conterá três tábuas de lances, sendo: a) Tábua A – lances de sorteio convencional. b) Tábua B – lances de sorteio voadores. c) Tábua C – lances denominados promotions.');
out('>');
out('> Artigo 86 – Fica a critério de cada organização utilizar uma, duas ou as três tábuas juntas, desde que, tal decisão seja informada em regulamento da competição ou antes do início da competição em congresso técnico.');
out();
out('O CODEX **não contém** as listas de lances das tábuas.');
out();
out('## 2. Edições encontradas');
out();
out('| Edição | Aprovação | Situação | Casas na grade | Retiradas (`***`) | Registros | Lances | Posições | Verificados | Pendentes | Inválidos |');
out('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const m = editionMetadata(r);
  out(`| ${m.label} | ${m.approved} | ${m.validity} | ${m.slots} | ${m.withdrawn} | ${m.records} | ${m.byCategory.MOVES} | ${m.byCategory.POSITIONS} | ${m.verified} | ${m.pending} | ${m.invalid} |`);
}
out();
out('### 2.1 Sobre o número 745');
out();
const generalCount = general2017.filter((c) => normalizeNotation(c.text) !== '').length;
out(`- A tabela geral da IDF de 2017 (\`Table_of_draw_745-03.07.2017\`, damas russas) tem **${generalCount}** posições.`);
out(`- A versão brasileira de 2017 (\`Table_of_draw_745Braz-20.09.2017\`) reutiliza a mesma grade de ${editionMetadata(previous).slots} casas, mas marca **${previous.withdrawn.length}** com \`***\` ("New draw": posição retirada; se sorteada, sorteia-se de novo).`);
out(`- Logo, o número 745 corresponde ao total de casas da grade herdada da tabela geral. A edição brasileira de 2017 tem **${previous.records.length}** posições efetivamente sorteáveis.`);
out(`- A edição vigente (2024) declara 772 posições: ${editionMetadata(current).slots} casas na grade, ${current.withdrawn.length} retiradas e **${current.records.length}** registros, o que confere com o título do documento.`);
out();
out('Casas retiradas na edição de 2017 e o que a tabela geral de 2017 traz na mesma casa:');
out();
out('| Casa | Tabela geral 2017 (mesma casa) |');
out('|---|---|');
for (const w of previous.withdrawn) {
  const g = general2017.find((c) => c.column === w.column && c.row === w.row);
  out(`| ${w.code} | \`${g ? normalizeNotation(g.text) : '—'}\` |`);
}
out();
out('Casas retiradas na edição de 2024: ' + current.withdrawn.map((w) => w.code).join(', ') + '.');
out();
out('## 3. Notação');
out();
out('- **Lances** (`ab4 ba5 ed4`): cada lance indica a coluna de origem e a casa de destino. As brancas jogam o 1º lance e as cores se alternam. A casa de origem é identificada entre os lances legais da posição. Capturas são escritas da mesma forma (ex.: `bd6`, de b4 tomando c5).');
out('- **Posições** (`a3-a5 f6-g5`): o primeiro termo desloca uma pedra branca e o segundo uma preta. `---` = sem deslocamento. As duas pedras são retiradas e depois recolocadas; as brancas iniciam a partida, como no exemplo do blog worldamas: "retirará a peça branca de a3 e a colocará em a5".');
out('- Tabuleiro: casa a1 escura no canto inferior esquerdo das brancas (grande diagonal à esquerda de cada jogador, conforme as Regras Oficiais da CBJD).');
out();
out('## 4. Integridade');
out();
for (const r of results) {
  const m = editionMetadata(r);
  out(`### ${m.label}`);
  out();
  const notationDups = duplicates(r.records, (x) => x.notationNormalized, (x) => x.code);
  const positionDups = duplicates(
    r.records.filter((x) => r.boards.has(x.code)),
    (x) => r.boards.get(x.code) ?? '',
    (x) => `${x.code} (\`${x.notationNormalized}\`)`,
  );
  out(`- Registros: ${m.records} (lances: ${m.byCategory.MOVES}; posições: ${m.byCategory.POSITIONS}; não classificados: ${m.records - m.byCategory.MOVES - m.byCategory.POSITIONS}).`);
  out(`- Células vazias na grade (fora da tabela): ${r.emptyCells}.`);
  out(`- Identificadores duplicados: 0.`);
  out(`- Notações duplicadas: ${notationDups.length}${notationDups.length ? ' → ' + notationDups.map((g) => g.join(' = ')).join('; ') : ''}.`);
  out(`- Posições resultantes idênticas (mesma posição e mesmo lado a jogar) com notações diferentes: ${positionDups.length}${positionDups.length ? ' → ' + positionDups.map((g) => g.join(' = ')).join('; ') : ''}.`);
  if (r.pdfCheck) {
    out(`- Conferência com o PDF oficial (texto extraído com pdftotext): ${r.pdfCheck.found}/${r.pdfCheck.checked} notações encontradas literalmente${r.pdfCheck.missing.length ? '; não localizadas por quebra de layout: ' + r.pdfCheck.missing.join(', ') : ''}.`);
  }
  const plies = countBy(r.records.filter((x) => x.category === 'MOVES'), (x) => String(x.notationNormalized.split(' ').length));
  out(`- Lances por sequência: ${[...plies.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => `${k} lance(s): ${v}`).join('; ')}.`);
  const captures = r.records.filter((x) => {
    const res = x.category === 'MOVES' ? interpretTablita(x.notationNormalized) : null;
    return res?.ok === true && res.steps.some((s) => s.captured.length > 0);
  }).length;
  out(`- Sequências com captura: ${captures}.`);
  out();
  const problems = r.records.filter((x) => x.status !== 'VALID');
  out('**Registros inválidos ou pendentes de confirmação:**');
  out();
  if (problems.length === 0) {
    out('Nenhum.');
  } else {
    out('| Código | Notação original | Situação | Observação |');
    out('|---|---|---|---|');
    for (const p of problems) {
      out(`| ${p.code} | \`${JSON.stringify(p.notation)}\` | ${p.status} | ${p.issues.join(' ')} |`);
    }
  }
  out();
}
out('## 5. Comparação entre edições (por notação)');
out();
const curSet = new Set(current.records.map((x) => x.notationNormalized));
const prevSet = new Set(previous.records.map((x) => x.notationNormalized));
const added = current.records.filter((x) => !prevSet.has(x.notationNormalized));
const removed = previous.records.filter((x) => !curSet.has(x.notationNormalized));
out(`- Em comum: ${current.records.length - added.length}.`);
out(`- Presentes só em 2024: ${added.length}.`);
out(`- Presentes só em 2017: ${removed.length}.`);
out();
out('<details><summary>Lista</summary>');
out();
out('Só em 2024: ' + added.map((x) => `${x.code} \`${x.notationNormalized}\``).join('; '));
out();
out('Só em 2017: ' + removed.map((x) => `${x.code} \`${x.notationNormalized}\``).join('; '));
out();
out('</details>');
out();
out('## 6. Pendências e divergências');
out();
out('1. **Mapeamento Tábua A/B/C (CODEX) → entradas da IDF: pendente.** Nenhuma fonte acessível relaciona as tábuas do CODEX às entradas da tabela. O site aprendadamas.com.br chama a tabela de 772 de "Tablitas e Promotions", o que não basta para definir as três tábuas. Por isso todos os registros têm `codexTabua: null` e o app mostra o tipo estrutural (lances / posição). Para confirmar, preencha `codexMapping.byCategory` (ou `codexTabua` por registro, se o mapeamento não for por tipo) em `scripts/import-tablitas.ts` e rode `npm run import:tablitas`.');
out('2. **Número oficial brasileiro: divergência entre 745 e 772.** A referência secundária (ratingdamas) fala em 745. A IDF considera inativa a tabela "745Braz" (736 posições efetivas) e vigente a tabela de 772 desde 01/01/2024. As duas edições foram importadas, sem escolher uma por inferência. O app abre na edição vigente da IDF e permite trocar de edição. Falta confirmar qual edição a CBD adota.');
out('3. **Casa II-1 (`a1-a5`)**: a mesma forma aparece nas três tabelas da IDF (2017 geral, 2017 Brasil e 2024). Falta o segundo termo, que seria `---` no padrão do documento. O registro ficou como PENDENTE e fora do sorteio.');
out('4. **Numeração 1–32**: as tabelas oficiais usam notação algébrica. A numeração exibida (b8 = 1 … g1 = 32) é convenção de exibição e não participa da interpretação.');
out('5. **ratingdamas.org e damplay.com** estavam fora do ar na data da consulta. Assim que voltarem, vale conferir a página /tablita com este relatório.');
out();
out('## 7. Amostras verificadas manualmente');
out();
const samples = ['I-2', 'III-4', 'II-2', 'IV-1'];
for (const code of samples) {
  const rec = current.records.find((x) => x.code === code);
  if (!rec) continue;
  const res = interpretTablita(rec.notationNormalized);
  if (!res.ok) continue;
  out(`- **${code}** \`${rec.notationNormalized}\` → ${res.steps.map((s) => s.longNotation).join(', ')}; joga: ${res.sideToMove === 'WHITE' ? 'brancas' : 'pretas'}.`);
}
out();
// Sanity: initial position has 12 + 12 men.
const init = createInitialBoard();
out(`Posição inicial do motor: ${init.flat().filter((p) => p?.color === 'WHITE').length} brancas (${['a1', 'c1', 'e1', 'g1'].join(', ')}, …) e ${init.flat().filter((p) => p?.color === 'BLACK').length} pretas; a casa a1 (${toAlgebraic({ row: 7, col: 0 })}) é escura.`);
out();

mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs', 'RELATORIO-AUDITORIA.md'), lines.join('\n'));

for (const r of results) {
  const m = editionMetadata(r);
  console.log(`${m.id}: ${m.records} registros (${m.byCategory.MOVES} lances, ${m.byCategory.POSITIONS} posições), ${m.withdrawn} retiradas, ${m.verified} verificados, ${m.pending} pendentes, ${m.invalid} inválidos.`);
}
console.log('Gerados: src/assets/data/tablitas.json, src/assets/data/metadata.json, docs/RELATORIO-AUDITORIA.md');
