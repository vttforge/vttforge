import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  dts: { sourcemap: true },
  clean: true,
  external: [/^foundry/, /^@foundry/],
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
});
