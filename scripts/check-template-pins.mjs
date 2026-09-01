#!/usr/bin/env node
/**
 * Keep the scaffolding templates pinned to versions that will exist.
 *
 * The templates under `packages/cli/templates/*` name `@vttforge/*` ranges for
 * the project they generate. Every one of those packages is on 0.x, where a
 * caret pins the MINOR — `^0.4.0` means `>=0.4.0 <0.5.0`. So a release taking
 * core to 0.5.0 leaves every template asking for a version that release just
 * superseded, and nothing notices: no CI job builds a scaffolded project, so
 * it only surfaces after publishing.
 *
 * This has landed three times. The check compares each pin against the version
 * the NEXT release will publish, not the current one — because between fixing a
 * pin and the release landing, the pin legitimately names a version that does
 * not exist yet, and comparing against the current version would fail exactly
 * then.
 *
 * Those planned versions come from `changeset status --output`, which is
 * changesets' own logic and mutates nothing. Packages with no pending release
 * fall back to their current version.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getReleasePlan from '@changesets/get-release-plan';
import semver from 'semver';

// This is a command-line check. Its console output is the whole point — there
// is no other channel to report a bad pin through.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const templatesDir = join(repoRoot, 'packages', 'cli', 'templates');
const packagesDir = join(repoRoot, 'packages');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Current version of every workspace package, keyed by published name. */
function currentVersions() {
  const out = new Map();
  for (const dir of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    try {
      const pkg = readJson(join(packagesDir, dir.name, 'package.json'));
      if (pkg.name) out.set(pkg.name, pkg.version);
    } catch {
      // Not a package directory. Nothing to record.
    }
  }
  return out;
}

/**
 * What the next release publishes, per package.
 *
 * Calls changesets' own release-plan rather than reimplementing its bump
 * rules — getting those subtly wrong would make this check lie in the same
 * direction as the bug it exists to catch.
 *
 * The plan API is used instead of `changeset status` on purpose. That command
 * additionally works out where HEAD diverged from the base branch, which needs
 * a full clone and fails on CI's shallow checkout — and that step answers a
 * question this check never asks.
 *
 * The version here deliberately matches the one `@changesets/cli` depends on,
 * so this computes the same plan the real release will. Bumping it ahead of
 * the CLI would defeat the point.
 */
async function plannedVersions() {
  const fn = getReleasePlan.default ?? getReleasePlan;
  try {
    const plan = await fn(repoRoot);
    return new Map((plan.releases ?? []).map((r) => [r.name, r.newVersion]));
  } catch (err) {
    // A plan that cannot be read must not pass as "nothing pending" — that
    // would report success precisely when nothing can be seen.
    console.error('Could not compute the release plan.');
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exit(1);
  }
}

const current = currentVersions();
const planned = await plannedVersions();
const problems = [];

for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifestPath = join(templatesDir, entry.name, 'package.json');
  let pkg;
  try {
    pkg = readJson(manifestPath);
  } catch {
    continue;
  }

  for (const group of ['dependencies', 'devDependencies']) {
    for (const [name, range] of Object.entries(pkg[group] ?? {})) {
      if (!current.has(name)) continue;
      const target = planned.get(name) ?? current.get(name);
      if (semver.satisfies(target, range)) continue;
      problems.push({
        template: entry.name,
        name,
        range,
        target,
        pending: planned.has(name),
      });
    }
  }
}

if (problems.length === 0) {
  console.log(`Template pins OK — ${current.size} workspace packages checked.`);
  process.exit(0);
}

console.error('Template pins name versions the next release will not publish:\n');
for (const p of problems) {
  const where = p.pending ? 'the pending release publishes' : 'the workspace is on';
  console.error(`  ${p.template}: ${p.name} pinned "${p.range}", but ${where} ${p.target}`);
}
console.error(
  '\nOn a 0.x version a caret pins the minor, so a minor bump falls outside the range.',
);
console.error('Update the pin in packages/cli/templates/*/package.json to match.');
process.exit(1);
