/**
 * Open a GitHub release for every version tag that does not have one.
 *
 * `changeset tag` creates the tags; nothing opened the releases. That job
 * belongs to `changesets/action`'s publish step, and publishing moved to a
 * separate workflow for OIDC without the release-making coming along — which
 * is why the releases page sat empty while eight versions shipped to npm.
 *
 * Notes come from the package's own CHANGELOG section for that version: the
 * text a changeset author wrote, which says why the change happened. A
 * generated file list would not.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function sh(cmd, args) {
  return execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

/** Every workspace package directory that publishes. */
function publishablePackages() {
  const dirs = [];
  for (const group of ['packages', 'apps']) {
    const root = join(REPO_ROOT, group);
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      const manifest = join(root, name, 'package.json');
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      if (pkg.private === true || !pkg.name || !pkg.version) continue;
      dirs.push({ dir: join(root, name), name: pkg.name, version: pkg.version });
    }
  }
  return dirs;
}

/**
 * The CHANGELOG section for one version.
 *
 * Changesets writes `## 1.2.3` headings, so the section runs to the next `## `.
 */
function changelogSection(dir, version) {
  const path = join(dir, 'CHANGELOG.md');
  if (!existsSync(path)) return '';
  const lines = readFileSync(path, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${version}`);
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

function releaseExists(tag) {
  try {
    sh('gh', ['release', 'view', tag, '--json', 'tagName']);
    return true;
  } catch {
    return false;
  }
}

function tagExists(tag) {
  try {
    sh('git', ['rev-parse', '--verify', `refs/tags/${tag}`]);
    return true;
  } catch {
    return false;
  }
}

let created = 0;
let skipped = 0;

for (const { dir, name, version } of publishablePackages()) {
  const tag = `${name}@${version}`;

  if (!tagExists(tag)) {
    // The tag is what `changeset tag` produces. No tag means this version was
    // not part of this release — not an error, just nothing to announce.
    skipped += 1;
    continue;
  }
  if (releaseExists(tag)) {
    skipped += 1;
    continue;
  }

  const notes = changelogSection(dir, version) || `\`${name}\` ${version}.`;
  sh('gh', ['release', 'create', tag, '--title', tag, '--notes', notes, '--verify-tag']);
  console.log(`[create-releases] opened ${tag}`);
  created += 1;
}

console.log(`[create-releases] ${created} created, ${skipped} already present or untagged`);
