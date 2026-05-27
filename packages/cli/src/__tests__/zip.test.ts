import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emitZip } from '../zip.js';

function listEntries(zipPath: string): string[] {
  // `-Z1` prints one entry per line, names only. Available wherever info-zip
  // is installed (macOS, every major Linux). The CLI tests already assume
  // a POSIX environment elsewhere (mkdtempSync paths, fs symlinks).
  const out = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

describe('emitZip', () => {
  let source: string;
  let extras: string;
  let outDir: string;

  beforeEach(async () => {
    source = mkdtempSync(join(tmpdir(), 'vttforge-zip-src-'));
    extras = mkdtempSync(join(tmpdir(), 'vttforge-zip-extras-'));
    outDir = mkdtempSync(join(tmpdir(), 'vttforge-zip-out-'));

    // Populate `source` with a representative Foundry dist layout.
    await writeFile(
      join(source, 'system.json'),
      JSON.stringify({ id: 'my-system', version: '1.0.0' }),
      'utf8',
    );
    await mkdir(join(source, 'scripts'));
    await writeFile(join(source, 'scripts', 'main.mjs'), 'console.log("hi");', 'utf8');
    await mkdir(join(source, 'styles'));
    await writeFile(join(source, 'styles', 'my-system.css'), '.x { color: red }', 'utf8');
  });

  afterEach(() => {
    rmSync(source, { recursive: true, force: true });
    rmSync(extras, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  });

  it('emits a zip with contents at the root (no wrapper directory)', async () => {
    const outFile = join(outDir, 'release.zip');
    const result = await emitZip({ sourceDir: source, outFile });

    expect(result.outFile).toBe(outFile);
    expect(result.byteSize).toBeGreaterThan(0);
    expect(existsSync(outFile)).toBe(true);

    const entries = listEntries(outFile);
    expect(entries).toContain('system.json');
    expect(entries).toContain('scripts/main.mjs');
    expect(entries).toContain('styles/my-system.css');
    // None of the entries should start with a wrapper folder name.
    for (const e of entries) {
      expect(e.startsWith('source')).toBe(false);
    }
  });

  it('includes extras from the project root when present', async () => {
    await writeFile(join(extras, 'LICENSE'), 'MIT', 'utf8');
    await writeFile(join(extras, 'README.md'), '# My System', 'utf8');

    const outFile = join(outDir, 'release.zip');
    await emitZip({
      sourceDir: source,
      outFile,
      extras: ['LICENSE', 'README.md', 'CHANGELOG.md'],
      extrasFrom: extras,
    });

    const entries = listEntries(outFile);
    expect(entries).toContain('LICENSE');
    expect(entries).toContain('README.md');
    // CHANGELOG.md doesn't exist in extras → silently skipped.
    expect(entries).not.toContain('CHANGELOG.md');
  });

  it('skips extras that already exist in sourceDir', async () => {
    // dist/ already contains a README.md — no duplicate in the zip.
    await writeFile(join(source, 'README.md'), '# In dist already', 'utf8');
    await writeFile(join(extras, 'README.md'), '# Project root version', 'utf8');

    const outFile = join(outDir, 'release.zip');
    await emitZip({
      sourceDir: source,
      outFile,
      extras: ['README.md'],
      extrasFrom: extras,
    });

    const entries = listEntries(outFile);
    const readmeCount = entries.filter((e) => e === 'README.md').length;
    expect(readmeCount).toBe(1);
  });

  it('throws when sourceDir does not exist', async () => {
    const outFile = join(outDir, 'release.zip');
    await expect(emitZip({ sourceDir: join(source, 'does-not-exist'), outFile })).rejects.toThrow(
      /sourceDir does not exist/,
    );
  });

  it('throws when extras are provided without extrasFrom', async () => {
    const outFile = join(outDir, 'release.zip');
    await expect(emitZip({ sourceDir: source, outFile, extras: ['LICENSE'] })).rejects.toThrow(
      /extrasFrom is required/,
    );
  });

  it('handles an empty extras array without requiring extrasFrom', async () => {
    const outFile = join(outDir, 'release.zip');
    await expect(emitZip({ sourceDir: source, outFile, extras: [] })).resolves.toBeDefined();
  });
});
