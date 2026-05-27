/**
 * `vttforge build` — emit a foundryvtt.com-ready release zip.
 *
 * Flow:
 *   1. Clean dist/
 *   2. Run `vite build` (production mode)
 *   3. Read the resulting manifest → id + version
 *   4. Zip dist/ + LICENSE/README/CHANGELOG (if present) into
 *      `<cwd>/<id>-<version>.zip` with contents at the zip root
 *
 * The release workflows shipped by the templates upload this zip to a
 * GitHub release; the manifest URL points at `releases/latest/download/`
 * so Foundry's auto-update catches new versions.
 */

import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import { type FoundryManifest, readManifest } from '../manifest.js';
import { runViteBuildOnce } from '../vite-runner.js';
import { emitZip } from '../zip.js';

export interface BuildOptions {
  /** Override the project root. Defaults to `process.cwd()`. */
  cwd?: string;
}

/** Files we copy into the zip at root when they exist at project root. */
export const RELEASE_ZIP_EXTRAS = ['LICENSE', 'README.md', 'CHANGELOG.md'];

/** Format a byte count as `12 B`, `4.3 KB`, or `1.2 MB`. */
function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return `${n} B`;
  const units = ['B', 'KB', 'MB'] as const;
  let v = n;
  let unitIndex = 0;
  while (v >= 1024 && unitIndex < units.length - 1) {
    v /= 1024;
    unitIndex += 1;
  }
  return `${v.toFixed(v >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Internal building block exposed for tests: assumes dist/ is already
 * populated (vite has run, manifest is present) and just emits the zip.
 */
export async function emitReleaseZip(opts: {
  cwd: string;
}): Promise<{ zipFile: string; byteSize: number; manifest: FoundryManifest }> {
  const cwd = resolve(opts.cwd);
  const distDir = join(cwd, 'dist');
  const manifest = await readManifest(distDir);
  const zipName = `${manifest.id}-${manifest.version}.zip`;
  const zipFile = join(cwd, zipName);
  const { byteSize } = await emitZip({
    sourceDir: distDir,
    outFile: zipFile,
    extras: RELEASE_ZIP_EXTRAS,
    extrasFrom: cwd,
  });
  return { zipFile, byteSize, manifest };
}

export async function runBuild(options: BuildOptions = {}): Promise<void> {
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  p.intro('🜲 vttforge build — release zip');

  const distDir = join(cwd, 'dist');

  // Wipe dist/ so stale files from a previous dev session don't sneak
  // into a tagged release zip.
  await rm(distDir, { recursive: true, force: true });

  const buildSpinner = p.spinner();
  buildSpinner.start('vite build (production)');
  try {
    await runViteBuildOnce(cwd);
    buildSpinner.stop('Build complete');
  } catch (err) {
    buildSpinner.stop('Build failed');
    throw err;
  }

  const { zipFile, byteSize } = await emitReleaseZip({ cwd });

  p.note(`${zipFile}\n${formatBytes(byteSize)}`, 'Release artifact');
  p.outro(
    `Upload this zip to your release. The release workflow shipped with the template handles tag→GitHub Release → foundryvtt.com manifest update.`,
  );
}
