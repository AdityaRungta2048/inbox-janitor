import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

const root = resolve(__dirname, 'src');

export default defineConfig({
  root,
  // .env lives in the project root, not src/
  envDir: resolve(__dirname, '.'),
  // Relative base so chrome-extension:// URLs work (no leading /)
  base: './',
  plugins: [preact()],
  resolve: {
    alias: {
      '@': root,
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    // emptyOutDir is handled by `rimraf dist` in the build script;
    // Vite would refuse to empty a dir outside its root anyway
    emptyOutDir: false,
    target: 'chrome120',
    rollupOptions: {
      input: {
        sidepanel: resolve(root, 'sidepanel/index.html'),
        popup: resolve(root, 'popup/index.html'),
      },
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
