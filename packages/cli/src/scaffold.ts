/**
 * Template copy with `{{var}}` placeholder substitution.
 *
 * Templates live under `packages/cli/templates/<variant>/` and are shipped
 * inside the published tarball (see the `files` array in package.json).
 * Each file is read, substituted, and written to the destination directory
 * preserving the relative path. Directories are created lazily on first
 * write.
 *
 * We intentionally avoid Handlebars or any other template engine — the
 * substitution surface is small (a flat string-to-string map), and bundling
 * a dependency for ten lines of regex would be wasteful in a tool whose
 * value is being fast to invoke.
 */

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ScaffoldVars {
  ID: string;
  TITLE: string;
  DESCRIPTION: string;
  AUTHOR: string;
  LICENSE: string;
  FOUNDRY_MIN_VERSION: string;
  FOUNDRY_VERIFIED_VERSION: string;
  LOCALE_PREFIX: string;
  YEAR: string;
}

export interface ScaffoldOptions {
  /** Absolute path to the template root (e.g. `<cli-pkg>/templates/system-ts`). */
  templateDir: string;
  /** Absolute path to the destination directory. Created if it doesn't exist. */
  destDir: string;
  /** Variables to substitute into `{{NAME}}` placeholders inside template files. */
  vars: ScaffoldVars;
}

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

/**
 * Replace `{{NAME}}` placeholders in `content` using the `vars` map.
 * Unknown placeholders are passed through unchanged so partially-templated
 * files (e.g. a snippet that contains `{{handlebarsLikeSyntax}}` as literal
 * content) still scaffold without surprises.
 */
export function substitute(content: string, vars: ScaffoldVars): string {
  const lookup = vars as unknown as Record<string, string>;
  return content.replace(PLACEHOLDER_RE, (match, key: string) =>
    Object.hasOwn(lookup, key) ? (lookup[key] ?? match) : match,
  );
}

/**
 * Walk `dir` recursively and yield every file path relative to `dir`.
 */
async function* walkRelative(dir: string, base: string = dir): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkRelative(full, base);
    } else if (entry.isFile()) {
      yield relative(base, full);
    }
  }
}

/**
 * Files that should be substituted as text. Binary assets (.png, .ico, …)
 * bypass substitution and are copied byte-for-byte. The list of binary
 * extensions is intentionally small — extend if we add real binary assets
 * to templates.
 */
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
]);

function isBinaryPath(path: string): boolean {
  const dotIndex = path.lastIndexOf('.');
  if (dotIndex < 0) return false;
  return BINARY_EXTENSIONS.has(path.slice(dotIndex).toLowerCase());
}

/**
 * Files whose source name in the template is rewritten at scaffold time so
 * npm packaging doesn't strip or rename them. npm transforms `.gitignore`
 * into `.npmignore` on publish, so templates ship `_gitignore` and the
 * scaffolder writes `.gitignore` into the generated project.
 */
const SCAFFOLD_PATH_RENAMES = new Map<string, string>([['_gitignore', '.gitignore']]);

function rewriteDestRelPath(relPath: string): string {
  const base = relPath.split('/').pop() ?? relPath;
  const replacement = SCAFFOLD_PATH_RENAMES.get(base);
  if (replacement === undefined) return relPath;
  return relPath.slice(0, relPath.length - base.length) + replacement;
}

export async function scaffold({ templateDir, destDir, vars }: ScaffoldOptions): Promise<void> {
  if (!existsSync(templateDir)) {
    throw new Error(`[vttforge] template directory does not exist: ${templateDir}`);
  }
  const info = await stat(templateDir);
  if (!info.isDirectory()) {
    throw new Error(`[vttforge] template path is not a directory: ${templateDir}`);
  }

  await mkdir(destDir, { recursive: true });

  for await (const relPath of walkRelative(templateDir)) {
    const srcPath = join(templateDir, relPath);
    // Apply substitution to the path itself so we can name files like
    // `{{ID}}.code-workspace` if we ever need that — today no template path
    // uses placeholders, but the support is free. Then apply the rename map
    // so packaging-stripped names (e.g. `_gitignore`) land at their real
    // destination (e.g. `.gitignore`).
    const substituted = substitute(relPath, vars);
    const destPath = join(destDir, rewriteDestRelPath(substituted));
    await mkdir(dirname(destPath), { recursive: true });

    if (isBinaryPath(srcPath)) {
      const bytes = await readFile(srcPath);
      await writeFile(destPath, bytes);
      continue;
    }

    const content = await readFile(srcPath, 'utf8');
    await writeFile(destPath, substitute(content, vars), 'utf8');
  }
}

/**
 * Resolve the templates directory relative to this module's file URL. tsdown
 * emits `dist/scaffold.mjs`, so `import.meta.url` points there at runtime;
 * we walk up two segments to land at the package root, then descend into
 * `templates/`.
 */
export function templatesRoot(): string {
  const here = fileURLToPath(import.meta.url);
  // dist/scaffold.mjs → ../ = dist/, ../../ = package root
  return resolve(here, '..', '..', 'templates');
}
