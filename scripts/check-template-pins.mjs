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
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
 * Runs changesets rather than reimplementing its bump rules — getting those
 * subtly wrong would make this check lie in the same direction as the bug it
 * exists to catch.
 */
function plannedVersions() {
  const dir = mkdtempSync(join(tmpdir(), 'vttforge-pins-'));
  const file = join(dir, 'plan.json');
  try {
    execFileSync(
      join(repoRoot, 'node_modules', '.bin', 'changeset'),
      ['status', '--output', file],
      {
        cwd: repoRoot,
        stdio: 'pipe',
      },
    );
    const plan = readJson(file);
    return new Map((plan.releases ?? []).map((r) => [r.name, r.newVersion]));
  } catch (err) {
    // A broken plan must not pass silently as "nothing pending" — that would
    // make this check report success precisely when it cannot see anything.
    // Print what the tool actually said: swallowing its stderr once already
    // turned a one-line CI failure into a guessing game.
    console.error('Could not read the release plan from changesets.');
    const stderr = err?.stderr?.toString().trim();
    const stdout = err?.stdout?.toString().trim();
    if (stderr) console.error(stderr);
    if (stdout) console.error(stdout);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const current = currentVersions();
const planned = plannedVersions();
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
