/**
 * Spawn the user's project-local `vite` through their package manager.
 *
 * We deliberately go through `<pm> exec vite` instead of probing a
 * `node_modules/vite/bin/vite.js` path: Yarn 4 Plug'n'Play stores
 * dependencies in `.yarn/cache/` rather than `node_modules/`, and even
 * within npm/pnpm projects PNP-style linkers may not materialize the
 * binary on disk. The package-manager command always resolves the
 * locally-installed vite correctly regardless of linker.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { detectProjectPackageManager, execInvocation } from './package-manager.js';

/**
 * @internal Implementation detail of the `vttforge` binary. Not supported for
 * outside use, and going away in the next major.
 */
export class ViteNotInstalledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ViteNotInstalledError';
  }
}

/** Spawn args for invoking the user's vite (e.g. `["pnpm", ["exec", "vite"]]`).
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
 */
export function resolveViteInvocation(cwd: string): [string, string[]] {
  // Lightweight sanity check: the project must have a `package.json` so we
  // know we're inside a real project root. We do NOT require
  // `node_modules/vite/bin/vite.js` because Yarn PnP intentionally skips
  // creating that file.
  if (!existsSync(join(cwd, 'package.json'))) {
    throw new ViteNotInstalledError(
      `No package.json found at ${cwd}. Run \`vttforge dev\` / \`vttforge build\` from inside a scaffolded project.`,
    );
  }
  const pm = detectProjectPackageManager(cwd);
  return execInvocation(pm, 'vite');
}

/** Run `vite build` once and wait for it to exit. Throws on non-zero exit.
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
 */
export async function runViteBuildOnce(cwd: string): Promise<void> {
  const [bin, baseArgs] = resolveViteInvocation(cwd);
  await new Promise<void>((resolveBuild, rejectBuild) => {
    const child = spawn(bin, [...baseArgs, 'build'], {
      cwd,
      stdio: 'inherit',
      env: process.env,
      // `shell: false` keeps the args list quoted; npx/pnpm/yarn/bun all
      // accept bare argv without shell expansion.
      shell: false,
    });
    child.on('error', (err) => {
      // Surface a friendlier message if the PM binary itself isn't on PATH.
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        rejectBuild(
          new Error(
            `Could not invoke "${bin}". Is the project's package manager installed and on PATH?`,
          ),
        );
      } else {
        rejectBuild(err);
      }
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolveBuild();
      } else {
        rejectBuild(new Error(`vite build exited with code ${code ?? 'unknown'}`));
      }
    });
  });
}

/**
 * Spawn `vite build --watch` and return the child process. The caller is
 * responsible for waiting on it and tearing it down (the dev command kills
 * it on SIGINT).
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
 */
export function spawnViteWatch(cwd: string): ChildProcess {
  const [bin, baseArgs] = resolveViteInvocation(cwd);
  return spawn(bin, [...baseArgs, 'build', '--watch'], {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });
}
