import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Templates live alongside the CLI source but are intentionally
    // text-with-placeholders (not buildable code). Keep vitest from trying
    // to discover or transform anything under `templates/`.
    exclude: ['templates/**', 'node_modules/**', 'dist/**'],
  },
});
