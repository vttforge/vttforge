/**
 * The dev loop, for a module, from a real build.
 *
 * Every link in this chain already has a unit test with a hand-written
 * fixture: the vite plugin emits `module.json` for `kind: 'module'`,
 * `readManifest` reads it, `foundryPackagesDir` maps a module to `modules`,
 * and `setupDevSymlink` lands the link. Nothing proved they compose.
 *
 * A fixture manifest is two fields the test author chose. This drives the
 * example module's real `dist/`, the one the vite plugin wrote, so a template
 * or plugin change that emits the wrong manifest name, the wrong id, or no
 * manifest at all fails here rather than in someone's Foundry.
 *
 * The reload half of the dev loop is not here. It needs a running Foundry,
 * and the e2e container installs packages with `docker cp` into a named
 * volume, which cannot hold a symlink to files on this host. That half stays
 * covered by `@vttforge/dev-module`'s own tests.
 */
import { existsSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, readlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupDevSymlink, setupDevSymlink } from '../commands/dev.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MODULE = join(repoRoot, 'examples', 'simple-module');
const SYSTEM = join(repoRoot, 'examples', 'simple-system');

/**
 * These need the examples built. `turbo.json` makes `@vttforge/cli#test`
 * depend on both example builds, so `pnpm test` and CI always have them; the
 * guard is for someone running vitest directly, and vitest reports the skip.
 */
const built = (project: string) =>
  existsSync(join(project, 'dist', 'module.json')) ||
  existsSync(join(project, 'dist', 'system.json'));

let dataRoot: string;

beforeEach(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), 'vttforge-module-dev-'));
  await mkdir(join(dataRoot, 'Data'), { recursive: true });
});

afterEach(async () => {
  await rm(dataRoot, { recursive: true, force: true });
});

describe.runIf(built(MODULE) && built(SYSTEM))('the dev loop against a real build', () => {
  it('links a built module into Data/modules, not Data/systems', async () => {
    const { target, manifest } = await setupDevSymlink({ cwd: MODULE, dataRoot });

    expect(manifest.type).toBe('module');
    // The failure this catches: a module landing under systems/ is invisible
    // to Foundry, and the dev loop reports success either way.
    expect(target).toBe(join(dataRoot, 'Data', 'modules', manifest.id));
    expect(existsSync(join(dataRoot, 'Data', 'systems'))).toBe(false);

    const info = await lstat(target);
    expect(info.isSymbolicLink()).toBe(true);
    expect(await readlink(target)).toBe(join(MODULE, 'dist'));
    // Foundry finds a package by the manifest at the root of that folder.
    expect(existsSync(join(target, 'module.json'))).toBe(true);
  });

  it('links a built system into Data/systems, from the same code path', async () => {
    const { target, manifest } = await setupDevSymlink({ cwd: SYSTEM, dataRoot });

    expect(manifest.type).toBe('system');
    expect(target).toBe(join(dataRoot, 'Data', 'systems', manifest.id));
    expect(existsSync(join(target, 'system.json'))).toBe(true);
  });

  it('keeps the two apart when both are linked into one Foundry', async () => {
    // What a module author actually has: their module and the system it
    // extends, both on the dev loop, in the same data directory.
    const module = await setupDevSymlink({ cwd: MODULE, dataRoot });
    const system = await setupDevSymlink({ cwd: SYSTEM, dataRoot });

    expect(module.target).not.toBe(system.target);
    expect(existsSync(module.target)).toBe(true);
    expect(existsSync(system.target)).toBe(true);
  });

  it('takes the module link back out without touching the system', async () => {
    const module = await setupDevSymlink({ cwd: MODULE, dataRoot });
    const system = await setupDevSymlink({ cwd: SYSTEM, dataRoot });

    await cleanupDevSymlink({ target: module.target, expectedSource: join(MODULE, 'dist') });

    expect(existsSync(module.target)).toBe(false);
    expect(existsSync(system.target)).toBe(true);
  });

  it('carries the manifest fields the module needs, through the link', async () => {
    const { target } = await setupDevSymlink({ cwd: MODULE, dataRoot });
    const manifest = await import(`${join(target, 'module.json')}`, {
      with: { type: 'json' },
    }).then((m) => m.default);

    // Read through the symlink, so this is what Foundry would read.
    expect(manifest.id).toBe('vttforge-example-module');
    // Without this the package channel is never opened and every emit is
    // dropped in silence. It is the one manifest field the socket API needs.
    expect(manifest.socket).toBe(true);
  });
});
