/**
 * Foundry user-data directory discovery + persistence.
 *
 * Foundry stores worlds, systems, and modules under a single user-data
 * directory (`Data/` lives at its root). `vttforge dev` needs to know where
 * that is so it can symlink the built `dist/` into `Data/systems/<id>/` or
 * `Data/modules/<id>/` and let Foundry pick it up.
 *
 * Precedence (top wins):
 *   1. Explicit `--data-dir` flag passed to the command
 *   2. `FOUNDRY_DATA_DIR` env var (useful in Docker/CI)
 *   3. `<project>/.vttforge/config.json :: foundryDataDir`
 *   4. OS default + interactive prompt that saves to (3) for next time
 *
 * The OS-default detection treats `XDG_DATA_HOME` (Linux) and `%LOCALAPPDATA%`
 * (Windows) as part of the OS convention, not as Foundry-specific overrides.
 *
 * Everything here is pure: `platform`, `env`, and `home` flow through
 * options so tests can drive every branch without monkey-patching globals.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

/** Shape persisted to `<project>/.vttforge/config.json`. */
export interface VTTForgeConfig {
  foundryDataDir?: string;
}

/**
 * Return the OS-default Foundry user-data directory, or `null` on unknown
 * platforms / missing platform-specific env vars. Does NOT check existence;
 * callers prompt the user when the suggested path doesn't resolve.
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
 */
export function autoDetectFoundryDataDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string | null {
  switch (platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'FoundryVTT');
    case 'linux': {
      const xdg = env.XDG_DATA_HOME;
      if (typeof xdg === 'string' && xdg.length > 0) {
        return join(xdg, 'FoundryVTT');
      }
      return join(home, '.local', 'share', 'FoundryVTT');
    }
    case 'win32': {
      const localAppData = env.LOCALAPPDATA;
      if (typeof localAppData === 'string' && localAppData.length > 0) {
        return join(localAppData, 'FoundryVTT');
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Heuristic: a path looks like a Foundry user-data root if it contains a
 * `Data/` subdirectory (canonical Foundry layout) OR if it already contains
 * `systems/` or `modules/` (the path is already the Data folder itself).
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
 */
export function looksLikeFoundryDataDir(path: string): boolean {
  if (!existsSync(path)) return false;
  return (
    existsSync(join(path, 'Data')) ||
    existsSync(join(path, 'systems')) ||
    existsSync(join(path, 'modules'))
  );
}

const CONFIG_DIR = '.vttforge';
const CONFIG_FILE = 'config.json';

/** Absolute path to the project-local config file (whether or not it exists).
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
 */
export function configPath(cwd: string): string {
  return join(resolve(cwd), CONFIG_DIR, CONFIG_FILE);
}

/** Load `<cwd>/.vttforge/config.json` if it exists and is valid JSON.
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
 */
export async function loadConfig(cwd: string): Promise<VTTForgeConfig | null> {
  const path = configPath(cwd);
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as VTTForgeConfig;
    }
    return null;
  } catch {
    // Corrupted JSON: treat as missing rather than crashing the dev loop.
    // The next save (after a successful prompt) overwrites it cleanly.
    return null;
  }
}

/** Persist `<cwd>/.vttforge/config.json`. Creates the `.vttforge/` dir as needed.
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
 */
export async function saveConfig(cwd: string, config: VTTForgeConfig): Promise<void> {
  const path = configPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

/**
 * Heuristic: is `path` already Foundry's `Data/` folder (vs. its parent)?
 * We treat the path as Data when:
 *   - basename is "Data" (case-insensitive, since macOS/Windows file systems
 *     are case-insensitive by default), OR
 *   - any of `systems/`, `modules/`, `worlds/` exists inside (proof that
 *     Foundry has previously written package folders here).
 *
 * Used by `foundryPackagesDir` so users can supply EITHER the user-data
 * root OR the `Data/` folder directly without us double-nesting `Data/Data`.
 */
function isFoundryDataFolder(path: string): boolean {
  // basename match, case-insensitive so `DATA`, `data`, `Data` all work on
  // macOS/Windows volumes that don't preserve case strictly. On Linux the
  // folder is always "Data" exactly; case-insensitive compare is harmless.
  if (basename(path).toLowerCase() === 'data') return true;
  return (
    existsSync(join(path, 'systems')) ||
    existsSync(join(path, 'modules')) ||
    existsSync(join(path, 'worlds'))
  );
}

/**
 * Resolve the packages directory (`Data/systems/` or `Data/modules/`) under
 * the given Foundry user-data root. Accepts the path Foundry itself runs
 * with (the user-data folder, which contains `Data/`) OR the `Data/` folder
 * directly; both are common in muscle memory.
 *
 * The returned path is not guaranteed to exist yet; callers `mkdir -p` it
 * before creating the symlink.
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
 */
export function foundryPackagesDir(dataRoot: string, type: 'system' | 'module'): string {
  const subFolder = type === 'system' ? 'systems' : 'modules';
  if (isFoundryDataFolder(dataRoot)) {
    return join(dataRoot, subFolder);
  }
  return join(dataRoot, 'Data', subFolder);
}

/**
 * Expand `~` / `~/` prefixes to the user's home directory. Shells do this
 * automatically; Node's `path.resolve` does NOT, so a user who types the
 * prompt's own example `~/Library/Application Support/FoundryVTT` would
 * end up with a symlink under `<cwd>/~/Library/...` if we skipped this.
 */
function expandTilde(p: string, home: string): string {
  if (p === '~') return home;
  if (p.startsWith('~/') || p.startsWith('~\\')) return join(home, p.slice(2));
  return p;
}

export interface ResolveDataDirOptions {
  /** Project root: also where `.vttforge/config.json` is read/written. */
  cwd: string;
  /** `--data-dir` flag value. Skips persistence and prompting when present. */
  override?: string;
  /**
   * Interactive prompt for the first run. Receives the OS-default path
   * (may be `null` on unknown platforms) and resolves with the chosen path,
   * or `null` if the user cancelled. When undefined, the function refuses
   * to ask and throws, appropriate for non-TTY contexts (CI, scripts).
   */
  prompt?: (autoDetected: string | null) => Promise<string | null>;
  /** Override `process.platform` (tests). */
  platform?: NodeJS.Platform;
  /** Override `process.env` (tests). */
  env?: NodeJS.ProcessEnv;
  /** Override `os.homedir()` (tests). */
  home?: string;
}

/**
 * Walk the precedence chain and return the chosen Foundry user-data path.
 * Saves the user's choice to the project config on first interactive run so
 * subsequent invocations skip the prompt.
 *
 * @internal Implementation detail of the `vttforge` binary. Not supported
 * for outside use, and going away in the next major.
 */
export async function resolveFoundryDataDir(opts: ResolveDataDirOptions): Promise<string> {
  const { cwd, override, prompt } = opts;
  const env = opts.env ?? process.env;
  const platform = opts.platform ?? process.platform;
  const home = opts.home ?? homedir();

  if (typeof override === 'string' && override.length > 0) {
    return resolve(expandTilde(override, home));
  }

  const envValue = env.FOUNDRY_DATA_DIR;
  if (typeof envValue === 'string' && envValue.length > 0) {
    return resolve(expandTilde(envValue, home));
  }

  const config = await loadConfig(cwd);
  if (config?.foundryDataDir && existsSync(config.foundryDataDir)) {
    return config.foundryDataDir;
  }

  const detected = autoDetectFoundryDataDir(platform, env, home);

  if (prompt) {
    const choice = await prompt(detected);
    if (!choice) {
      throw new Error('No Foundry data directory selected. Aborting.');
    }
    const chosen = resolve(expandTilde(choice, home));
    await saveConfig(cwd, { ...config, foundryDataDir: chosen });
    return chosen;
  }

  // Non-interactive fallback: use the OS default if it actually exists.
  // Otherwise fail loudly with the env/flag/config knobs spelled out.
  if (detected && existsSync(detected)) {
    return detected;
  }
  throw new Error(
    'Foundry data directory not configured. Set FOUNDRY_DATA_DIR, pass --data-dir, or run `vttforge dev` interactively to save the path to .vttforge/config.json.',
  );
}
