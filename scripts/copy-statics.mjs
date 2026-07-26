// Copy static assets (manifest, icons) into dist/ after Vite build.
import { copyFileSync, cpSync, mkdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

mkdirSync(dist, { recursive: true });
mkdirSync(resolve(dist, 'icons'), { recursive: true });

copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
console.log('✓ Copied manifest.json');

// Ship only the PNG icons the manifest references — never source art (.jpg, etc.).
cpSync(resolve(root, 'icons'), resolve(dist, 'icons'), {
  recursive: true,
  filter: (src) => statSync(src).isDirectory() || src.toLowerCase().endsWith('.png'),
});
console.log('✓ Copied icons/ (PNG only)');
