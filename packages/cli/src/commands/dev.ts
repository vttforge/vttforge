/**
 * `vttforge dev` — symlink dist/ into Foundry Data and run vite watch.
 *
 * Flow:
 *   1. Sanity-check the project layout (package.json present)
 *   2. Run `vite build` once to populate dist/
 *   3. Read the resulting manifest → id + system/module type
 *   4. Resolve the Foundry user-data directory (override / env / config /
 *      OS default + interactive prompt that saves the choice)
 *   5. Create a symlink: `<dataRoot>/Data/<type>s/<id>` → `<cwd>/dist`
 *   6. Spawn `vite build --watch` with inherited stdio
 *   7. Block until SIGINT/SIGTERM, then clean up the symlink and kill vite
 *
 * Foundry's built-in `--hotReload` server flag wires the `flags.hotReload`
 * manifest entry (extensions + paths) to chokidar; the symlink we drop is
 * what chokidar watches, so saves through vite re-emit and Foundry reloads.
 * No additional client integration needed in this version.
 */

import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import {
  foundryPackagesDir,
  type ResolveDataDirOptions,
  resolveFoundryDataDir,
} from '../foundry-data-dir.js';
import { readManifest } from '../manifest.js';
import { createLink, readLinkTarget, removeLink } from '../symlink.js';
import { runViteBuildOnce, spawnViteWatch } from '../vite-runner.js';

export interface DevOptions {
  /** Override the project root. Defaults to `process.cwd()`. */
  cwd?: string;
  /** `--data-dir` flag value. Skips env/config/prompt lookup when set. */
  dataDir?: string;
}

/**
 * Compose a clack prompt that resolves to a Foundry user-data path or
 * `null` if the user cancels. Suitable for passing to
 * `resolveFoundryDataDir`.
 */
function createDataDirPrompt(): NonNullable<ResolveDataDirOptions['prompt']> {
  return async (autoDetected) => {
    p.note(
      autoDetected
        ? `Detected Foundry user-data directory:\n  ${autoDetected}`
        : 'Could not auto-detect a Foundry user-data directory on this OS — please type the path.',
      'First-run setup',
    );
    if (autoDetected) {
      const useDetected = await p.confirm({
        message: 'Use detected directory?',
        initialValue: true,
      });
      if (p.isCancel(useDetected)) return null;
      if (useDetected === true) return autoDetected;
    }
    const custom = await p.text({
      message:
        'Foundry user-data directory (the folder that contains Data/, e.g. ~/Library/Application Support/FoundryVTT)',
      placeholder: autoDetected ?? '/path/to/FoundryVTT',
      validate: (value: string | undefined) => {
        if (!value || value.trim().length === 0) return 'A path is required';
        return undefined;
      },
    });
    if (p.isCancel(custom)) return null;
    return String(custom).trim();
  };
}

/**
 * Install signal handlers that fire once. We use `process.once` so a second
 * Ctrl-C while cleanup is in flight propagates as a hard exit instead of
 * being swallowed (the user gave up on graceful shutdown — let them).
 */
function installSignalHandlers(cleanup: () => Promise<void>): () => void {
  let invoked = false;
  const handler = () => {
    if (invoked) return;
    invoked = true;
    void cleanup();
  };
  process.once('SIGINT', handler);
  process.once('SIGTERM', handler);
  return () => {
    process.removeListener('SIGINT', handler);
    process.removeListener('SIGTERM', handler);
  };
}

export async function runDev(options: DevOptions = {}): Promise<void> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();

  p.intro('🜲 vttforge dev — symlink + watch');

  if (!existsSync(join(cwd, 'package.json'))) {
    p.cancel(`No package.json at ${cwd}. Run \`vttforge dev\` from inside a scaffolded project.`);
    throw new Error('Missing package.json');
  }

  // 1. Initial build
  const buildSpinner = p.spinner();
  buildSpinner.start('vite build (initial)');
  try {
    await runViteBuildOnce(cwd);
    buildSpinner.stop('Initial build complete');
  } catch (err) {
    buildSpinner.stop('Initial build failed');
    throw err;
  }

  const distDir = join(cwd, 'dist');

  // 2. Read manifest emitted by vite
  const manifest = await readManifest(distDir);

  // 3. Resolve Foundry data dir
  const interactive = Boolean(process.stdout.isTTY);
  const dataRoot = await resolveFoundryDataDir({
    cwd,
    override: options.dataDir,
    prompt: interactive ? createDataDirPrompt() : undefined,
  });

  // 4. Create symlink. We pass overwrite: true so the dev loop "just works"
  //    when the user switches between projects with the same id — real
  //    files/dirs are still refused inside createLink.
  const packagesDir = foundryPackagesDir(dataRoot, manifest.type);
  const target = join(packagesDir, manifest.id);
  const existingTarget = await readLinkTarget(target);
  if (existingTarget && existingTarget !== distDir) {
    p.note(
      `Replacing stale symlink:\n  ${target}\n  was: ${existingTarget}\n  now: ${distDir}`,
      'Symlink',
    );
  }
  await createLink(target, distDir, { overwrite: true });

  p.note(
    `Linked dist/ → ${target}\nFoundry serves the package under /${manifest.type}s/${manifest.id}/.`,
    'Symlinked',
  );
  p.note(
    'Run Foundry with `--hotReload` so file saves reload the world without a page refresh.\nCtrl-C to stop.',
    'Watching',
  );

  // 5. Spawn watcher
  const watcher = spawnViteWatch(cwd);

  // 6. Block until SIGINT/SIGTERM
  await new Promise<void>((resolveDev) => {
    const cleanup = async () => {
      try {
        await cleanupDevSymlink({ target, expectedSource: distDir });
      } catch {
        // best-effort — Foundry rediscovers the next time dev runs.
      }
      if (!watcher.killed) watcher.kill('SIGINT');
      uninstall();
      resolveDev();
    };
    const uninstall = installSignalHandlers(cleanup);
    // If vite watcher dies on its own, surface it but don't auto-clean —
    // the user can re-run vttforge dev to re-establish.
    watcher.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        // eslint-disable-next-line no-console
        console.error(`\nvite watcher exited with code ${code}.`);
      }
    });
  });

  p.outro('Stopped. Symlink cleaned up.');
}

/**
 * Internal building block exposed for tests: given an already-built `dist/`
 * (vite has run, manifest is present) and a resolved Foundry data dir,
 * create the symlink and return the target path + manifest. Skips the
 * vite spawn and the signal-loop, so tests can drive the orchestration
 * deterministically.
 */
export async function setupDevSymlink(opts: { cwd: string; dataRoot: string }): Promise<{
  target: string;
  manifest: Awaited<ReturnType<typeof readManifest>>;
  childProcess?: ChildProcess;
}> {
  const cwd = resolve(opts.cwd);
  const distDir = join(cwd, 'dist');
  const manifest = await readManifest(distDir);
  const packagesDir = foundryPackagesDir(opts.dataRoot, manifest.type);
  const target = join(packagesDir, manifest.id);
  await createLink(target, distDir, { overwrite: true });
  return { target, manifest };
}

/**
 * Tear down a dev symlink iff it still points at the expected source.
 * Refuses to remove a symlink that another `vttforge dev` session (or a
 * manual `ln -s`) has since redirected — that link doesn't belong to us
 * and removing it would silently disconnect their setup.
 */
export async function cleanupDevSymlink(opts: {
  target: string;
  expectedSource: string;
}): Promise<void> {
  const current = await readLinkTarget(opts.target);
  if (current === opts.expectedSource) {
    await removeLink(opts.target);
  }
}
