import vttforge from '@vttforge/vite-plugin';
import { defineConfig } from 'vite';

/**
 * Vite config for {{TITLE}}.
 *
 * `@vttforge/vite-plugin` owns the build contract — it bundles
 * `scripts/main.mjs` into `dist/main.mjs` (no hash, no bare specifiers),
 * resolves `@import "@vttforge/styles"` at build time, copies the manifest +
 * `lang/` + `templates/` to `dist/`, and syncs the manifest version from
 * `package.json` on every build. The result under `dist/` is the deployable
 * artefact you symlink into Foundry's `Data/systems/{{ID}}/`.
 */
export default defineConfig({
  plugins: [vttforge({ id: '{{ID}}' })],
});
