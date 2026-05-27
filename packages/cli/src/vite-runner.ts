/**
 * Spawn the user's project-local vite binary.
 *
 * We deliberately go through `node <node_modules/vite/bin/vite.js>` instead
 * of `node_modules/.bin/vite` so the dev/build commands work the same on
 * Windows (where `.bin/vite` is a `.cmd` shim with its own quoting rules)
 * as they do on POSIX. The user must have run their package manager's
 * install step before invoking `vttforge dev` or `vttforge build` —
 * vite is a project dependency, not bundled with the CLI.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export class ViteNotInstalledError extends Error {
  constructor(public readonly entryPath: string) {
    super(
      `vite is not installed in this project. Run \`pnpm install\` (or your package manager's equivalent) inside the project before \`vttforge dev\` / \`vttforge build\`. Expected entry: ${entryPath}`,
    );
    this.name = 'ViteNotInstalledError';
  }
}

/** Absolute path to the user's project-local `vite/bin/vite.js`. */
export function resolveViteEntry(cwd: string): string {
  const path = join(cwd, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(path)) {
    throw new ViteNotInstalledError(path);
  }
  return path;
}

/** Run `vite build` once and wait for it to exit. Throws on non-zero exit. */
export async function runViteBuildOnce(cwd: string): Promise<void> {
  const entry = resolveViteEntry(cwd);
  await new Promise<void>((resolveBuild, rejectBuild) => {
    const child = spawn(process.execPath, [entry, 'build'], {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', rejectBuild);
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
 */
export function spawnViteWatch(cwd: string): ChildProcess {
  const entry = resolveViteEntry(cwd);
  return spawn(process.execPath, [entry, 'build', '--watch'], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
}
