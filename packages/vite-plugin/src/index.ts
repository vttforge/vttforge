/**
 * @vttforge/vite-plugin
 *
 * Vite plugin that takes a Foundry v13+ system or module source tree and emits
 * a fully bundled, Foundry-loadable artifact in `dist/`:
 *
 *   - browser ESM entry at `dist/main.mjs` (no hash)
 *   - bundled CSS at `dist/styles/<name>.css` with bare specifiers like
 *     `@import "@vttforge/styles"` resolved at build time
 *   - manifest (`system.json` / `module.json`) copied to `dist/` with
 *     `version` synced from `package.json` and `esmodules` / `styles`
 *     rewritten to the bundled output paths
 *   - `template.json`, `lang/`, `templates/` copied verbatim
 *
 * Browsers cannot resolve bare module specifiers, so a Foundry-served system
 * must ship a fully-resolved bundle. This plugin owns that contract so
 * consumers can write idiomatic `import { x } from '@vttforge/core'` and
 * `@import "@vttforge/styles"` without thinking about it.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import { version } from '../package.json' with { type: 'json' };

export interface VttforgeOptions {
  /**
   * Foundry package id. Must match the `id` declared in the manifest
   * (`system.json` for systems, `module.json` for modules) and the folder
   * Foundry serves the package from.
   */
  id: string;
  /**
   * Whether this is a Foundry system (default) or module. Determines the
   * Foundry base path used for chunk resolution (`/systems/<id>/` vs
   * `/modules/<id>/`) and the default manifest filename.
   */
  kind?: 'system' | 'module';
  /**
   * Entry JS file relative to the project root. Default: `scripts/main.mjs`.
   */
  entry?: string;
  /**
   * Path to the manifest file relative to the project root. Default:
   * `system.json` (when `kind === 'system'`) or `module.json` (when
   * `kind === 'module'`).
   */
  manifest?: string;
  /**
   * Paths copied verbatim to `dist/` at the start of every build. Each entry
   * may be a file or a directory; directories are copied recursively.
   * Default: `['template.json', 'lang', 'templates']`. The manifest is
   * always copied separately so the version sync hook can rewrite it.
   */
  staticAssets?: string[];
}

interface ResolvedOptions {
  id: string;
  kind: 'system' | 'module';
  entry: string;
  manifest: string;
  staticAssets: string[];
  root: string;
  outDir: string;
}

const DEFAULT_STATIC = ['template.json', 'lang', 'templates'];

const JS_ENTRY_FILENAME = 'main.mjs';

function resolveOptions(options: VttforgeOptions, root: string): ResolvedOptions {
  if (!options.id || typeof options.id !== 'string') {
    throw new Error('[vttforge] `id` option is required and must be a non-empty string.');
  }
  const kind = options.kind ?? 'system';
  if (kind !== 'system' && kind !== 'module') {
    throw new Error(`[vttforge] \`kind\` must be 'system' or 'module', got '${kind}'.`);
  }
  const entry = options.entry ?? 'scripts/main.mjs';
  const manifest = options.manifest ?? (kind === 'system' ? 'system.json' : 'module.json');
  const staticAssets = options.staticAssets ?? DEFAULT_STATIC;
  return {
    id: options.id,
    kind,
    entry,
    manifest,
    staticAssets,
    root,
    outDir: resolve(root, 'dist'),
  };
}

function readJsonSafe(path: string): Record<string, unknown> | null {
  try {
    const raw = readFileSync(path, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Foundry v13 accepts either a legacy string (`"styles/foo.css"`) or the
 * canonical object form (`{ src: "styles/foo.css", layer?: "..." }`) in the
 * manifest `styles` array. We accept both inputs and emit the object form,
 * which is what Foundry expects natively in v13 (the string form auto-migrates
 * with a deprecation warning). Any additional metadata declared on an object
 * entry (e.g. `layer` for cascade layer placement) is preserved through the
 * rewrite so consumers keep full control of stylesheet metadata.
 */
interface StyleEntry {
  src: string;
  [key: string]: unknown;
}

function normalizeStyleEntry(entry: unknown): StyleEntry | null {
  if (typeof entry === 'string') return { src: entry };
  if (entry && typeof entry === 'object' && 'src' in entry) {
    const src = (entry as { src: unknown }).src;
    if (typeof src === 'string') return { ...(entry as Record<string, unknown>), src };
  }
  return null;
}

function extractStyleEntries(rawStyles: unknown): StyleEntry[] {
  if (!Array.isArray(rawStyles)) return [];
  const result: StyleEntry[] = [];
  for (const entry of rawStyles) {
    const normalized = normalizeStyleEntry(entry);
    if (normalized !== null) result.push(normalized);
  }
  return result;
}

async function copyStatic(opts: ResolvedOptions): Promise<void> {
  await mkdir(opts.outDir, { recursive: true });
  for (const entry of opts.staticAssets) {
    const src = resolve(opts.root, entry);
    if (!existsSync(src)) continue;
    const dest = resolve(opts.outDir, entry);
    await cp(src, dest, { recursive: true });
  }
}

async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function collectWatchPaths(opts: ResolvedOptions): Promise<string[]> {
  const paths: string[] = [resolve(opts.root, opts.manifest)];
  for (const entry of opts.staticAssets) {
    const abs = resolve(opts.root, entry);
    if (!existsSync(abs)) continue;
    const info = await stat(abs);
    if (info.isDirectory()) {
      for await (const file of walkFiles(abs)) paths.push(file);
    } else if (info.isFile()) {
      paths.push(abs);
    }
  }
  return paths;
}

interface ManifestSyncResult {
  /** Resolved CSS entry paths (relative to project root) discovered in the manifest. */
  styles: string[];
}

function syncManifest(opts: ResolvedOptions, builtCssSources: Set<string>): ManifestSyncResult {
  const manifestSrc = resolve(opts.root, opts.manifest);
  // Always emit the manifest at the dist root under Foundry's canonical
  // filename: Foundry only discovers a package via `<dist>/system.json` or
  // `<dist>/module.json`, regardless of where (or under what name) the
  // source manifest lives.
  const canonicalFilename = opts.kind === 'system' ? 'system.json' : 'module.json';
  const manifestDest = resolve(opts.outDir, canonicalFilename);
  const manifest = readJsonSafe(manifestSrc);
  if (!manifest) {
    throw new Error(`[vttforge] Could not read manifest at ${manifestSrc}`);
  }
  if (manifest.id !== opts.id) {
    throw new Error(
      `[vttforge] Manifest id '${String(manifest.id)}' does not match plugin option id '${opts.id}'.`,
    );
  }
  const pkg = readJsonSafe(resolve(opts.root, 'package.json'));
  if (pkg && typeof pkg.version === 'string') {
    manifest.version = pkg.version;
  }
  manifest.esmodules = [JS_ENTRY_FILENAME];
  const originalStyles = extractStyleEntries(manifest.styles);
  const cssEntries: string[] = [];
  const rewrittenStyles: StyleEntry[] = [];
  const seenBasenames = new Set<string>();
  for (const styleEntry of originalStyles) {
    const stylePath = styleEntry.src;
    const cssBasename = basename(stylePath);
    if (seenBasenames.has(cssBasename)) {
      throw new Error(
        `[vttforge] Stylesheet basename collision: '${cssBasename}' is declared by multiple entries in the manifest (e.g. '${stylePath}'). Rename one of them so the bundled output is unambiguous.`,
      );
    }
    seenBasenames.add(cssBasename);
    // Watch mode: only emit manifest entries for stylesheets that were in the
    // rollup input graph at config() time. Compare full source paths (not
    // basenames) so that swapping `styles/main.css` for `themes/main.css`
    // also trips the restart warning instead of silently shipping stale CSS
    // under the same basename.
    if (!builtCssSources.has(stylePath)) {
      console.warn(
        `[vttforge] Manifest declares stylesheet '${stylePath}' but the current build did not include it (added or repointed after Vite started). Restart the build to pick up the change.`,
      );
      continue;
    }
    cssEntries.push(stylePath);
    // Preserve any additional metadata (e.g. `layer`) declared on the source
    // entry; only the path is rewritten to point at the bundled output.
    rewrittenStyles.push({ ...styleEntry, src: `styles/${cssBasename}` });
  }
  manifest.styles = rewrittenStyles;
  writeFileSync(manifestDest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { styles: cssEntries };
}

/**
 * Vite plugin for Foundry VTT systems and modules.
 *
 * @example
 * ```js
 * // vite.config.mjs
 * import { defineConfig } from 'vite';
 * import vttforge from '@vttforge/vite-plugin';
 *
 * export default defineConfig({
 *   plugins: [vttforge({ id: 'my-system' })],
 * });
 * ```
 */
export default function vttforge(options: VttforgeOptions): Plugin {
  let resolved: ResolvedOptions;
  let cssEntries: string[] = [];
  let builtCssSources: Set<string> = new Set();

  return {
    name: '@vttforge/vite-plugin',
    enforce: 'pre',
    config(userConfig, { command }): UserConfig {
      const root = userConfig.root ? resolve(userConfig.root) : process.cwd();
      resolved = resolveOptions(options, root);
      const entryAbs = resolve(root, resolved.entry);
      if (!existsSync(entryAbs)) {
        throw new Error(`[vttforge] Entry file not found: ${entryAbs}`);
      }
      const manifestAbs = resolve(root, resolved.manifest);
      const manifest = readJsonSafe(manifestAbs);
      cssEntries = extractStyleEntries(manifest?.styles).map((e) => e.src);
      const cssAbsInput = cssEntries.map((s) => resolve(root, s));

      // Use flat input keys so Rollup emits assets by their basename only.
      // The `styles/[name][extname]` assetFileNames rule then adds the styles/
      // prefix exactly once. `node:path.basename` is path-separator safe on
      // Windows (`split('/').pop()` is not).
      const rollupInput: Record<string, string> = { [JS_ENTRY_FILENAME]: entryAbs };
      const seenCssKeys = new Set<string>();
      builtCssSources = new Set(cssEntries);
      for (let i = 0; i < cssAbsInput.length; i += 1) {
        const cssAbs = cssAbsInput[i] as string;
        const base = basename(cssAbs);
        const key = base.replace(/\.css$/, '');
        if (seenCssKeys.has(key)) {
          throw new Error(
            `[vttforge] Stylesheet basename collision: two CSS entries resolve to '${base}'. Rename one of them so the bundled output is unambiguous.`,
          );
        }
        seenCssKeys.add(key);
        rollupInput[key] = cssAbs;
      }

      const baseUrl = `/${resolved.kind}s/${resolved.id}/`;
      const isWatch = command === 'serve' || Boolean(userConfig.build?.watch);
      return {
        root,
        base: baseUrl,
        publicDir: false,
        appType: 'custom',
        css: { devSourcemap: true },
        build: {
          outDir: resolved.outDir,
          emptyOutDir: true,
          sourcemap: true,
          minify: command === 'build' && !isWatch,
          target: 'es2022',
          cssCodeSplit: true,
          rollupOptions: {
            input: rollupInput,
            output: {
              // Foundry reads class names at runtime, and the minifier does
              // not promise the same one twice. A registered sheet is keyed by
              // `${package id}.${class name}` and that key is saved on every
              // document using it, so a rename orphans the reader's choice.
              // `registerSheets` fixes the name for that case; this keeps every
              // other one honest: a stack trace, an instanceof error message,
              // a prototype chain someone reads while debugging.
              keepNames: true,
              entryFileNames: (chunkInfo) => {
                if (chunkInfo.name === JS_ENTRY_FILENAME) return JS_ENTRY_FILENAME;
                return '[name]';
              },
              chunkFileNames: 'chunks/[name].mjs',
              assetFileNames: (asset) => {
                // Rollup 4 surfaces every name an asset can take via `names`.
                // `name` is kept as a deprecated alias to `names[0]`; we read
                // `names[0]` directly so the callback stays correct when
                // Rollup eventually removes the alias.
                const name = asset.names[0] ?? 'asset';
                if (name.endsWith('.css')) return 'styles/[name][extname]';
                return 'assets/[name][extname]';
              },
              format: 'es',
            },
            // Foundry's browser ESM loader can't resolve bare specifiers, so
            // every dependency must be bundled in. Vite's library mode keeps
            // `dependencies` external by default; override by leaving the
            // rollup external list empty.
            external: [],
          },
        },
      };
    },
    async buildStart() {
      // Pull the manifest + every static file into Rollup's watch graph so
      // edits to `templates/`, `lang/`, `template.json`, or the manifest
      // itself trigger a rebuild in `vite build --watch`. Without this, dist/
      // goes stale when the consumer changes anything outside the JS/CSS
      // graph and Foundry keeps serving the old artifact.
      const watchPaths = await collectWatchPaths(resolved);
      for (const path of watchPaths) {
        this.addWatchFile(path);
      }
    },
    async writeBundle() {
      // Runs after Vite has written the bundled JS / CSS. Copy static assets
      // and sync the manifest now so they aren't wiped by Vite's outDir
      // bookkeeping (which can clear non-bundled files mid-build).
      await copyStatic(resolved);
      const result = syncManifest(resolved, builtCssSources);
      if (result.styles.length !== cssEntries.length) {
        console.warn(
          `[vttforge] Manifest declared ${result.styles.length} style entries, plugin saw ${cssEntries.length}.`,
        );
      }
    },
  };
}

export const VTTFORGE_VITE_PLUGIN_VERSION: string = version;
