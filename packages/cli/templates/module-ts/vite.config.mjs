import vttforge from '@vttforge/vite-plugin';
import { defineConfig } from 'vite';

/**
 * Vite config for {{TITLE}}.
 *
 * `@vttforge/vite-plugin` owns the build contract for both systems and
 * modules — `kind: 'module'` tells the plugin to write `dist/module.json`
 * (instead of `system.json`) and to base chunk URLs at `/modules/{{ID}}/`.
 */
export default defineConfig({
  plugins: [vttforge({ id: '{{ID}}', kind: 'module', entry: 'scripts/main.ts' })],
});
