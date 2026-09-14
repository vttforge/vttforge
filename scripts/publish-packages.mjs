#!/usr/bin/env node
// Publishes every non-private workspace package whose version isn't
// already on the npm registry. Runs under Bun with npm OIDC trusted
// publishing (id-token: write): bunx fetches npm@12 (pinned to an exact
// version, not @latest or the bare major, since a surprise npm release
// could change the OIDC exchange mid-release) because bun publish itself
// doesn't yet do the OIDC exchange (oven-sh/bun#15601, open). bun pm pack
// resolves catalog:/workspace: protocols into real semver ranges in the
// packed tarball, which plain npm cannot do on its own. Each package's own
// dependencies decide the publish order (topological, leaves first): pnpm
// publish -r did this automatically, and a plain directory scan does not.
// Each package directory also carries a copy of the root LICENSE, added at
// pack time below, since pnpm auto-copies it on publish and bun pm pack
// does not.

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const NPM = 'npm@12.0.2';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Only packages/*: every package under examples/* and apps/* is private
// today, so scanning packages/* alone matches what used to be published
// by `pnpm publish -r`. A future non-private package outside packages/
// would need this list widened (see scripts/create-releases.mjs, which
// scans both packages/ and apps/ for the same reason release notes span
// more than packages/*).
const packagesDir = join(repoRoot, 'packages');

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

async function isPublished(name, version) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`;
  const res = await fetch(url);
  if (res.status === 404) return false;
  if (res.ok) return true;
  throw new Error(`registry check for ${name}@${version} failed: HTTP ${res.status}`);
}

const dirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(packagesDir, d.name));

const pkgs = dirs
  .map((dir) => ({ dir, pkg: JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) }))
  .filter(({ pkg }) => !pkg.private);

// Topological sort (leaves first) over each package's own @vttforge/*
// dependencies, so a dependency always publishes before whatever depends
// on it. This repo's graph is two levels deep with no cycles; a cycle
// here is a workspace-structure bug this script should fail loudly on,
// not silently work around.
const byName = new Map(pkgs.map((entry) => [entry.pkg.name, entry]));
const ordered = [];
const seen = new Set();
const visiting = new Set();

function visit(name) {
  if (seen.has(name)) return;
  if (visiting.has(name)) {
    throw new Error(`circular @vttforge/* dependency detected at ${name}`);
  }
  const entry = byName.get(name);
  if (!entry) return; // dependency outside this publish set (e.g. a private package)
  visiting.add(name);
  const deps = entry.pkg.dependencies ?? {};
  for (const depName of Object.keys(deps)) {
    if (byName.has(depName)) visit(depName);
  }
  visiting.delete(name);
  seen.add(name);
  ordered.push(entry);
}

for (const { pkg } of pkgs) visit(pkg.name);

let publishedCount = 0;

for (const { dir, pkg } of ordered) {
  if (await isPublished(pkg.name, pkg.version)) {
    console.log(`skip ${pkg.name}@${pkg.version} (already on npm)`);
    continue;
  }

  console.log(`publishing ${pkg.name}@${pkg.version}...`);

  copyFileSync(join(repoRoot, 'LICENSE'), join(dir, 'LICENSE'));

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
