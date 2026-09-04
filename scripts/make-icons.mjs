/**
 * Renders the PWA PNG icons from the same shapes as public/icon.svg.
 * Hand-rolled so the project needs no image toolchain: rasterise a few
 * rounded rects and circles into RGBA, then deflate into a PNG.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const BG = [0x0d, 0x0f, 0x18];
const A = [0x8b, 0x5c, 0xf6];
const B = [0x38, 0xbd, 0xf8];

const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function roundedRectAlpha(x, y, w, h, r, px, py) {
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const d = Math.hypot(px - cx, py - cy);
  return d <= r ? 1 : Math.max(0, 1 - (d - r));
}

function circleAlpha(cx, cy, r, px, py) {
  const d = Math.hypot(px - cx, py - cy);
  return d <= r ? 1 : Math.max(0, 1 - (d - r));
}

function render(size) {
  const s = size / 512;
  const pips = [
    [196, 196],
    [316, 196],
    [256, 256],
    [196, 316],
    [316, 316],
  ].map(([x, y]) => [x * s, y * s]);
  const pipR = 30 * s;

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(size * 4 + 1);
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let color = BG;

      const face = roundedRectAlpha(96 * s, 96 * s, 320 * s, 320 * s, 72 * s, px, py);
      if (face > 0) {
        const grad = lerp(A, B, (px + py) / (2 * size));
        color = lerp(BG, grad, face);
        let pip = 0;
        for (const [cx, cy] of pips) pip = Math.max(pip, circleAlpha(cx, cy, pipR, px, py));
        if (pip > 0) color = lerp(color, BG, pip);
      }

      const outer = roundedRectAlpha(0, 0, size, size, 112 * s, px, py);
      const o = 1 + x * 4;
      row[o] = color[0];
      row[o + 1] = color[1];
      row[o + 2] = color[2];
      row[o + 3] = Math.round(255 * outer);
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(render(size), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = join(process.cwd(), "public");
for (const size of [192, 512]) {
  writeFileSync(join(out, `icon-${size}.png`), png(size));
  console.log(`wrote public/icon-${size}.png`);
}
