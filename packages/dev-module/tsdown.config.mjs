import { defineConfig } from 'tsdown';

export default defineConfig({
  // `index` is the importable API — the CLI reads it, the tests exercise it.
  // `main` is what Foundry loads: it must sit beside module.json as a
  // browser-ready ES module with no bare specifiers left to resolve.
  //
  // The two entries share code, so the bundler emits a chunk alongside them.
  // That is fine for Foundry, which resolves the relative import, but it does
  // mean the install step copies the whole `dist/` directory rather than
  // naming files — a file list would silently drop the chunk and leave a
  // module that loads and then fails.
  entry: ['src/index.ts', 'src/main.ts'],
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  dts: true,
  clean: true,
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
});
