#!/usr/bin/env node
// Publishes every non-private workspace package whose version isn't
// already on the npm registry. Runs under Bun with npm OIDC trusted
// publishing (id-token: write) — bunx fetches npm@12 (pinned, not
// @latest: a surprise npm major could change `view`'s exit codes or the
// OIDC exchange mid-release) since bun publish itself doesn't yet do the
// OIDC exchange (oven-sh/bun#15601, open). bun pm pack resolves
// catalog:/workspace: protocols into real semver ranges in the packed
// tarball, which plain npm cannot do on its own. Each package directory
// also carries its own copy of the root LICENSE: pnpm auto-copies it on
// publish, bun pm pack does not, so a package-local copy is required for
// the published tarball to carry one.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NPM = 'npm@12';

// Only packages/*: every package under examples/* and apps/* is private
// today, so scanning packages/* alone matches what used to be published
// by `pnpm publish -r`. A future non-private package outside packages/
// would need this list widened (see scripts/create-releases.mjs, which
// scans both packages/ and apps/ for the same reason release notes span
// more than packages/*).
const packagesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'packages');

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function isPublished(name, version) {
  try {
    execFileSync('bunx', [NPM, 'view', `${name}@${version}`, 'version'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

const pkgDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(packagesDir, d.name));

let publishedCount = 0;

for (const dir of pkgDirs) {
  const pkgJsonPath = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));

  if (pkg.private) {
    console.log(`skip ${pkg.name} (private)`);
    continue;
  }

  if (isPublished(pkg.name, pkg.version)) {
    console.log(`skip ${pkg.name}@${pkg.version} (already on npm)`);
    continue;
  }

  console.log(`publishing ${pkg.name}@${pkg.version}...`);

  const outDir = mkdtempSync(join(tmpdir(), 'vttforge-publish-'));
  run('bun', ['pm', 'pack', '--destination', outDir, '--quiet'], { cwd: dir });

  const tarball = readdirSync(outDir).find((f) => f.endsWith('.tgz'));
  if (!tarball) {
    throw new Error(`bun pm pack produced no tarball for ${pkg.name} in ${outDir}`);
  }

  run('bunx', [NPM, 'publish', join(outDir, tarball), '--access', 'public']);
  publishedCount++;
}

console.log(`\n${publishedCount} package(s) published.`);
