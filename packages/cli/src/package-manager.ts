/**
 * Detect which package manager invoked the CLI so we can run the right
 * `install` command after scaffolding.
 *
 * Strategy: read `npm_config_user_agent`, which pnpm/npm/bun/yarn all set when
 * they spawn a child process (including `pnpm dlx`, `pnpm create`, etc.).
 * Falls back to `pnpm` because that's the VTTForge house default and the
 * most common Foundry-developer choice — but any concrete signal in the
 * environment wins over the default.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type PackageManager = 'pnpm' | 'npm' | 'bun' | 'yarn';

export function detectPackageManager(env: NodeJS.ProcessEnv = process.env): PackageManager {
  const ua = env.npm_config_user_agent;
  if (typeof ua === 'string' && ua.length > 0) {
    if (ua.startsWith('pnpm')) return 'pnpm';
    if (ua.startsWith('bun')) return 'bun';
    if (ua.startsWith('yarn')) return 'yarn';
    if (ua.startsWith('npm')) return 'npm';
  }
  return 'pnpm';
}

export function installCommand(pm: PackageManager): string {
  return `${pm} install`;
}

/**
 * Detect a project's package manager by looking at which lockfile it
 * ships. `dev` and `build` need this — by the time the user runs
 * `vttforge dev`, npm_config_user_agent reflects whatever shell launched
 * the binary (often nothing in a global install), not how the project
 * was bootstrapped. The lockfile is the project's own contract.
 *
 * Falls back to {@link detectPackageManager} for fresh checkouts that
 * haven't been installed yet.
 */
export function detectProjectPackageManager(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): PackageManager {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  // Yarn 1 ships .lock; Yarn 2+ Plug'n'Play also keeps yarn.lock at root.
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  // Bun text format (bun.lock) supersedes the older binary bun.lockb in 1.1+.
  if (existsSync(join(cwd, 'bun.lock')) || existsSync(join(cwd, 'bun.lockb'))) return 'bun';
  // npm supports both package-lock.json (common) and npm-shrinkwrap.json
  // (published-package convention) — accept either as evidence of an npm
  // project, otherwise we'd misclassify shrinkwrap projects as pnpm.
  if (existsSync(join(cwd, 'package-lock.json')) || existsSync(join(cwd, 'npm-shrinkwrap.json'))) {
    return 'npm';
  }
  return detectPackageManager(env);
}

/**
 * Argument vector to invoke `vite` (or any other locally-installed CLI)
 * via the project's package manager. We always shell out through `<pm>
 * exec` so the call works regardless of the linker's choices — Yarn 4
 * Plug'n'Play, pnpm's symlinked layout, npm's flattened node_modules,
 * Bun's symlinked node_modules. Each manager exposes a uniform "run a
 * locally-resolved binary in the project's dependency graph" command.
 */
export function execInvocation(pm: PackageManager, bin: string): [string, string[]] {
  switch (pm) {
    case 'pnpm':
      return ['pnpm', ['exec', bin]];
    case 'yarn':
      // `yarn exec` runs in the PnP context; the `--` separator keeps any
      // bin-side flags from being parsed by yarn itself.
      return ['yarn', ['exec', '--', bin]];
    case 'bun':
      // `bun x <bin>` is the equivalent of `npx` — resolves through the
      // project's node_modules and works without a global install.
      return ['bun', ['x', bin]];
    case 'npm':
      return ['npx', ['--no-install', bin]];
  }
}
