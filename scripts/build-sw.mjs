// Build the service worker as a single ESM bundle using esbuild.
// Vite's rollup handles HTML entry points; esbuild handles the SW separately.
import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const clientId = process.env.VITE_MS_CLIENT_ID ?? 'mock-client-id-replace-before-testing';
const tenant = process.env.VITE_MS_TENANT ?? 'common';

await build({
  entryPoints: [resolve(root, 'src/background/service-worker.ts')],
  bundle: true,
  outfile: resolve(root, 'dist/service-worker.js'),
  format: 'esm',
  target: 'chrome120',
  define: {
    'import.meta.env.VITE_MS_CLIENT_ID': JSON.stringify(clientId),
    'import.meta.env.VITE_MS_TENANT': JSON.stringify(tenant),
    'import.meta.env.MODE': '"production"',
    'import.meta.env.PROD': 'true',
    'import.meta.env.DEV': 'false',
  },
  sourcemap: false,
  minify: false,
  logLevel: 'info',
});

console.log('✓ service-worker.js built');
