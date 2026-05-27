import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emitReleaseZip } from '../commands/build.js';

function listZipEntries(zipPath: string): string[] {
  const out = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

describe('emitReleaseZip', () => {
  let cwd: string;
  let distDir: string;

  beforeEach(async () => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-build-'));
    distDir = join(cwd, 'dist');
    await mkdir(distDir, { recursive: true });
    // Fake the vite output: a real-looking system manifest + a script file.
    await writeFile(
      join(distDir, 'system.json'),
      JSON.stringify({ id: 'my-system', version: '1.2.3', title: 'My System' }),
      'utf8',
    );
    await mkdir(join(distDir, 'scripts'));
    await writeFile(join(distDir, 'scripts', 'main.mjs'), 'console.log("hi")', 'utf8');
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('emits <id>-<version>.zip at the project root', async () => {
    const { zipFile, byteSize, manifest } = await emitReleaseZip({ cwd });
    expect(zipFile).toBe(join(cwd, 'my-system-1.2.3.zip'));
    expect(byteSize).toBeGreaterThan(0);
    expect(manifest.id).toBe('my-system');
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.type).toBe('system');
    expect(existsSync(zipFile)).toBe(true);
  });

  it('writes dist/ contents at the zip root (no wrapper folder)', async () => {
    const { zipFile } = await emitReleaseZip({ cwd });
    const entries = listZipEntries(zipFile);
    expect(entries).toContain('system.json');
    expect(entries).toContain('scripts/main.mjs');
    expect(entries.some((e) => e.startsWith('dist/'))).toBe(false);
  });

  it('includes LICENSE / README / CHANGELOG when present at project root', async () => {
    await writeFile(join(cwd, 'LICENSE'), 'MIT', 'utf8');
    await writeFile(join(cwd, 'README.md'), '# My System', 'utf8');
    const { zipFile } = await emitReleaseZip({ cwd });
    const entries = listZipEntries(zipFile);
    expect(entries).toContain('LICENSE');
    expect(entries).toContain('README.md');
  });

  it('does not duplicate extras already present in dist/', async () => {
    // Vite plugin sometimes copies LICENSE into dist/. emitReleaseZip
    // must not produce two copies in the zip.
    await writeFile(join(distDir, 'LICENSE'), 'MIT (from dist)', 'utf8');
    await writeFile(join(cwd, 'LICENSE'), 'MIT (from root)', 'utf8');
    const { zipFile } = await emitReleaseZip({ cwd });
    const entries = listZipEntries(zipFile);
    const licenseCount = entries.filter((e) => e === 'LICENSE').length;
    expect(licenseCount).toBe(1);
  });

  it('handles module manifest (module.json instead of system.json)', async () => {
    rmSync(join(distDir, 'system.json'));
    await writeFile(
      join(distDir, 'module.json'),
      JSON.stringify({ id: 'my-module', version: '0.5.0' }),
      'utf8',
    );
    const { zipFile, manifest } = await emitReleaseZip({ cwd });
    expect(manifest.type).toBe('module');
    expect(zipFile).toBe(join(cwd, 'my-module-0.5.0.zip'));
  });

  it('throws when dist/ has no manifest', async () => {
    rmSync(join(distDir, 'system.json'));
    await expect(emitReleaseZip({ cwd })).rejects.toThrow(/No Foundry manifest found/);
  });
});
