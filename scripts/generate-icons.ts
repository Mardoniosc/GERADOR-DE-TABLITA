/**
 * Gera os ícones PWA (PNG) sem dependências: desenho vetorial simples com
 * supersampling e codificação PNG via zlib.
 *
 *   npm run icons
 *
 * O desenho ocupa a "safe zone" central, então serve como ícone "maskable".
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

type RGBA = readonly [number, number, number, number];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');
const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const SS = 4; // supersampling per axis

const hex = (h: string, a = 1): RGBA => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
  a,
];
const mix = (a: RGBA, b: RGBA, t: number): RGBA => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
  a[3] + (b[3] - a[3]) * t,
];

const BG = hex('#16181b');
const FRAME = hex('#4a2f1b');
const LIGHT = hex('#e9d3ac');
const DARK = hex('#9c6a40');
const WHITE_HI = hex('#fffdf7');
const WHITE_LO = hex('#cbbd9f');
const WHITE_EDGE = hex('#a39377');
const BLACK_HI = hex('#5a5450');
const BLACK_LO = hex('#121010');
const BLACK_EDGE = hex('#050404');
const GOLD = hex('#e8b84f');

const BOARD0 = 0.16;
const BOARD1 = 0.84;
const INNER0 = 0.2;
const INNER1 = 0.8;
const CELL = (INNER1 - INNER0) / 4;

function piece(u: number, v: number, cx: number, cy: number, hi: RGBA, lo: RGBA, edge: RGBA): RGBA | null {
  const r = CELL * 0.42;
  const depth = CELL * 0.09;
  const d = Math.hypot(u - cx, v - cy);
  if (d <= r) {
    const g = Math.min(1, Math.hypot(u - (cx - r * 0.35), v - (cy - r * 0.4)) / (r * 1.5));
    const base = mix(hi, lo, g);
    // Inner ring.
    if (Math.abs(d - r * 0.68) < r * 0.045) return mix(base, edge, 0.35);
    return base;
  }
  if (Math.hypot(u - cx, v - (cy + depth)) <= r) return edge;
  return null;
}

function crown(u: number, v: number, cx: number, cy: number): boolean {
  const w = CELL * 0.36;
  const x = (u - cx) / w; // -1..1
  const y = (v - cy) / w;
  if (x < -0.9 || x > 0.9 || y < -0.55 || y > 0.55) return false;
  if (y > 0.35) return y < 0.55; // base band
  // Three spikes: top edge is a zig-zag between peaks at x = -0.9, 0, 0.9.
  const peak = Math.abs(x) < 0.45 ? Math.abs(x) / 0.45 : (0.9 - Math.abs(x)) / 0.45;
  return y > -0.55 + peak * 0.55 && y < 0.25;
}

function sample(u: number, v: number): RGBA {
  if (u < BOARD0 || u > BOARD1 || v < BOARD0 || v > BOARD1) return BG;
  if (u < INNER0 || u > INNER1 || v < INNER0 || v > INNER1) return FRAME;
  const col = Math.min(3, Math.floor((u - INNER0) / CELL));
  const row = Math.min(3, Math.floor((v - INNER0) / CELL));
  const cx = (c: number): number => INNER0 + CELL * (c + 0.5);
  const black = piece(u, v, cx(2), cx(1), BLACK_HI, BLACK_LO, BLACK_EDGE);
  if (black) return crown(u, v, cx(2), cx(1)) ? GOLD : black;
  const white = piece(u, v, cx(1), cx(2), WHITE_HI, WHITE_LO, WHITE_EDGE);
  if (white) return white;
  return (row + col) % 2 === 1 ? DARK : LIGHT;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function render(size: number): Buffer {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          r += c[0] * c[3];
          g += c[1] * c[3];
          b += c[2] * c[3];
          a += c[3];
        }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(OUT, `icon-${size}x${size}.png`), render(size));
}
writeFileSync(join(ROOT, 'public', 'favicon.png'), render(48));
console.log(`Ícones gerados em public/icons (${SIZES.join(', ')}) e public/favicon.png`);
