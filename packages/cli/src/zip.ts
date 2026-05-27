/**
 * Emit a foundryvtt.com-compatible release zip.
 *
 * foundryvtt.com expects the package contents at the zip root (no wrapper
 * folder), so `unzip release.zip` produces `system.json`, `scripts/`, etc.
 * directly. The vite build output already matches that layout, so we feed
 * `dist/` straight into archiver with `false` as the second arg to disable
 * the wrap-with-source-dir-name default.
 *
 * Optional extras (LICENSE / README / CHANGELOG) ride along when present at
 * the project root and not already inside `dist/`. We never duplicate.
 */

import { createWriteStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import archiver from 'archiver';

export interface EmitZipOptions {
  /** Directory whose contents go into the zip at root. */
  sourceDir: string;
  /** Output zip path. Parent directory must exist. */
  outFile: string;
  /** Filenames (relative to extrasFrom) to add at the zip root if present. */
  extras?: string[];
  /** Where to look for `extras`. Required when `extras` is non-empty. */
  extrasFrom?: string;
}

export interface EmitZipResult {
  outFile: string;
  byteSize: number;
}

export async function emitZip(opts: EmitZipOptions): Promise<EmitZipResult> {
  const { sourceDir, outFile, extras = [], extrasFrom } = opts;
  if (!existsSync(sourceDir)) {
    throw new Error(`emitZip: sourceDir does not exist: ${sourceDir}`);
  }
  if (extras.length > 0 && !extrasFrom) {
    throw new Error('emitZip: extrasFrom is required when extras are provided.');
  }

  await new Promise<void>((resolveZip, rejectZip) => {
    const output = createWriteStream(outFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolveZip());
    output.on('error', rejectZip);
    archive.on('error', rejectZip);
    // archiver emits 'warning' for non-fatal recoverable issues (e.g. an
    // extras file disappeared between existsSync and stream open). ENOENT
    // is the only one safe to swallow; everything else is a real failure.
    archive.on('warning', (err) => {
      if (err.code !== 'ENOENT') rejectZip(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);

    if (extrasFrom) {
      for (const name of extras) {
        const srcPath = join(extrasFrom, name);
        if (!existsSync(srcPath)) continue;
        const distPath = join(sourceDir, name);
        if (existsSync(distPath)) continue;
        archive.file(srcPath, { name });
      }
    }

    archive.finalize().catch(rejectZip);
  });

  const info = await stat(outFile);
  return { outFile, byteSize: info.size };
}
