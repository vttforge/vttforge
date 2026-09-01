/**
 * Watch the build output and turn each change into a reload payload.
 *
 * Watching `dist/` rather than hooking into Vite is deliberate: Vite rebuilds
 * into that directory whatever its internals look like, so this stays correct
 * across bundler versions and gives the served path directly — `dist/` is what
 * Foundry mounts, so a file's position inside it is its position under
 * `/systems/<id>/`.
 */
import { createHash } from 'node:crypto';
import { existsSync, type FSWatcher, readdirSync, readFileSync, watch } from 'node:fs';
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

const digest = (content: string): string => createHash('sha1').update(content).digest('hex');

/**
 * Record what every reloadable file already contains.
 *
 * Vite rewrites its whole output on each build, so without a baseline the
 * first rebuild after startup looks like every file changed at once.
 *
 * Read synchronously and before the watcher exists, on purpose. Doing it
 * asynchronously races the very first change: the walk can pick up a file
 * written a moment ago and then the change event finds a matching hash and
 * drops a real edit. The output tree is small; correctness is worth the wait.
 */
function seedDigests(distDir: string): Map<string, string> {
  const seen = new Map<string, string>();
  const walk = (dir: string, prefix: string): void => {
    let items: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      items = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const rel = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.isDirectory()) {
        walk(join(dir, item.name), rel);
        continue;
      }
      if (!reloadableExtension(rel)) continue;
      try {
        seen.set(rel, digest(readFileSync(join(distDir, rel), 'utf8')));
      } catch {
        // Unreadable now; the first change will record it.
      }
    }
  };
  walk(distDir, '');
  return seen;
}

export function watchDist(options: WatchOptions): DistWatcher {
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS;
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  /**
   * Last content seen per file.
   *
   * A rebuild rewrites every output file, changed or not, so the filesystem
   * event alone says "the bundler ran", not "the developer edited this".
   * Comparing content is what makes a reload mean the second thing — and it
   * matters: a language file rewritten untouched would redraw every open
   * window, undoing the scoped re-render on the file that did change.
   */
  const digests = seedDigests(options.distDir);

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

    const hash = digest(content);
    if (digests.get(relative) === hash) return;
    digests.set(relative, hash);

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

  // Platforms disagree about a missing directory: macOS throws from `watch`,
  // Linux hands back a watcher that reports nothing at all. Checking first
  // gives the same answer everywhere instead of relying on either.
  if (!existsSync(options.distDir)) {
    options.onError?.(`Cannot watch ${options.distDir} — the directory does not exist.`);
    return { close: () => undefined };
  }

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

  // Platforms disagree about how a bad path surfaces: macOS throws from
  // `watch` itself, Linux hands back a watcher that emits `error` a tick
  // later. Handling only the throw means a missing dist/ fails silently on
  // Linux — which is where CI runs.
  watcher.on('error', (err: unknown) => {
    options.onError?.(err instanceof Error ? err.message : String(err));
  });

  return {
    close: () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
      watcher.close();
    },
  };
}
