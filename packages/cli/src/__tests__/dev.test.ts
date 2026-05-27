import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { lstat, mkdir, readlink, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDevSymlink, setupDevSymlink } from '../commands/dev.js';

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

describe('cleanupDevSymlink', () => {
  let target: string;
  let ourDist: string;
  let othersDist: string;
  let parent: string;

  beforeEach(async () => {
    parent = mkdtempSync(join(tmpdir(), 'vttforge-cleanup-'));
    ourDist = join(parent, 'ours');
    othersDist = join(parent, 'theirs');
    target = join(parent, 'link');
    await mkdir(ourDist);
    await mkdir(othersDist);
  });

  afterEach(() => {
    rmSync(parent, { recursive: true, force: true });
  });

  it('removes the symlink when it still points at expectedSource', async () => {
    await symlink(ourDist, target, 'dir');
    await cleanupDevSymlink({ target, expectedSource: ourDist });
    expect(existsSync(target)).toBe(false);
    // The source must still be there — we only unlinked the symlink, not
    // the dist contents.
    expect(existsSync(ourDist)).toBe(true);
  });

  it('leaves the symlink alone when it points at a different source', async () => {
    // Another `vttforge dev` session for the same id replaced our symlink
    // with their own. Our cleanup must NOT yank that out from under them.
    await symlink(othersDist, target, 'dir');
    await cleanupDevSymlink({ target, expectedSource: ourDist });
    expect(existsSync(target)).toBe(true);
    expect(await readlink(target)).toBe(othersDist);
  });

  it('is a no-op when the target does not exist', async () => {
    await cleanupDevSymlink({ target, expectedSource: ourDist });
    expect(existsSync(target)).toBe(false);
  });

  it('leaves a real directory at the target path untouched', async () => {
    // Someone replaced the symlink with a real dir between runs. Don't
    // delete user content.
    rmSync(target, { recursive: true, force: true });
    await mkdir(target);
    await cleanupDevSymlink({ target, expectedSource: ourDist });
    const info = await lstat(target);
    expect(info.isDirectory()).toBe(true);
    expect(info.isSymbolicLink()).toBe(false);
  });
});
