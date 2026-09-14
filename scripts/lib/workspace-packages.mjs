// Shared by scripts/publish-packages.mjs, scripts/create-releases.mjs and
// scripts/check-template-pins.mjs, which each need "every package.json
// under these workspace directories" but disagree on which directories,
// which fields, and whether private packages count — that filtering stays
// in each caller. This just does the walk-and-parse part identically.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every package.json found one level under each of `dirNames` (each
 * resolved relative to `repoRoot`). A directory that doesn't exist, or a
 * subdirectory with no valid package.json, is skipped rather than thrown
 * on: neither is an error in a workspace layout that's still growing.
 */
export function listWorkspacePackages(repoRoot, dirNames) {
  const out = [];
  for (const dirName of dirNames) {
    const root = join(repoRoot, dirName);
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = join(root, entry.name);
      let pkg;
      try {
        pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      } catch {
        continue;
      }
      out.push({ dir, pkg });
    }
  }
  return out;
}
