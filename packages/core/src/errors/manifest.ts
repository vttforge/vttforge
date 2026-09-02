/**
 * Typed runtime view over the VTTF-NNNN registry.
 *
 * Same data as `listErrorEntries()`; the manifest wraps it in a versioned
 * envelope so external tooling (the v0.3 docs site, IDE extensions, lint
 * rules) has a stable shape to consume. The matching JSON projection is
 * emitted to `dist/errors-manifest.json` at build time by
 * `packages/core/scripts/codegen-errors.mjs`.
 */

import { listErrorEntries, type VttfErrorEntry } from './registry.js';

export const ERROR_MANIFEST_VERSION = 1 as const;

export interface ErrorManifest {
  readonly version: typeof ERROR_MANIFEST_VERSION;
  readonly package: '@vttforge/core';
  readonly entries: ReadonlyArray<VttfErrorEntry>;
}

/**
 * Snapshot the current registry as a manifest object. Recomputed on every
 * call, cheap because the registry is a frozen literal. For the JSON projection
 * shipped with the package, see `dist/errors-manifest.json`.
 */
export function getErrorManifest(): ErrorManifest {
  return {
    version: ERROR_MANIFEST_VERSION,
    package: '@vttforge/core',
    entries: listErrorEntries(),
  };
}
