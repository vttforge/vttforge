/**
 * Read a built manifest (`dist/system.json` or `dist/module.json`).
 *
 * The vite plugin emits the manifest into `dist/` during build, so the CLI
 * commands that come after a build (dev's initial symlink, build's release
 * zip) read from there rather than walking source. This file is intentionally
 * tiny: we extract just the fields the CLI cares about and surface the
 * rest as `raw` for any consumer that wants more.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type PackageType = 'system' | 'module';

export interface FoundryManifest {
  /** Manifest id: folder name Foundry serves the package under. */
  id: string;
  /** Semver-ish version string from the manifest. */
  version: string;
  /** Detected from which filename was present in dist/. */
  type: PackageType;
  /** Full parsed JSON for callers that need extra fields (compatibility, etc.). */
  raw: Record<string, unknown>;
}

const MANIFEST_FILES: ReadonlyArray<{ file: string; type: PackageType }> = [
  { file: 'system.json', type: 'system' },
  { file: 'module.json', type: 'module' },
];

// Foundry package ids are folder names. We mirror what `vttforge init`
// allows (lowercase letters, digits, dashes, plus dot/underscore for
// legacy packages) and reject anything that would let `join()` escape
// the intended Data/<systems|modules>/ folder: slashes, backslashes,
// `..` traversal, null bytes, whitespace, control chars.
const MANIFEST_ID_RE = /^[a-z][a-z0-9._-]*$/;
// Version strings end up in the release zip filename. Allow the common
// semver alphabet (`1.2.3-beta.1+abc123`) and reject anything else for
// the same reason: `join(cwd, `${id}-${version}.zip`)` must not climb
// out of cwd.
const MANIFEST_VERSION_RE = /^[0-9A-Za-z._+-]+$/;

/**
 * Locate and parse the Foundry manifest inside the given dist directory.
 * Prefers `system.json`, falls back to `module.json` (a single dist can't
 * be both; the vite plugin emits exactly one based on the project type).
 *
 * Throws if neither file exists, required fields are missing/non-string,
 * or the id/version contain characters that would let downstream `join()`
 * calls escape their intended directory.
 */
export async function readManifest(distDir: string): Promise<FoundryManifest> {
  for (const { file, type } of MANIFEST_FILES) {
    const path = join(distDir, file);
    if (!existsSync(path)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(path, 'utf8'));
    } catch (err) {
      throw new Error(
        `Failed to parse ${path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`Manifest at ${path} is not a JSON object.`);
    }
    const raw = parsed as Record<string, unknown>;
    const id = raw.id;
    const version = raw.version;
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`Manifest at ${path} is missing a non-empty "id" field.`);
    }
    if (!MANIFEST_ID_RE.test(id)) {
      throw new Error(
        `Manifest at ${path} has an invalid "id" (${JSON.stringify(id)}). Foundry package ids must match ${MANIFEST_ID_RE}: lowercase letters, digits, dashes, dots, underscores; must start with a letter.`,
      );
    }
    if (typeof version !== 'string' || version.length === 0) {
      throw new Error(`Manifest at ${path} is missing a non-empty "version" field.`);
    }
    if (!MANIFEST_VERSION_RE.test(version)) {
      throw new Error(
        `Manifest at ${path} has an invalid "version" (${JSON.stringify(version)}). Use a semver-ish string with letters, digits, dots, dashes, plus, or underscore.`,
      );
    }
    return { id, version, type, raw };
  }
  throw new Error(
    `No Foundry manifest found in ${distDir}. Expected system.json or module.json. Did you run \`vite build\` first?`,
  );
}
