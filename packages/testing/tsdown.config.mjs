import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/vitest/index.ts', 'src/quench/index.ts'],
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  dts: true,
  clean: true,
  external: [/^foundry/, /^vitest/],
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
});
