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
  FOUNDRY_MIN_VERSION: '13',
  FOUNDRY_VERIFIED_VERSION: '13.341',
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
      it('produces a v13-shaped system.json', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });
        const manifest = JSON.parse(readFileSync(join(destDir, 'system.json'), 'utf8'));
        expect(manifest.id).toBe('my-pack');
        expect(manifest.title).toBe('My Pack');
        expect(manifest.compatibility.minimum).toBe('13');
        expect(manifest.styles).toEqual([{ src: 'styles/main.css' }]);
        expect(manifest.grid).toEqual({ type: 1, distance: 5, units: 'ft', diagonals: 0 });
        expect(manifest.flags.hotReload).toEqual({
          extensions: ['css', 'hbs', 'json'],
          paths: ['styles', 'templates', 'lang'],
        });
        expect(manifest.documentTypes.Actor.character.htmlFields).toEqual(['biography']);
      });

      it('ships template.json with declared types', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });
        const template = JSON.parse(readFileSync(join(destDir, 'template.json'), 'utf8'));
        expect(template.Actor.types).toContain('character');
        expect(template.Item.types).toContain('gear');
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
      it('produces a v13-shaped module.json that declares its sub-type', async () => {
        await scaffold({
          templateDir: join(templatesRoot(), variant),
          destDir,
          vars: VARS,
        });
        const manifest = JSON.parse(readFileSync(join(destDir, 'module.json'), 'utf8'));
        expect(manifest.id).toBe('my-pack');
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
