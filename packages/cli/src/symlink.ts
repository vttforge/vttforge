/**
 * Cross-platform symlink helpers for `vttforge dev`.
 *
 * The dev loop drops a symlink from Foundry's `Data/<systems|modules>/<id>/`
 * back to the project's `dist/` so Foundry serves freshly-built files as
 * vite writes them. The win32 path matters: with `type: 'junction'` the
 * operation works on standard Windows shells without Developer Mode, while
 * `type: 'dir'` requires admin. We never silently fall back to copying;
 * Foundry's HMR relies on live file mutation, and a copy snapshot defeats
 * the loop. If the symlink fails, we surface the platform-specific fix.
 */

import { lstat, mkdir, readlink, symlink, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface CreateLinkOptions {
  /**
   * Overwrite an existing symlink that points elsewhere. Real files and
   * directories are never overwritten; that path needs explicit user
   * action outside the tool.
   */
  overwrite?: boolean;
}

/**
 * Read a symlink target. Returns the absolute path the link points at, or
 * `null` if `path` doesn't exist or isn't a symlink. Relative symlink
 * targets are resolved against the link's own directory (matches the
 * semantics callers expect when comparing to a known absolute source).
 */
export async function readLinkTarget(path: string): Promise<string | null> {
  try {
    const info = await lstat(path);
    if (!info.isSymbolicLink()) return null;
    const target = await readlink(path);
    return resolve(dirname(path), target);
  } catch {
    return null;
  }
}

/**
 * Create a symlink at `target` pointing to `source`. Win32 uses `'junction'`
 * so the call succeeds without elevation; everywhere else uses `'dir'`.
 *
 * Idempotency:
 *   - target already points to source → no-op
 *   - target points elsewhere → throws unless `options.overwrite`
 *   - target is a real file/dir → throws unconditionally
 */
export async function createLink(
  target: string,
  source: string,
  options: CreateLinkOptions = {},
): Promise<void> {
  const absSource = resolve(source);
  const absTarget = resolve(target);

  let info: Awaited<ReturnType<typeof lstat>> | null;
  try {
    info = await lstat(absTarget);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      info = null;
    } else {
      throw err;
    }
  }

  if (info?.isSymbolicLink()) {
    const existing = await readLinkTarget(absTarget);
    if (existing === absSource) return;
    if (!options.overwrite) {
      throw new Error(
        `Symlink already exists at ${absTarget} pointing to ${existing}. Pass { overwrite: true } or remove it manually.`,
      );
    }
    await unlink(absTarget);
  } else if (info) {
    const kind = info.isDirectory() ? 'directory' : 'file';
    throw new Error(`Refusing to overwrite ${absTarget}: path exists as a ${kind}, not a symlink.`);
  }

  await mkdir(dirname(absTarget), { recursive: true });

  const linkType: 'dir' | 'junction' = process.platform === 'win32' ? 'junction' : 'dir';
  try {
    await symlink(absSource, absTarget, linkType);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM' && process.platform === 'win32') {
      throw new Error(
        `Could not create symlink at ${absTarget}: permission denied. On Windows, enable Developer Mode (Settings → Update & Security → For Developers) or relaunch the terminal as administrator.`,
      );
    }
    throw err;
  }
}

/**
 * Remove a symlink at `path`. No-ops when the path doesn't exist. Throws
 * when the path exists but isn't a symlink; we never unlink real files
 * or directories.
 */
export async function removeLink(path: string): Promise<void> {
  let info: Awaited<ReturnType<typeof lstat>>;
  try {
    info = await lstat(path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }
  if (!info.isSymbolicLink()) {
    const kind = info.isDirectory() ? 'directory' : 'file';
    throw new Error(`Refusing to remove ${path}: it is a ${kind}, not a symlink.`);
  }
  await unlink(path);
}
