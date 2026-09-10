/**
 * VTTF-NNNN error registry: append-only, stable across majors.
 *
 * Every error VTTForge throws has a numeric code (`VTTF-NNNN`) and a PascalCase
 * `name` for stack-trace readability. Codes are URLs: `https://vttforge.dev/errors/VTTF-0001`
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
      'registerSystem() ran more than once for the same system id. Almost always a hot reload or a duplicate import.',
  }),
  'VTTF-0002': Object.freeze({
    code: 'VTTF-0002',
    name: 'MissingFoundryGlobals',
    summary:
      'VTTForge code ran without Foundry globals (game, Hooks, CONFIG). Start it inside the Foundry runtime, not in a Node test without mocks.',
  }),
  'VTTF-0003': Object.freeze({
    code: 'VTTF-0003',
    name: 'UnknownSetting',
    summary:
      'SystemConfig.get() / set() received a key that never reached SystemConfig.register(). Register the setting in your init hook before reading it.',
  }),
  'VTTF-0004': Object.freeze({
    code: 'VTTF-0004',
    name: 'MigrationFailed',
    summary:
      'A migration function passed to createMigrationRunner() threw. The original error sits on .cause. The schemaVersion setting does not advance past the failed migration, so the next world load retries from there.',
  }),
  'VTTF-0005': Object.freeze({
    code: 'VTTF-0005',
    name: 'WorldTooOldForMigration',
    summary:
      'createMigrationRunner() ran on a world whose stored schemaVersion is older than the compatibleVersion floor. Upgrade the world to a supported intermediate version first. Running migrations across the gap would corrupt data.',
  }),
  'VTTF-0006': Object.freeze({
    code: 'VTTF-0006',
    name: 'InvalidSheetId',
    summary:
      'A sheet id is empty, contains a dot, or repeats another sheet in the same package. The id becomes half of the key Foundry saves on every document that uses the sheet, so it must be one clear segment.',
  }),
  'VTTF-0007': Object.freeze({
    code: 'VTTF-0007',
    name: 'InvalidEnricher',
    summary:
      'A text enricher id is empty, contains a dot, or repeats another enricher in the same package, or its pattern is missing the g flag. Foundry looks enrichers up by id and takes the first match, and it matches with matchAll, which throws on a non-global regex.',
  }),
  'VTTF-0008': Object.freeze({
    code: 'VTTF-0008',
    name: 'InvalidStatusEffect',
    summary:
      'A status effect reached registerSystem() or registerModule() without a string id. Foundry v14 keys CONFIG.statusEffects by id, so it cannot file an entry that lacks one. Give every condition an id; a module prefixes it with its own id.',
  }),
});

/**
 * Look up a registered entry by code. Throws if the code is unknown; the
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
 * VttfError: every error VTTForge throws extends this.
 *
 * - `code` is the registry key (string-narrowed).
 * - `name` is the PascalCase name from the registry; it shows up in stack traces.
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
