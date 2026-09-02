/**
 * VTTF-NNNN error registry — append-only, stable across majors.
 *
 * Every error VTTForge throws has a numeric code (`VTTF-NNNN`) and a PascalCase
 * `name` for stack-trace readability. Codes are URLs — `https://vttforge.dev/errors/VTTF-0001`
 * eventually links to a docs page generated from this registry.
 *
 * Never renumber an entry. To deprecate, mark with `deprecated: true` and add a
 * `replacedBy` pointer. Adding a new code: pick the next unused integer.
 */

export type VttfErrorCode = `VTTF-${string}`;

export interface VttfErrorEntry {
  readonly code: VttfErrorCode;
  readonly name: string;
  readonly summary: string;
  readonly deprecated?: boolean;
  readonly replacedBy?: VttfErrorCode;
}

const DOCS_BASE_URL = 'https://vttforge.dev/errors';

const REGISTRY: Readonly<Record<VttfErrorCode, VttfErrorEntry>> = Object.freeze({
  'VTTF-0001': Object.freeze({
    code: 'VTTF-0001',
    name: 'SystemAlreadyRegistered',
    summary:
      'registerSystem() was called more than once for the same system id. This is almost always a hot-reload artefact or a duplicate import.',
  }),
  'VTTF-0002': Object.freeze({
    code: 'VTTF-0002',
    name: 'MissingFoundryGlobals',
    summary:
      'VTTForge code ran in an environment without Foundry globals (game, Hooks, CONFIG). Initialise inside the Foundry runtime, not in a Node test without mocks.',
  }),
  'VTTF-0003': Object.freeze({
    code: 'VTTF-0003',
    name: 'UnknownSetting',
    summary:
      'SystemConfig.get() / set() was called with a key that was never passed to SystemConfig.register(). Register the setting in your init hook before reading it.',
  }),
  'VTTF-0004': Object.freeze({
    code: 'VTTF-0004',
    name: 'MigrationFailed',
    summary:
      'A migration function passed to createMigrationRunner() threw. The original error is available on .cause. The schemaVersion setting is not advanced past the failed migration so retrying on the next world load picks up where the failure left off.',
  }),
  'VTTF-0005': Object.freeze({
    code: 'VTTF-0005',
    name: 'WorldTooOldForMigration',
    summary:
      'createMigrationRunner() was called on a world whose stored schemaVersion is older than the configured compatibleVersion floor. Upgrade the world to a supported intermediate version before continuing. Running migrations across the gap would corrupt data.',
  }),
  'VTTF-0006': Object.freeze({
    code: 'VTTF-0006',
    name: 'InvalidSheetId',
    summary:
      'A sheet was registered with an id that is empty, contains a dot, or repeats another sheet in the same package. The id becomes half of the key Foundry persists on every document using the sheet, so it must be a single unambiguous segment.',
  }),
  'VTTF-0007': Object.freeze({
    code: 'VTTF-0007',
    name: 'InvalidEnricher',
    summary:
      'A text enricher was registered with an id that is empty, contains a dot, or repeats another enricher in the same package, or with a pattern missing the g flag. Foundry looks enrichers up by id and takes the first match, and matches with matchAll, which throws on a non-global regex.',
  }),
});

/**
 * Look up a registered entry by code. Throws if the code is unknown — the
 * registry is the source of truth, so missing codes mean a typo.
 */
export function getErrorEntry(code: VttfErrorCode): VttfErrorEntry {
  const entry = REGISTRY[code];
  if (entry === undefined) {
    throw new Error(`Unknown VTTForge error code: ${code}. Add it to the registry.`);
  }
  return entry;
}

/**
 * Return every entry currently in the registry. Used by codegen to emit the
 * runtime constants and the JSON manifest that powers the docs pages.
 */
export function listErrorEntries(): readonly VttfErrorEntry[] {
  return Object.values(REGISTRY);
}

export function docsUrlFor(code: VttfErrorCode): string {
  return `${DOCS_BASE_URL}/${code}`;
}

/**
 * VttfError — every error VTTForge throws extends this.
 *
 * - `code` is the registry key (string-narrowed).
 * - `name` is the PascalCase name from the registry — shows up in stack traces.
 * - `docsUrl` points at the docs page.
 * - `cause` uses the native ES2022 mechanism. Multiple causes => pass an
 *   `AggregateError` as the cause.
 */
export class VttfError extends Error {
  readonly code: VttfErrorCode;
  readonly docsUrl: string;

  constructor(code: VttfErrorCode, message?: string, options?: ErrorOptions) {
    const entry = getErrorEntry(code);
    const finalMessage = `[${code}] ${message ?? entry.summary}`;
    super(finalMessage, options);
    this.code = code;
    this.name = entry.name;
    this.docsUrl = docsUrlFor(code);
  }
}
