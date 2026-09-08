/**
 * Vite 8 replaced esbuild with Oxc, and Oxc does not yet lower TC39 Stage 3
 * decorators (oxc-project/oxc#9170). Without this, a decorated class reaches
 * Node untransformed and the runner dies with "Invalid or unexpected token".
 *
 * The workaround is the one the Vite 8 migration guide gives: run Babel's
 * decorator plugin ahead of Oxc, filtered so only files that contain an `@`
 * pay for it. `2023-11` is the current Stage 3 semantics, which is what the
 * decorators in `src/decorators.ts` are written against.
 */
import babel from '@rolldown/plugin-babel';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Stated rather than left to the default: Knip reads this config to find
    // the test entries, and with no `include` it sees none of them.
    include: ['src/**/*.test.ts'],
    // `.test-d.ts` files are type-level tests. They only run under
    // `vitest --typecheck`, which is how they always ran. Put them in
    // `include` and vitest runs them as runtime tests, which fails.
    typecheck: { include: ['src/**/*.test-d.ts'] },
  },
  plugins: [
    babel({
      presets: [
        {
          preset: () => ({
            plugins: [['@babel/plugin-proposal-decorators', { version: '2023-11' }]],
          }),
          rolldown: { filter: { code: '@' } },
        },
      ],
    }),
  ],
});
