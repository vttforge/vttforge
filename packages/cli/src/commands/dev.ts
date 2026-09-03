/**
 * `vttforge dev`: symlink dist/ into Foundry Data and run vite watch.
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
import { composeMountLine, installDevModule, resolveDevModuleDir } from '../dev-module-install.js';
import { startDevServer } from '../dev-server.js';
import { watchDist } from '../dev-watcher.js';
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
  /** Port for the hot reload bridge. */
  hmrPort?: number;
}

/**
 * Where the bridge listens.
 *
 * `@vttforge/dev-module` dials this same number. If the two drift apart the
 * module retries a port nobody is listening on, forever and quietly. So a
 * test asserts they still agree.
 */
export const DEFAULT_HMR_PORT = 31_313;

interface BridgeOptions {
  cwd: string;
  distDir: string;
  dataRoot: string;
  manifest: Awaited<ReturnType<typeof readManifest>>;
  port: number;
}

interface Bridge {
  close: () => Promise<void>;
}

/**
 * Stand up the hot reload bridge: install the companion module, open the
 * socket, watch the build output.
 *
 * Every failure here returns null rather than throwing. A busy port or a
 * missing companion package should cost the developer hot reload, not the
 * dev loop: the build and the symlink are the load-bearing parts, and they
 * already succeeded by the time this runs.
 */
async function startHotReloadBridge(opts: BridgeOptions): Promise<Bridge | null> {
  const packageDir = resolveDevModuleDir(opts.cwd);
  if (!packageDir) {
    p.note(
      'Could not find @vttforge/dev-module. Install it to reload saves in place:\n  pnpm add -D @vttforge/dev-module',
      'Hot reload unavailable',
    );
    return null;
  }

  let server: Awaited<ReturnType<typeof startDevServer>>;
  try {
    server = await startDevServer({ port: opts.port });
  } catch {
    p.note(
      `Port ${opts.port} is in use; another \`vttforge dev\` is probably running.\nPass --hmr-port to use a different one.`,
      'Hot reload unavailable',
    );
    return null;
  }

  const modulesDir = foundryPackagesDir(opts.dataRoot, 'module');
  try {
    const install = await installDevModule(modulesDir, packageDir);
    p.note(
      [
        `Companion module linked → ${install.target}`,
        'Enable "VTTForge Dev" in the world, once.',
        '',
        'Foundry in a container cannot follow that link. Mount it instead:',
        `  ${composeMountLine(packageDir)}`,
      ].join('\n'),
      'Hot reload',
    );
  } catch (err) {
    await server.close();
    p.note(
      `Could not install the companion module: ${err instanceof Error ? err.message : String(err)}`,
      'Hot reload unavailable',
    );
    return null;
  }

  const watcher = watchDist({
    distDir: opts.distDir,
    packageId: opts.manifest.id,
    packageType: opts.manifest.type,
    onPayload: (frame) => server.broadcast(frame),
    onError: (message) => p.note(message, 'Watch error'),
  });

  return {
    close: async () => {
      watcher.close();
      await server.close();
    },
  };
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
        : 'Could not auto-detect a Foundry user-data directory on this OS. Please type the path.',
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
 * being swallowed (the user gave up on graceful shutdown; let them).
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

/**
 * @experimental Shape is unproven: no consumer has asked for this yet. It can
 * change in a minor.
 */
export async function runDev(options: DevOptions = {}): Promise<void> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();

  p.intro('🜲 vttforge dev: symlink + watch');

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
  //    when the user switches between projects with the same id. Real
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
  // 5. Hot reload bridge. Failing to start it must not cost the developer
  //    the whole dev loop: the build and the symlink are the load-bearing
  //    parts, and a busy port should degrade to "no hot reload", not to
  //    "vttforge dev does not run".
  const bridge = await startHotReloadBridge({
    cwd,
    distDir,
    dataRoot,
    manifest,
    port: options.hmrPort ?? DEFAULT_HMR_PORT,
  });

  p.note(
    `${bridge ? 'Saves apply in place, no page refresh.' : 'Hot reload is off; saves need a page refresh.'}\nCtrl-C to stop.`,
    'Watching',
  );

  // 6. Spawn watcher
  const watcher = spawnViteWatch(cwd);

  // 6. Block until SIGINT/SIGTERM
  await new Promise<void>((resolveDev) => {
    const cleanup = async () => {
      try {
        await cleanupDevSymlink({ target, expectedSource: distDir });
      } catch {
        // best-effort; Foundry rediscovers the next time dev runs.
      }
      await bridge?.close();
      if (!watcher.killed) watcher.kill('SIGINT');
      uninstall();
      resolveDev();
    };
    const uninstall = installSignalHandlers(cleanup);
    // If vite watcher dies on its own, surface it but don't auto-clean:
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
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
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
 * manual `ln -s`) has since redirected. That link doesn't belong to us
 * and removing it would silently disconnect their setup.
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
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
