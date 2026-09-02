/**
 * Sheet registration with an id that survives a rebuild.
 *
 * Foundry keys a registered sheet by `${scope}.${sheetClass.name}` and writes
 * that key to `flags.core.sheetClass` on every document whose owner picked the
 * sheet. So the key is persisted user data, derived from a JavaScript class
 * name.
 *
 * That is fine for an unbundled package and quietly broken for a bundled one.
 * A minifier renames classes, and it does not promise the same name twice: the
 * same sheet registers as `mo` in one build and `vo` in the next. The saved
 * key then names a sheet that no longer exists, Foundry falls back to the
 * default, and the reader's chosen sheet is gone with nothing in the console.
 * It hits released upgrades, not just a dev loop: pick the sheet in 1.0, ship
 * 1.1, and the choice is lost.
 *
 * So the caller names the sheet and VTTForge fixes the class name to that
 * before registering. The name is written down, not inferred, and a build tool
 * cannot change it.
 *
 * Because the key is persisted, the way it is derived is a compatibility
 * promise: `${package id}.${sheet id}` cannot change later without orphaning
 * every saved selection.
 */

import { VttfError } from './errors/registry.js';

/** Which document collection the sheet belongs to. */
export type SheetDocumentKind = 'Actor' | 'Item';

export interface SheetRegistration {
  /**
   * Stable name for this sheet, unique within the package.
   *
   * It becomes the second half of the key Foundry persists, so treat it the
   * way you treat a database column name: pick it once and keep it. Renaming
   * it later loses the sheet choice of every document already using it.
   */
  readonly id: string;

  /** The document the sheet is for. */
  readonly document: SheetDocumentKind;

  /** The sheet class. */
  readonly sheet: unknown;

  /**
   * Document sub-types the sheet applies to. Omit to offer it for every type.
   *
   * A module registering a sheet for its own sub-type must pass the prefixed
   * key: `moduleSubType(id, 'pdf')`, not `'pdf'`.
   */
  readonly types?: readonly string[];

  /** Localization key for the name shown in the sheet picker. */
  readonly label?: string;

  /** Make this the default sheet for the listed types. */
  readonly makeDefault?: boolean;

  /** Allow a user to choose this sheet as their default. Defaults to true. */
  readonly canBeDefault?: boolean;

  /** Offer this sheet in the sheet configuration dialog. Defaults to true. */
  readonly canConfigure?: boolean;
}

interface DocumentSheetConfigApi {
  registerSheet(
    documentClass: unknown,
    scope: string,
    sheetClass: unknown,
    options: Record<string, unknown>,
  ): void;
}

interface FoundryRoot {
  readonly applications?: { readonly apps?: { readonly DocumentSheetConfig?: unknown } };
}

/**
 * Ids are one segment. Foundry joins scope and id with a dot, so a dotted id
 * produces a key that cannot be told apart from a different scope's.
 */
const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

function assertValidId(id: string, packageId: string): void {
  if (!ID_PATTERN.test(id)) {
    throw new VttfError(
      'VTTF-0006',
      `"${id}" is not a usable sheet id for "${packageId}". Use letters, digits and hyphens, no dots. Foundry joins the package id and the sheet id with one, so a dotted id produces an ambiguous key.`,
    );
  }
}

function readDocumentSheetConfig(): DocumentSheetConfigApi {
  const foundry = (globalThis as Record<string, unknown>).foundry as FoundryRoot | undefined;
  const config = foundry?.applications?.apps?.DocumentSheetConfig as
    | DocumentSheetConfigApi
    | undefined;
  if (config === undefined || typeof config.registerSheet !== 'function') {
    throw new VttfError(
      'VTTF-0002',
      'foundry.applications.apps.DocumentSheetConfig is not available. Register sheets inside the Foundry runtime, or stub the global in tests.',
    );
  }
  return config;
}

/**
 * Give the class the name the caller chose.
 *
 * `Function.prototype.name` is configurable, so this is a plain redefinition
 * rather than a trick. It is what makes the registered key stable, and it also
 * makes the class report its real name in a stack trace from a minified build.
 */
function nameClass(sheet: unknown, id: string): void {
  Object.defineProperty(sheet as object, 'name', { value: id, configurable: true });
}

/**
 * Register a package's sheets under keys that do not move.
 *
 * Called for you by `registerSystem` and `registerModule`; exported for a
 * package that registers sheets outside either.
 */
export function registerSheets(
  packageId: string,
  sheets: readonly SheetRegistration[],
  documentClasses: Readonly<Record<SheetDocumentKind, unknown>>,
): void {
  const seen = new Set<string>();
  for (const entry of sheets) {
    assertValidId(entry.id, packageId);
    if (seen.has(entry.id)) {
      throw new VttfError(
        'VTTF-0006',
        `"${packageId}" registers two sheets with the id "${entry.id}". Ids are the persisted key; the second would overwrite the first.`,
      );
    }
    seen.add(entry.id);
  }

  const config = readDocumentSheetConfig();
  for (const entry of sheets) {
    nameClass(entry.sheet, entry.id);
    config.registerSheet(documentClasses[entry.document], packageId, entry.sheet, {
      types: entry.types === undefined ? undefined : [...entry.types],
      label: entry.label,
      makeDefault: entry.makeDefault ?? false,
      canBeDefault: entry.canBeDefault ?? true,
      canConfigure: entry.canConfigure ?? true,
    });
  }
}
