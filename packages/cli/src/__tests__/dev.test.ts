import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { lstat, mkdir, readlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupDevSymlink } from '../commands/dev.js';

describe('setupDevSymlink', () => {
  let cwd: string;
  let distDir: string;
  let dataRoot: string;

  beforeEach(async () => {
    cwd = mkdtempSync(join(tmpdir(), 'vttforge-dev-'));
    distDir = join(cwd, 'dist');
    dataRoot = mkdtempSync(join(tmpdir(), 'vttforge-dev-data-'));
    await mkdir(distDir, { recursive: true });
    await mkdir(join(dataRoot, 'Data'), { recursive: true });
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(dataRoot, { recursive: true, force: true });
  });

  it('creates a symlink at Data/systems/<id> pointing at dist/ for a system', async () => {
    await writeFile(
      join(distDir, 'system.json'),
      JSON.stringify({ id: 'my-system', version: '1.0.0' }),
      'utf8',
    );

    const { target, manifest } = await setupDevSymlink({ cwd, dataRoot });

    expect(target).toBe(join(dataRoot, 'Data', 'systems', 'my-system'));
    expect(manifest.id).toBe('my-system');
    expect(manifest.type).toBe('system');

    const info = await lstat(target);
    expect(info.isSymbolicLink()).toBe(true);
    expect(await readlink(target)).toBe(distDir);
  });

  it('creates a symlink at Data/modules/<id> pointing at dist/ for a module', async () => {
    await writeFile(
      join(distDir, 'module.json'),
      JSON.stringify({ id: 'my-module', version: '0.1.0' }),
      'utf8',
    );

    const { target, manifest } = await setupDevSymlink({ cwd, dataRoot });

    expect(target).toBe(join(dataRoot, 'Data', 'modules', 'my-module'));
    expect(manifest.type).toBe('module');
    expect(existsSync(target)).toBe(true);
  });

  it('replaces a stale symlink pointing elsewhere', async () => {
    await writeFile(
      join(distDir, 'system.json'),
      JSON.stringify({ id: 'my-system', version: '1.0.0' }),
      'utf8',
    );

    // Pre-create a symlink that points at a sibling project (simulating
    // switching between two systems that share an id).
    const stale = mkdtempSync(join(tmpdir(), 'vttforge-stale-'));
    try {
      const target = join(dataRoot, 'Data', 'systems', 'my-system');
      await mkdir(join(dataRoot, 'Data', 'systems'), { recursive: true });
      const { symlink } = await import('node:fs/promises');
      await symlink(stale, target, 'dir');

      await setupDevSymlink({ cwd, dataRoot });

      expect(await readlink(target)).toBe(distDir);
    } finally {
      rmSync(stale, { recursive: true, force: true });
    }
  });

  it('is idempotent when the symlink already points at the right dist', async () => {
    await writeFile(
      join(distDir, 'system.json'),
      JSON.stringify({ id: 'my-system', version: '1.0.0' }),
      'utf8',
    );

    const first = await setupDevSymlink({ cwd, dataRoot });
    const second = await setupDevSymlink({ cwd, dataRoot });

    expect(second.target).toBe(first.target);
    expect(await readlink(first.target)).toBe(distDir);
  });

  it('throws when dist/ has no manifest (vite never ran)', async () => {
    await expect(setupDevSymlink({ cwd, dataRoot })).rejects.toThrow(/No Foundry manifest found/);
  });

  it('honors an existing Data/<type>s/ that was pre-created', async () => {
    // Mirror a Foundry install where the user-data root has a Data/ + systems/
    // hierarchy already on disk.
    await mkdir(join(dataRoot, 'Data', 'systems'), { recursive: true });
    await writeFile(
      join(distDir, 'system.json'),
      JSON.stringify({ id: 'my-system', version: '1.0.0' }),
      'utf8',
    );

    const { target } = await setupDevSymlink({ cwd, dataRoot });
    expect(target).toBe(join(dataRoot, 'Data', 'systems', 'my-system'));
  });
});
