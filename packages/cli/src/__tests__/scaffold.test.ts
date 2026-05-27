import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type ScaffoldVars, scaffold, substitute } from '../scaffold.js';

const FIXTURE_VARS: ScaffoldVars = {
  ID: 'my-system',
  TITLE: 'My System',
  DESCRIPTION: 'A test system',
  AUTHOR: 'Daisy',
  LICENSE: 'MIT',
  FOUNDRY_MIN_VERSION: '13',
  FOUNDRY_VERIFIED_VERSION: '13.341',
  LOCALE_PREFIX: 'MY_SYSTEM',
  YEAR: '2026',
};

describe('substitute', () => {
  it('replaces single placeholders', () => {
    expect(substitute('Hello, {{TITLE}}', FIXTURE_VARS)).toBe('Hello, My System');
  });

  it('replaces multiple placeholders in one pass', () => {
    expect(substitute('{{ID}} by {{AUTHOR}} ({{LICENSE}})', FIXTURE_VARS)).toBe(
      'my-system by Daisy (MIT)',
    );
  });

  it('passes unknown placeholders through unchanged', () => {
    expect(substitute('{{ID}} and {{UNKNOWN}}', FIXTURE_VARS)).toBe('my-system and {{UNKNOWN}}');
  });

  it('handles content with no placeholders', () => {
    expect(substitute('just plain text', FIXTURE_VARS)).toBe('just plain text');
  });

  it('replaces repeated placeholders', () => {
    expect(substitute('{{ID}} {{ID}} {{ID}}', FIXTURE_VARS)).toBe('my-system my-system my-system');
  });
});

describe('scaffold', () => {
  let templateDir: string;
  let destDir: string;

  beforeEach(async () => {
    templateDir = mkdtempSync(join(tmpdir(), 'vttforge-template-'));
    destDir = mkdtempSync(join(tmpdir(), 'vttforge-dest-'));
    // Remove the destDir so scaffold can create it fresh (mkdtempSync makes it).
    rmSync(destDir, { recursive: true, force: true });

    // Populate the template with a representative file tree.
    await mkdir(join(templateDir, 'scripts'), { recursive: true });
    await writeFile(
      join(templateDir, 'package.json'),
      JSON.stringify({ name: '{{ID}}', author: '{{AUTHOR}}' }, null, 2),
    );
    await writeFile(
      join(templateDir, 'system.json'),
      JSON.stringify({ id: '{{ID}}', title: '{{TITLE}}' }, null, 2),
    );
    await writeFile(
      join(templateDir, 'scripts', 'main.mjs'),
      "const SYSTEM_ID = '{{ID}}';\nconsole.log(SYSTEM_ID);\n",
    );
    await writeFile(join(templateDir, '.gitignore'), 'node_modules\ndist\n');
  });

  afterEach(() => {
    rmSync(templateDir, { recursive: true, force: true });
    rmSync(destDir, { recursive: true, force: true });
  });

  it('copies every template file into the destination', async () => {
    await scaffold({ templateDir, destDir, vars: FIXTURE_VARS });
    expect(existsSync(join(destDir, 'package.json'))).toBe(true);
    expect(existsSync(join(destDir, 'system.json'))).toBe(true);
    expect(existsSync(join(destDir, 'scripts', 'main.mjs'))).toBe(true);
    expect(existsSync(join(destDir, '.gitignore'))).toBe(true);
  });

  it('substitutes placeholders in JSON files', async () => {
    await scaffold({ templateDir, destDir, vars: FIXTURE_VARS });
    const pkg = JSON.parse(readFileSync(join(destDir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('my-system');
    expect(pkg.author).toBe('Daisy');
  });

  it('substitutes placeholders in JS source files', async () => {
    await scaffold({ templateDir, destDir, vars: FIXTURE_VARS });
    const main = readFileSync(join(destDir, 'scripts', 'main.mjs'), 'utf8');
    expect(main).toContain("const SYSTEM_ID = 'my-system';");
  });

  it('preserves files without placeholders byte-for-byte', async () => {
    await scaffold({ templateDir, destDir, vars: FIXTURE_VARS });
    expect(readFileSync(join(destDir, '.gitignore'), 'utf8')).toBe('node_modules\ndist\n');
  });

  it('throws when the template directory does not exist', async () => {
    await expect(
      scaffold({
        templateDir: join(tmpdir(), `vttforge-missing-${Date.now()}`),
        destDir,
        vars: FIXTURE_VARS,
      }),
    ).rejects.toThrow(/template directory does not exist/);
  });

  it('creates nested directories as needed', async () => {
    await mkdir(join(templateDir, 'a', 'b', 'c'), { recursive: true });
    await writeFile(join(templateDir, 'a', 'b', 'c', 'deep.txt'), 'hello {{ID}}\n');
    await scaffold({ templateDir, destDir, vars: FIXTURE_VARS });
    expect(readFileSync(join(destDir, 'a', 'b', 'c', 'deep.txt'), 'utf8')).toBe(
      'hello my-system\n',
    );
  });
});
