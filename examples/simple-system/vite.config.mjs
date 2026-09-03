import vttforge from '@vttforge/vite-plugin';
import { defineConfig } from 'vite';

/**
 * Build config for the reference Foundry v13 system.
 *
 * Uses `@vttforge/vite-plugin` to:
 *   - bundle `scripts/main.mjs` into `dist/main.mjs` (no hash, fully resolved,
 *     no bare specifiers — Foundry's browser ESM loader can't resolve them)
 *   - bundle `styles/example.css` into `dist/styles/example.css` with
 *     `@import "@vttforge/styles"` inlined at build time
 *   - copy `system.json`, `lang/`, `templates/` to `dist/`
 *   - sync `package.json` version into `dist/system.json`
 *   - rewrite the manifest's `esmodules` and `styles` to point at the
 *     bundled output
 *
 * Foundry mounts `dist/` (via `docker-compose.dev.yml`) into
 * `Data/systems/vttforge-example/` — so dist/ is the deployable artifact.
 */
export default defineConfig({
  plugins: [vttforge({ id: 'vttforge-example' })],
});
