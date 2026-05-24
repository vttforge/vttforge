import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  dts: true,
  clean: true,
  external: ['vite', 'postcss', /^foundry/],
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
});
