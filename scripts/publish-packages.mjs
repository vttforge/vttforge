#!/usr/bin/env node
// Publishes every non-private workspace package whose version isn't
// already on the npm registry. Runs under Bun with npm OIDC trusted
// publishing (id-token: write) — bunx fetches a modern npm CLI (>=11.5.1)
// since bun publish itself doesn't yet do the OIDC exchange
// (oven-sh/bun#15601, open). bun pm pack resolves catalog:/workspace:
// protocols into real semver ranges in the packed tarball, which plain
// npm cannot do on its own.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const packagesDir = new URL('../packages/', import.meta.url).pathname;

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...opts });
}

function isPublished(name, version) {
  try {
    execFileSync('bunx', ['npm@latest', 'view', `${name}@${version}`, 'version'], {
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

  run('bunx', ['npm@latest', 'publish', join(outDir, tarball), '--access', 'public']);
  publishedCount++;
}

console.log(`\n${publishedCount} package(s) published.`);
