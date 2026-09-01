import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node26',
  sourcemap: true,
  dts: true,
  clean: true,
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
});
