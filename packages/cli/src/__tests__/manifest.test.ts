import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readManifest } from '../manifest.js';

describe('readManifest', () => {
  let dist: string;

  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'vttforge-manifest-'));
  });

  afterEach(() => {
    rmSync(dist, { recursive: true, force: true });
  });

  it('reads system.json and reports type "system"', async () => {
    await writeFile(
      join(dist, 'system.json'),
      JSON.stringify({ id: 'my-system', version: '1.0.0', title: 'My System' }),
      'utf8',
    );
    const result = await readManifest(dist);
    expect(result.id).toBe('my-system');
    expect(result.version).toBe('1.0.0');
    expect(result.type).toBe('system');
    expect(result.raw.title).toBe('My System');
  });

  it('reads module.json and reports type "module"', async () => {
    await writeFile(
      join(dist, 'module.json'),
      JSON.stringify({ id: 'my-module', version: '0.2.1' }),
      'utf8',
    );
    const result = await readManifest(dist);
    expect(result.type).toBe('module');
    expect(result.id).toBe('my-module');
    expect(result.version).toBe('0.2.1');
  });

  it('prefers system.json when both files exist', async () => {
    await writeFile(
      join(dist, 'system.json'),
      JSON.stringify({ id: 'priority-system', version: '1.0.0' }),
      'utf8',
    );
    await writeFile(
      join(dist, 'module.json'),
      JSON.stringify({ id: 'fallback-module', version: '1.0.0' }),
      'utf8',
    );
    const result = await readManifest(dist);
    expect(result.id).toBe('priority-system');
    expect(result.type).toBe('system');
  });

  it('throws when no manifest is present', async () => {
    await expect(readManifest(dist)).rejects.toThrow(/No Foundry manifest found/);
  });

  it('throws when the manifest JSON is invalid', async () => {
    await writeFile(join(dist, 'system.json'), 'not json', 'utf8');
    await expect(readManifest(dist)).rejects.toThrow(/Failed to parse/);
  });

  it('throws when the manifest is a JSON array (not an object)', async () => {
    await writeFile(join(dist, 'system.json'), '[]', 'utf8');
    await expect(readManifest(dist)).rejects.toThrow(/not a JSON object/);
  });

  it('throws when id is missing', async () => {
    await writeFile(join(dist, 'system.json'), JSON.stringify({ version: '1.0.0' }), 'utf8');
    await expect(readManifest(dist)).rejects.toThrow(/missing a non-empty "id"/);
  });

  it('throws when version is missing', async () => {
    await writeFile(join(dist, 'system.json'), JSON.stringify({ id: 'my-system' }), 'utf8');
    await expect(readManifest(dist)).rejects.toThrow(/missing a non-empty "version"/);
  });

  it('throws when id is empty string', async () => {
    await writeFile(
      join(dist, 'system.json'),
      JSON.stringify({ id: '', version: '1.0.0' }),
      'utf8',
    );
    await expect(readManifest(dist)).rejects.toThrow(/missing a non-empty "id"/);
  });

  it('walks into nested dist directory structure', async () => {
    // The vite plugin sometimes emits into dist/ with assets in subdirs;
    // readManifest only cares that the manifest lives at the dist root.
    await mkdir(join(dist, 'scripts'), { recursive: true });
    await writeFile(join(dist, 'scripts', 'main.mjs'), 'console.log("hi");', 'utf8');
    await writeFile(
      join(dist, 'system.json'),
      JSON.stringify({ id: 'my-system', version: '1.0.0' }),
      'utf8',
    );
    const result = await readManifest(dist);
    expect(result.id).toBe('my-system');
  });
});
