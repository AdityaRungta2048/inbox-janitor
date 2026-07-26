// Copy static assets (manifest, icons) into dist/ after Vite build.
import { copyFileSync, cpSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

mkdirSync(dist, { recursive: true });
mkdirSync(resolve(dist, 'icons'), { recursive: true });

copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
console.log('✓ Copied manifest.json');

cpSync(resolve(root, 'icons'), resolve(dist, 'icons'), { recursive: true });
console.log('✓ Copied icons/');
