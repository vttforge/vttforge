/**
 * Integration test — scaffold every shipped template end-to-end and assert
 * the basic shape of the generated project. Catches template drift early
 * (missing files, broken JSON syntax, unresolved placeholders, etc.).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type ScaffoldVars, scaffold, templatesRoot } from '../scaffold.js';

const require = createRequire(import.meta.url);

/**
 * The TypeScript variants are typechecked against the workspace's own
 * `@vttforge/core` source, so a template that stops matching the SDK fails
 * here rather than on the first `pnpm typecheck` a user runs.
 */
const CORE_SOURCE = join(templatesRoot(), '..', '..', 'core', 'src', 'index.ts');
const PACKAGES = join(templatesRoot(), '..', '..');

/** `tsc.js` sits next to the package's main entry; the `bin` path is not exported. */
const TSC = join(dirname(require.resolve('typescript')), 'tsc.js');

function typecheck(projectDir: string): string {
  const tsconfig = join(projectDir, 'tsconfig.typecheck.json');
  writeFileSync(
    tsconfig,
    JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: { paths: { '@vttforge/core': [CORE_SOURCE] } },
    }),
  );
  const result = spawnSync(process.execPath, [TSC, '--noEmit', '-p', tsconfig], {
    encoding: 'utf8',
  });
  return `${result.stdout}${result.stderr}`.trim();
}

const VARS: ScaffoldVars = {
  ID: 'my-pack',
  TITLE: 'My Pack',
  DESCRIPTION: 'Integration test fixture.',
  AUTHOR: 'Test Author',
  LICENSE: 'MIT',
  FOUNDRY_MIN_VERSION: '14',
  FOUNDRY_VERIFIED_VERSION: '14',
  LOCALE_PREFIX: 'MY_PACK',
  YEAR: '2026',
};

const SYSTEM_VARIANTS = ['system-ts', 'system-js'] as const;
const MODULE_VARIANTS = ['module-ts', 'module-js'] as const;
const ALL_VARIANTS = [...SYSTEM_VARIANTS, ...MODULE_VARIANTS];
const TS_VARIANTS = ['system-ts', 'module-ts'] as const;

describe('scaffolded templates', () => {
  let destDir: string;

  beforeEach(() => {
    destDir = mkdtempSync(join(tmpdir(), 'vttforge-integration-'));
    rmSync(destDir, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(destDir, { recursive: true, force: true });
  });

  for (const variant of ALL_VARIANTS) {
    describe(variant, () => {
      it('scaffolds a complete project', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });

        // Every variant ships these files.
        expect(existsSync(join(destDir, 'package.json'))).toBe(true);
        expect(existsSync(join(destDir, 'vite.config.mjs'))).toBe(true);
        expect(existsSync(join(destDir, 'README.md'))).toBe(true);
        expect(existsSync(join(destDir, '.gitignore'))).toBe(true);
        expect(existsSync(join(destDir, '.github', 'workflows', 'release.yml'))).toBe(true);
        expect(existsSync(join(destDir, 'lang', 'en.json'))).toBe(true);
        expect(existsSync(join(destDir, 'styles', 'main.css'))).toBe(true);
      });

      it('produces a valid package.json with substituted fields', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });
        const pkg = JSON.parse(readFileSync(join(destDir, 'package.json'), 'utf8'));
        expect(pkg.name).toBe('my-pack');
        expect(pkg.description).toBe('Integration test fixture.');
        expect(pkg.author).toBe('Test Author');
        expect(pkg.license).toBe('MIT');
      });

      it('leaves no `{{PLACEHOLDER}}` strings in the output', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });
        // Spot-check the manifest and main script for any leftover placeholders.
        const manifestName = variant.startsWith('system-') ? 'system.json' : 'module.json';
        const manifest = readFileSync(join(destDir, manifestName), 'utf8');
        expect(manifest).not.toMatch(/\{\{[A-Z_]+\}\}/);

        const mainExt = variant.endsWith('-ts') ? 'ts' : 'mjs';
        const main = readFileSync(join(destDir, 'scripts', `main.${mainExt}`), 'utf8');
        expect(main).not.toMatch(/\{\{[A-Z_]+\}\}/);
      });
    });
  }

  for (const variant of SYSTEM_VARIANTS) {
    describe(`${variant} (system-specific)`, () => {
      it('produces a v14-shaped system.json', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });
        const manifest = JSON.parse(readFileSync(join(destDir, 'system.json'), 'utf8'));
        expect(manifest.id).toBe('my-pack');
        expect(manifest.title).toBe('My Pack');
        expect(manifest.type).toBe('system');
        expect(manifest.compatibility.minimum).toBe('14');
        expect(manifest.styles).toEqual([{ src: 'styles/main.css' }]);
        expect(manifest.grid).toEqual({ type: 1, distance: 5, units: 'ft', diagonals: 0 });
        expect(manifest.flags.hotReload).toEqual({
          extensions: ['css', 'hbs', 'json'],
          paths: ['styles', 'templates', 'lang'],
        });
        expect(manifest.documentTypes.Actor.character.htmlFields).toEqual(['biography']);
      });

      it('ships no template.json, which would erase the manifest metadata', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });
        // Foundry replaces a type's `documentTypes` entry with a fresh object
        // for every type template.json lists, carrying over only htmlFields,
        // filePathFields and gmOnlyFields, and reading those from the document
        // level. Shipping one here would drop the htmlFields asserted above.
        expect(existsSync(join(destDir, 'template.json'))).toBe(false);
      });

      it('ships Handlebars sheet templates', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });
        expect(existsSync(join(destDir, 'templates', 'actor', 'character-sheet.hbs'))).toBe(true);
        expect(existsSync(join(destDir, 'templates', 'item', 'gear-sheet.hbs'))).toBe(true);
      });
    });
  }

  for (const variant of MODULE_VARIANTS) {
    describe(`${variant} (module-specific)`, () => {
      it('produces a v14-shaped module.json that declares its sub-type', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });
        const manifest = JSON.parse(readFileSync(join(destDir, 'module.json'), 'utf8'));
        expect(manifest.id).toBe('my-pack');
        expect(manifest.type).toBe('module');
        expect(manifest.title).toBe('My Pack');
        expect(manifest.styles).toEqual([{ src: 'styles/main.css' }]);
        expect(manifest.flags.hotReload).toEqual({
          extensions: ['css', 'hbs', 'json'],
          paths: ['styles', 'templates', 'lang'],
        });
        // The bare name here; `registerModule` files it as `my-pack.note`.
        expect(manifest.documentTypes).toEqual({ Item: { note: { htmlFields: ['body'] } } });
      });

      it('ships the note sheet template and its type label', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });
        expect(existsSync(join(destDir, 'templates', 'item', 'note-sheet.hbs'))).toBe(true);
        const lang = JSON.parse(readFileSync(join(destDir, 'lang', 'en.json'), 'utf8'));
        expect(lang.TYPES.Item['my-pack'].note).toBe('Note');
      });
    });
  }

  /**
   * The globals a scaffolded project declares and the ones `@vttforge/testing`
   * declares have to be the same types, not merely compatible ones.
   *
   * They were not. The helpers said `any`, the templates said `Game` and the
   * rest, and `tsc` stopped with six TS2403 the moment a reader added the
   * helpers to a scaffolded project. A structurally identical interface
   * declared in both places fails the same way, which is why the template
   * imports `FoundryNamespace` rather than writing one out.
   *
   * This checks the declaration alone rather than the whole scaffolded project.
   * The project's own typecheck is the test above; what is under test here is
   * whether two `declare global` blocks can coexist.
   */
  for (const variant of TS_VARIANTS) {
    it(`${variant}: its globals coexist with the test helpers`, () => {
      const dir = mkdtempSync(join(tmpdir(), 'vttforge-globals-'));
      try {
        writeFileSync(
          join(dir, 'globals.d.ts'),
          readFileSync(join(templatesRoot(), variant, 'scripts', 'foundry-globals.d.ts'), 'utf8'),
        );
        writeFileSync(
          join(dir, 'uses-helpers.ts'),
          "import { withMockFoundry } from '@vttforge/testing/vitest';\nexport const helper = withMockFoundry;\n",
        );
        writeFileSync(
          join(dir, 'tsconfig.json'),
          JSON.stringify({
            compilerOptions: {
              strict: true,
              target: 'es2022',
              module: 'esnext',
              moduleResolution: 'bundler',
              noEmit: true,
              // Off on purpose. It hides an import that does not resolve, and
              // an unresolved import inside the declaration is how this went
              // unnoticed: every global silently became `any` and everything
              // passed.
              skipLibCheck: false,
              paths: {
                '@vttforge/types': [join(PACKAGES, 'types', 'src', 'index.ts')],
                '@vttforge/testing/vitest': [
                  join(PACKAGES, 'testing', 'src', 'vitest', 'index.ts'),
                ],
              },
            },
            include: ['*.ts'],
          }),
        );
        const result = spawnSync(
          process.execPath,
          [TSC, '--noEmit', '-p', join(dir, 'tsconfig.json')],
          {
            encoding: 'utf8',
          },
        );
        expect(`${result.stdout}${result.stderr}`.trim()).toBe('');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 60_000);
  }

  for (const variant of TS_VARIANTS) {
    describe(`${variant} (typecheck)`, () => {
      it('typechecks against the workspace @vttforge/core', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });
        expect(typecheck(destDir)).toBe('');
      }, 60_000);
    });
  }
});
