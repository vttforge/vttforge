/**
 * Generate the API reference from the package sources.
 *
 * One TypeDoc run per published package, written to `src/reference/<name>/`
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
const appRoot = resolve(here, '..');
// The page sources live under `src/`; `archive/` holds the frozen versions.
// TypeDoc writes into the current version, so its root is `src/`.
const docsRoot = resolve(appRoot, 'src');
const repoRoot = resolve(appRoot, '..', '..');
const require = createRequire(import.meta.url);
const typedoc = join(dirname(require.resolve('typedoc/package.json')), 'bin', 'typedoc');

// `entries` rather than one entry, because a package whose subpaths cannot
// share a root export still has to appear here whole.
const PACKAGES = [
  { name: 'core', entries: ['src/index.ts'] },
  { name: 'types', entries: ['src/index.ts'] },
  { name: 'cli', entries: ['src/index.ts'] },
  { name: 'vite-plugin', entries: ['src/index.ts'] },
  // The root re-exports the vitest and quench entries. It does not re-export
  // the container one, which reads `node:child_process` and would then break a
  // browser-side import, so that entry is named here as well.
  { name: 'testing', entries: ['src/index.ts', 'src/container/index.ts'] },
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
      ...pkg.entries.map((entry) => join(packageDir, entry)),
    ],
    { stdio: 'inherit' },
  );
  console.log(`[typedoc] @vttforge/${pkg.name} → src/reference/${pkg.name}/`);
}
