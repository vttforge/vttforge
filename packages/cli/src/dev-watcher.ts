/**
 * Watch the build output and turn each change into a reload payload.
 *
 * Watching `dist/` rather than hooking into Vite is deliberate: Vite rebuilds
 * into that directory whatever its internals look like, so this stays correct
 * across bundler versions and gives the served path directly — `dist/` is what
 * Foundry mounts, so a file's position inside it is its position under
 * `/systems/<id>/`.
 */
import { type FSWatcher, watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, posix, sep } from 'node:path';

/** What the dev module knows how to apply without a page reload. */
const RELOADABLE = new Set(['css', 'hbs', 'html', 'json']);

/**
 * Editors save in bursts — write, rename, truncate — and a burst should be
 * one reload, not four.
 */
const DEBOUNCE_MS = 40;

export interface WatchOptions {
  distDir: string;
  packageId: string;
  packageType: 'system' | 'module';
  /** Called once per settled change with the JSON frame to send. */
  onPayload: (frame: string) => void;
  onError?: (message: string) => void;
  debounceMs?: number;
}

export interface DistWatcher {
  close: () => void;
}

/**
 * The path Foundry serves this file at.
 *
 * Always POSIX separators — it becomes a URL, and a Windows backslash would
 * not match the `<link>` the browser rendered.
 */
export function servedPath(
  relative: string,
  packageId: string,
  packageType: 'system' | 'module',
): string {
  const normalized = relative.split(sep).join(posix.sep);
  return posix.join(`${packageType}s`, packageId, normalized);
}

/** Extension without the dot, lowercased. Empty when there is none. */
export function reloadableExtension(relative: string): string | null {
  const ext = extname(relative).replace('.', '').toLowerCase();
  return RELOADABLE.has(ext) ? ext : null;
}

export function watchDist(options: WatchOptions): DistWatcher {
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS;
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  const send = async (relative: string): Promise<void> => {
    const extension = reloadableExtension(relative);
    if (!extension) return;
    let content: string;
    try {
      content = await readFile(join(options.distDir, relative), 'utf8');
    } catch {
      // The file was renamed or removed between the event and the read.
      // Nothing to send, and nothing worth interrupting the developer for.
      return;
    }
    options.onPayload(
      JSON.stringify({
        packageType: options.packageType,
        packageId: options.packageId,
        content,
        path: servedPath(relative, options.packageId, options.packageType),
        extension,
      }),
    );
  };

  let watcher: FSWatcher;
  try {
    watcher = watch(options.distDir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const relative = filename.toString();
      clearTimeout(pending.get(relative));
      pending.set(
        relative,
        setTimeout(() => {
          pending.delete(relative);
          void send(relative);
        }, debounceMs),
      );
    });
  } catch (err) {
    options.onError?.(err instanceof Error ? err.message : String(err));
    return { close: () => undefined };
  }

  return {
    close: () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
      watcher.close();
    },
  };
}
