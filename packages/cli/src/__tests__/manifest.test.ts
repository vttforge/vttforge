import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  describe('id and version validation (filesystem safety)', () => {
    it.each([
      ['../escape', 'traversal'],
      ['foo/bar', 'forward slash'],
      ['foo\\bar', 'backslash'],
      ['../../etc/passwd', 'absolute-ish path'],
      ['my system', 'space'],
      ['Foo-Bar', 'uppercase'],
      ['1leading-digit', 'leading digit'],
      ['name\u0000null', 'null byte'],
    ])('rejects id %j (%s)', async (badId) => {
      await writeFile(
        join(dist, 'system.json'),
        JSON.stringify({ id: badId, version: '1.0.0' }),
        'utf8',
      );
      await expect(readManifest(dist)).rejects.toThrow(/invalid "id"/);
    });

    it.each([
      ['1.0/0', 'slash'],
      ['1.0\\0', 'backslash'],
      ['1.0 0', 'space'],
      ['../1.0.0', 'traversal'],
    ])('rejects version %j (%s)', async (badVersion) => {
      await writeFile(
        join(dist, 'system.json'),
        JSON.stringify({ id: 'my-system', version: badVersion }),
        'utf8',
      );
      await expect(readManifest(dist)).rejects.toThrow(/invalid "version"/);
    });

    it.each([
      ['my-system'],
      ['my_system'],
      ['my.system'],
      ['a1'],
      ['a-very-long-package-id-with-dashes-and-numbers-123'],
    ])('accepts valid id %j', async (goodId) => {
      await writeFile(
        join(dist, 'system.json'),
        JSON.stringify({ id: goodId, version: '1.0.0' }),
        'utf8',
      );
      const result = await readManifest(dist);
      expect(result.id).toBe(goodId);
    });

    it.each([['1.0.0'], ['1.0.0-beta.1'], ['1.0.0+build.123'], ['1.0.0-rc.1+abc'], ['0.0.1']])(
      'accepts valid version %j',
      async (goodVersion) => {
        await writeFile(
          join(dist, 'system.json'),
          JSON.stringify({ id: 'my-system', version: goodVersion }),
          'utf8',
        );
        const result = await readManifest(dist);
        expect(result.version).toBe(goodVersion);
      },
    );
  });
});
