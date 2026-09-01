import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node26',
  sourcemap: true,
  dts: true,
  clean: true,
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
});
