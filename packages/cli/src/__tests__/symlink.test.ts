import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { lstat, mkdir, readlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLink, readLinkTarget, removeLink } from '../symlink.js';

describe('createLink', () => {
  let tmp: string;
  let source: string;
  let target: string;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'vttforge-symlink-'));
    source = join(tmp, 'source');
    target = join(tmp, 'target');
    await mkdir(source);
    await writeFile(join(source, 'marker.txt'), 'hello', 'utf8');
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('creates a symlink pointing at source', async () => {
    await createLink(target, source);
    const info = await lstat(target);
    expect(info.isSymbolicLink()).toBe(true);
    const resolved = await readlink(target);
    expect(resolved).toBe(source);
  });

  it('is idempotent when target already points to source', async () => {
    await createLink(target, source);
    // Second call should not throw.
    await expect(createLink(target, source)).resolves.toBeUndefined();
  });

  it('throws when target points elsewhere without overwrite', async () => {
    const otherSource = join(tmp, 'other');
    await mkdir(otherSource);
    await createLink(target, otherSource);
    await expect(createLink(target, source)).rejects.toThrow(/Symlink already exists/);
  });

  it('overwrites a stale symlink when overwrite is true', async () => {
    const otherSource = join(tmp, 'other');
    await mkdir(otherSource);
    await createLink(target, otherSource);
    await createLink(target, source, { overwrite: true });
    const resolved = await readlink(target);
    expect(resolved).toBe(source);
  });

  it('refuses to overwrite a real directory', async () => {
    await mkdir(target);
    await expect(createLink(target, source)).rejects.toThrow(/path exists as a directory/);
  });

  it('refuses to overwrite a real file', async () => {
    await writeFile(target, 'real file content', 'utf8');
    await expect(createLink(target, source)).rejects.toThrow(/path exists as a file/);
  });

  it('creates parent directories as needed', async () => {
    const nested = join(tmp, 'a', 'b', 'c', 'link');
    await createLink(nested, source);
    expect(existsSync(nested)).toBe(true);
  });
});

describe('removeLink', () => {
  let tmp: string;
  let source: string;
  let target: string;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'vttforge-symlink-rm-'));
    source = join(tmp, 'source');
    target = join(tmp, 'target');
    await mkdir(source);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('removes an existing symlink', async () => {
    await createLink(target, source);
    await removeLink(target);
    expect(existsSync(target)).toBe(false);
    // The source must still be intact — unlink should only remove the link.
    expect(existsSync(source)).toBe(true);
  });

  it('no-ops when the path does not exist', async () => {
    await expect(removeLink(join(tmp, 'missing'))).resolves.toBeUndefined();
  });

  it('refuses to remove a real directory', async () => {
    await mkdir(target);
    await expect(removeLink(target)).rejects.toThrow(/it is a directory/);
    expect(existsSync(target)).toBe(true);
  });

  it('refuses to remove a real file', async () => {
    await writeFile(target, 'real', 'utf8');
    await expect(removeLink(target)).rejects.toThrow(/it is a file/);
    expect(existsSync(target)).toBe(true);
  });
});

describe('readLinkTarget', () => {
  let tmp: string;
  let source: string;
  let link: string;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'vttforge-readlink-'));
    source = join(tmp, 'source');
    link = join(tmp, 'link');
    await mkdir(source);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns the absolute target of a symlink', async () => {
    await createLink(link, source);
    expect(await readLinkTarget(link)).toBe(source);
  });

  it('returns null for a non-symlink path', async () => {
    await writeFile(link, 'not a link', 'utf8');
    expect(await readLinkTarget(link)).toBeNull();
  });

  it('returns null for a missing path', async () => {
    expect(await readLinkTarget(join(tmp, 'missing'))).toBeNull();
  });

  it('returns null for a real directory', async () => {
    await mkdir(link);
    expect(await readLinkTarget(link)).toBeNull();
  });
});
