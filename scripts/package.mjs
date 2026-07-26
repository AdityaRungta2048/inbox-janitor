// Package dist/ into a store-ready inbox-janitor.zip
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
const out = resolve(root, 'inbox-janitor.zip');

const output = createWriteStream(out);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`✓ inbox-janitor.zip (${archive.pointer()} bytes)`);
});

archive.on('error', (err) => { throw err; });
archive.pipe(output);
archive.directory(dist, false);
await archive.finalize();
