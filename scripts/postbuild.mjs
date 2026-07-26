// Post-build: rewrite sidepanel & popup HTML paths and verify dist structure.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '../dist');

// Verify required files
const required = [
  'manifest.json',
  'service-worker.js',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

let ok = true;
for (const f of required) {
  const path = resolve(dist, f);
  if (!existsSync(path)) {
    console.error(`✗ Missing: dist/${f}`);
    ok = false;
  } else {
    console.log(`✓ dist/${f}`);
  }
}

if (!ok) {
  process.exit(1);
}

console.log('\n✓ Post-build checks passed');
