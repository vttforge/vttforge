/**
 * Generate the API reference from the package sources.
 *
 * One TypeDoc run per published package, written to `reference/<name>/`
 * as Markdown for VitePress. The sidebar JSON each run emits is read by
 * `.vitepress/config.mts`, so a new export appears in the navigation by
 * existing. The output is generated at build time and not committed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(here, '..');
const repoRoot = resolve(docsRoot, '..', '..');
const require = createRequire(import.meta.url);
const typedoc = join(dirname(require.resolve('typedoc/package.json')), 'bin', 'typedoc');

const PACKAGES = [
  { name: 'core', entry: 'src/index.ts' },
  { name: 'types', entry: 'src/index.ts' },
  { name: 'cli', entry: 'src/index.ts' },
  { name: 'vite-plugin', entry: 'src/index.ts' },
  { name: 'testing', entry: 'src/index.ts' },
];

for (const pkg of PACKAGES) {
  const packageDir = join(repoRoot, 'packages', pkg.name);
  const out = join(docsRoot, 'reference', pkg.name);
  if (existsSync(out)) rmSync(out, { recursive: true });
  execFileSync(
    process.execPath,
    [
      typedoc,
      '--plugin',
      'typedoc-plugin-markdown',
      '--plugin',
      'typedoc-vitepress-theme',
      '--tsconfig',
      join(packageDir, 'tsconfig.json'),
      '--out',
      out,
      '--docsRoot',
      docsRoot,
      '--name',
      `@vttforge/${pkg.name}`,
      '--readme',
      'none',
      '--excludePrivate',
      '--excludeInternal',
      '--disableSources',
      // The workspace compiles with a newer TypeScript than TypeDoc supports;
      // the packages are typechecked by `pnpm typecheck`, not here.
      '--skipErrorChecking',
      // Helper types behind a public conditional type are not part of the API.
      '--validation.notExported',
      'false',
      '--logLevel',
      'Warn',
      join(packageDir, pkg.entry),
    ],
    { stdio: 'inherit' },
  );
  console.log(`[typedoc] @vttforge/${pkg.name} → reference/${pkg.name}/`);
}
