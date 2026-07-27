// Package dist/ into a store-ready inbox-janitor.zip
import archiver from 'archiver';
import { createWriteStream, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
const out = resolve(root, 'inbox-janitor.zip');

// The Chrome Web Store rejects any uploaded manifest that contains a "key"
// field ("key field is not allowed in manifest") — the store assigns the
// extension ID itself. Strip "key" from the packaged manifest, but leave it in
// the source/dist manifest so local `load unpacked` keeps a stable dev ID.
const manifest = JSON.parse(readFileSync(resolve(dist, 'manifest.json'), 'utf8'));
delete manifest.key;

const output = createWriteStream(out);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`✓ inbox-janitor.zip (${archive.pointer()} bytes) — "key" stripped for upload`);
});

archive.on('error', (err) => {
  throw err;
});
archive.pipe(output);

// Everything from dist/ except the original manifest…
archive.glob('**/*', { cwd: dist, ignore: ['manifest.json'], dot: false });
// …plus the key-stripped manifest.
archive.append(JSON.stringify(manifest, null, 2) + '\n', { name: 'manifest.json' });

await archive.finalize();
