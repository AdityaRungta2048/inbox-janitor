// Generate minimal valid PNG icons for the extension.
// These are placeholder icons — replace with branded assets before publishing.
// Uses raw PNG binary encoding (no external deps needed).

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '../icons');
mkdirSync(iconsDir, { recursive: true });

function crc32(buf) {
  let c = 0xffffffff;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    table[n] = v;
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function chunk(type, data) {
  const typeBytes = [...type].map((c) => c.charCodeAt(0));
  const len = u32be(data.length);
  const body = [...typeBytes, ...data];
  const crc = u32be(crc32(new Uint8Array(body)));
  return [...len, ...body, ...crc];
}

function makePng(size) {
  // Blue (#0078d4) envelope icon as solid-colour PNG
  const r = 0x00, g = 0x78, b = 0xd4;

  // IHDR
  const ihdr = chunk('IHDR', [
    ...u32be(size), ...u32be(size),
    8, 2, 0, 0, 0, // bit depth 8, RGB
  ]);

  // IDAT: each row has filter byte 0 then RGB pixels
  const rowLen = 1 + size * 3;
  const raw = new Uint8Array(size * rowLen);
  for (let y = 0; y < size; y++) {
    const base = y * rowLen;
    raw[base] = 0; // filter none
    for (let x = 0; x < size; x++) {
      raw[base + 1 + x * 3] = r;
      raw[base + 2 + x * 3] = g;
      raw[base + 3 + x * 3] = b;
    }
  }

  // Deflate: use zlib "stored" block (no compression, simplest valid encoding)
  function deflateStored(data) {
    const BLOCK = 65535;
    const out = [0x78, 0x01]; // zlib header (deflate, default compression)
    let adler_a = 1, adler_b = 0;
    let offset = 0;
    while (offset < data.length) {
      const end = Math.min(offset + BLOCK, data.length);
      const block = data.slice(offset, end);
      const last = end >= data.length ? 1 : 0;
      const len = block.length;
      const nlen = (~len) & 0xffff;
      out.push(last, len & 0xff, (len >> 8) & 0xff, nlen & 0xff, (nlen >> 8) & 0xff);
      out.push(...block);
      for (const b of block) {
        adler_a = (adler_a + b) % 65521;
        adler_b = (adler_b + adler_a) % 65521;
      }
      offset = end;
    }
    // Adler-32 checksum
    out.push((adler_b >> 8) & 0xff, adler_b & 0xff, (adler_a >> 8) & 0xff, adler_a & 0xff);
    return out;
  }

  const idat = chunk('IDAT', deflateStored([...raw]));
  const iend = chunk('IEND', []);

  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  return Buffer.from([...sig, ...ihdr, ...idat, ...iend]);
}

for (const size of [16, 32, 48, 128]) {
  const path = resolve(iconsDir, `icon${size}.png`);
  writeFileSync(path, makePng(size));
  console.log(`✓ icons/icon${size}.png`);
}
