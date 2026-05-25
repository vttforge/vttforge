import { defineConfig } from 'tsdown';

/**
 * Bundle the example system into a single ESM file Foundry can serve over
 * HTTP. Replaces the work that `@vttforge/vite-plugin` will own in v0.2.
 *
 * The browser-side ESM loader can't resolve bare specifiers like
 * `@vttforge/core` — Foundry serves files as static assets, not through a
 * Node module resolver. tsdown inlines @vttforge/core (and the example's
 * own `./` imports) into `dist/system.mjs` so the manifest can ship a
 * fully-resolved entry point.
 */
export default defineConfig({
  entry: ['scripts/main.mjs'],
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outDir: 'dist',
  outExtensions: () => ({ js: '.mjs' }),
  sourcemap: true,
  clean: true,
  dts: false,
  // Force-bundle the workspace dep — by default tsdown treats anything
  // declared in package.json `dependencies` as external. For a Foundry
  // system the browser must receive fully-resolved code.
  noExternal: [/^@vttforge\//],
});
