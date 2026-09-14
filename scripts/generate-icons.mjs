// Rasterizes the Mintten mark (dark rounded square + mint leaf) into the
// raster icons the SVG favicon can't cover: favicon.ico and a real
// apple-touch-icon.png for iOS home screens.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { argv } from "node:process";

/** Output directory — defaults to the repo's own public/. */
const OUT = argv[2] ?? fileURLToPath(new URL("../public", import.meta.url));

// Brand colours, matching --gradient-brand in src/styles.css.
const BG_TOP = [0x11, 0x26, 0x21];
const BG_BOT = [0x00, 0x57, 0x3e];
const LEAF = [0x5f, 0xdf, 0xb4];

/** Coverage of a rounded square, 0..1, with a soft 1px edge. */
function squareCoverage(x, y, size) {
  const r = size * 0.22;
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  const d = Math.hypot(x - cx, y - cy);
  return Math.min(Math.max(r - d + 0.5, 0), 1);
}

/**
 * The leaf as a vesica — the lens where two equal circles overlap — which
 * gives the same pointed-at-both-ends silhouette as the logo's leaf, and is
 * a pure distance test so it needs no path rasterizer. Rotated 38 degrees to
 * match the tilt of the drawn mark, with the midrib cut back out of it.
 */
function leafCoverage(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const a = (-38 * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  // Into the leaf's own upright frame.
  const u = dx * Math.cos(a) - dy * Math.sin(a);
  const v = dx * Math.sin(a) + dy * Math.cos(a);

  const half = size * 0.3; // half the leaf's length
  const R = size * 0.42; // circle radius: bigger = narrower leaf
  const off = Math.sqrt(R * R - half * half); // centres sit off to each side
  const dLeft = Math.hypot(u + off, v) - R;
  const dRight = Math.hypot(u - off, v) - R;
  const outside = Math.max(dLeft, dRight); // <0 inside both circles
  let cov = Math.min(Math.max(-outside + 0.5, 0), 1);

  // Midrib: a thin slit down the lower half, as in the SVG mark.
  if (v > -half * 0.2) {
    const rib = Math.min(Math.max(Math.abs(u) - size * 0.022 + 0.5, 0), 1);
    cov = Math.min(cov, rib);
  }
  return cov;
}

/** RGBA pixel rows for one square icon of the given size. */
function render(size) {
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = x + 0.5;
      const sy = y + 0.5;
      const sq = squareCoverage(sx, sy, size);
      const t = sy / size;
      const bg = [0, 1, 2].map((i) => Math.round(BG_TOP[i] + (BG_BOT[i] - BG_TOP[i]) * t));
      const leaf = leafCoverage(sx, sy, size);
      const rgb = [0, 1, 2].map((i) => Math.round(bg[i] + (LEAF[i] - bg[i]) * leaf));
      const o = (y * size + x) * 4;
      px[o] = rgb[0];
      px[o + 1] = rgb[1];
      px[o + 2] = rgb[2];
      px[o + 3] = Math.round(sq * 255);
    }
  }
  return px;
}

/* ── PNG ──────────────────────────────────────────────────────────────── */
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
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // Each scanline is prefixed with filter type 0 (none).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── ICO (PNG-compressed entries, supported since IE11/Vista) ─────────── */
function ico(sizes) {
  const images = sizes.map((s) => png(s, render(s)));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const dir = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s >= 256 ? 0 : s; // width  (0 means 256)
    e[1] = s >= 256 ? 0 : s; // height
    e[2] = 0; // palette
    e[3] = 0;
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(images[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return e;
  });
  return Buffer.concat([header, ...dir, ...images]);
}

writeFileSync(`${OUT}/favicon.ico`, ico([16, 32, 48]));
writeFileSync(`${OUT}/apple-touch-icon.png`, png(180, render(180)));
writeFileSync(`${OUT}/icon-192.png`, png(192, render(192)));
writeFileSync(`${OUT}/icon-512.png`, png(512, render(512)));
console.log("wrote favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png");
