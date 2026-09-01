/**
 * Put `@vttforge/dev-module` where Foundry will find it.
 *
 * Foundry loads a module from a directory under `Data/modules/<id>/` holding
 * `module.json` and the files it names. The published package already has
 * exactly that shape, so the install is a link to the package root — no copy
 * to keep in step, and a `pnpm update` is picked up on the next reload.
 *
 * A container is the other case: it cannot follow a host symlink, so the
 * compose file mounts the same directory instead. `vttforge dev` prints the
 * mount rather than editing anyone's compose file for them.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLink, readLinkTarget } from './symlink.js';

const DEV_MODULE_ID = 'vttforge-dev';

export interface InstallResult {
  /** Where the module now lives, from Foundry's point of view. */
  target: string;
  /** The package directory it points at — what a container should mount. */
  source: string;
  /** False when the link was already correct. */
  changed: boolean;
}

/**
 * Find the installed package directory.
 *
 * Resolved from the consumer's project so their `node_modules` answers,
 * falling back to this CLI's own resolution — which is what makes it work
 * inside this repository, where the package is a workspace link.
 */
export function resolveDevModuleDir(cwd: string): string | null {
  const candidates = [
    join(cwd, 'node_modules', '@vttforge', 'dev-module'),
    // `dist/` of the CLI sits two levels under its package root; the sibling
    // package is one level up from there.
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dev-module'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'module.json'))) return dir;
  }
  return null;
}

export async function installDevModule(
  modulesDir: string,
  packageDir: string,
): Promise<InstallResult> {
  const target = join(modulesDir, DEV_MODULE_ID);
  const existing = await readLinkTarget(target);
  if (existing === packageDir) {
    return { target, source: packageDir, changed: false };
  }
  await createLink(target, packageDir, { overwrite: true });
  return { target, source: packageDir, changed: true };
}

/** The compose line a containerised Foundry needs, ready to paste. */
export function composeMountLine(packageDir: string): string {
  return `- ${packageDir}:/data/Data/modules/${DEV_MODULE_ID}:ro`;
}
