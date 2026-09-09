/**
 * `vttforge lint` runs the Biome this package depends on. These cases spawn
 * it for real against a throwaway project: a scaffolded project has no
 * Biome of its own, so the shipped config and the resolved binary are the
 * whole feature, and a mock would prove nothing.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { biomeArgs, runLintCommand } from '../commands/lint.js';

const UNFORMATTED = 'export const  hello = ( name ) => { return name }\n';
const FORMATTED = 'export const hello = (name) => {\n  return name;\n};\n';

describe('biomeArgs', () => {
  it('reports with `ci` and fixes with `check --write`', () => {
    expect(biomeArgs({ fix: false, configPath: null })).toEqual(['ci', '.']);
    expect(biomeArgs({ fix: true, configPath: null })).toEqual(['check', '--write', '.']);
  });

  it('points Biome at the shipped config only when the project has none', () => {
    expect(biomeArgs({ fix: false, configPath: '/cli/lint/vttforge-biome.json' })).toEqual([
      'ci',
      '.',
      '--config-path=/cli/lint/vttforge-biome.json',
    ]);
  });
});

describe('runLintCommand', () => {
  let cwd: string;
  const silent = () => {};

  beforeEach(async () => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-lint-'));
    await writeFile(
      join(cwd, 'package.json'),
      `${JSON.stringify({ name: 'lint-fixture', type: 'module', private: true }, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      join(cwd, 'module.json'),
      `${JSON.stringify(
        {
          id: 'lint-fixture',
          type: 'module',
          title: 'Lint fixture',
          version: '0.0.1',
          compatibility: { minimum: '14', verified: '14' },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await mkdir(join(cwd, 'scripts'));
    await writeFile(join(cwd, 'scripts', 'main.mjs'), UNFORMATTED, 'utf8');
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('refuses to run outside a project', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'vttforge-lint-empty-'));
    try {
      await expect(runLintCommand({ cwd: empty, write: silent })).rejects.toThrow(/package\.json/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('uses the shipped config and fails on an unformatted file', async () => {
    const result = await runLintCommand({ cwd, write: silent });
    expect(result.configPath).toMatch(/[\\/]lint[\\/]vttforge-biome\.json$/);
    expect(result.biomeExitCode).not.toBe(0);
    expect(result.exitCode).toBe(result.biomeExitCode);
    // Untouched: a report-only run writes nothing.
    expect(readFileSync(join(cwd, 'scripts', 'main.mjs'), 'utf8')).toBe(UNFORMATTED);
  });

  it('--fix formats the file and the run goes green', async () => {
    const fixed = await runLintCommand({ cwd, fix: true, write: silent });
    expect(fixed.biomeExitCode).toBe(0);
    expect(readFileSync(join(cwd, 'scripts', 'main.mjs'), 'utf8')).toBe(FORMATTED);

    const again = await runLintCommand({ cwd, write: silent });
    expect(again.biomeExitCode).toBe(0);
    expect(again.auditExitCode).toBe(0);
    expect(again.exitCode).toBe(0);
  });

  it('a biome.json at the project root replaces the shipped config', async () => {
    // Formatter off: the unformatted file is now fine by the project's own rules.
    await writeFile(
      join(cwd, 'biome.json'),
      `${JSON.stringify({ formatter: { enabled: false }, linter: { enabled: false } }, null, 2)}\n`,
      'utf8',
    );
    const result = await runLintCommand({ cwd, write: silent });
    expect(result.configPath).toBeNull();
    expect(result.biomeExitCode).toBe(0);
  });

  it('runs the audit after Biome and surfaces its exit code', async () => {
    await writeFile(join(cwd, 'scripts', 'main.mjs'), FORMATTED, 'utf8');
    // A bare v14-removed global: HIGH, so the audit fails the run.
    await writeFile(
      join(cwd, 'scripts', 'legacy.mjs'),
      'export const merged = mergeObject({}, { a: 1 });\n',
      'utf8',
    );
    const chunks: string[] = [];
    const result = await runLintCommand({ cwd, write: (c) => chunks.push(c) });
    expect(result.biomeExitCode).toBe(0);
    expect(result.auditExitCode).toBe(1);
    expect(result.exitCode).toBe(1);
    expect(chunks.join('')).toMatch(/VTTF-AUDIT-011/);

    const skipped = await runLintCommand({ cwd, audit: false, write: silent });
    expect(skipped.auditExitCode).toBeNull();
    expect(skipped.exitCode).toBe(0);
  });
});
