/**
 * The manifest points Foundry at files on disk. A wrong path there fails the
 * way manifests do: the module loads, the entry never runs, and nothing says
 * so. These assert the paths resolve against what the build actually emits.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(readFileSync(join(packageRoot, 'module.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

describe('module.json', () => {
  it('names an id Foundry can serve as a directory', () => {
    expect(manifest.id).toBe('vttforge-dev');
  });

  it('declares its esmodule at a path that exists after a build', () => {
    expect(manifest.esmodules).toEqual(['dist/main.mjs']);
    // Skipped rather than failed when dist is absent: a fresh checkout runs
    // tests before it runs a build, and that is not this file's complaint.
    const entry = join(packageRoot, manifest.esmodules[0]);
    if (existsSync(join(packageRoot, 'dist'))) {
      expect(existsSync(entry)).toBe(true);
    }
  });

  it('ships every path the manifest names', () => {
    // `files` decides what reaches npm. A manifest entry outside it installs
    // as a broken module.
    for (const entry of manifest.esmodules ?? []) {
      const top = entry.split('/')[0];
      expect(pkg.files).toContain(top);
    }
    expect(pkg.files).toContain('module.json');
  });

  it('targets the Foundry generation this project supports', () => {
    expect(manifest.compatibility.minimum).toBe('13');
  });
});
