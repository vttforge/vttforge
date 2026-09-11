/**
 * Getting a module's documents out before the module goes away.
 *
 * A module's sub-types travel with the module. Switch it off and every
 * document using one is marked invalid: visible, not editable, and holding
 * data nothing can read. Uninstall it and they are stranded for good. Foundry
 * says to ship a conversion path, and every module that ships one writes it
 * from scratch.
 *
 * The conversion itself is one update, and the shape of it is not guessable.
 *
 * - **`update({ type })` on its own is refused.** Foundry answers "The type of
 *   a Document may only be changed if the system field is also updated with a
 *   ForcedReplacement operator", and drops the *whole* update. A call that
 *   also renamed the document loses the rename too.
 * - **With the operator it converts in place.** The id survives, and so do the
 *   flags, the folder, the ownership and the embedded documents. Nothing has
 *   to be deleted and recreated, which is what the usual advice describes.
 * - **Creating a replacement with `keepId` while the original is still there
 *   overwrites it.** No error, no second document. Worth knowing before
 *   reaching for that order.
 *
 * Everything here writes world documents, so it runs on a Gamemaster's client.
 */

import { VttfError } from './errors/registry.js';
import type { GameApi } from './foundry-globals.js';
import { moduleSubType } from './register-module.js';

/** The documents a module may contribute types to and VTTForge registers. */
export type SubTypeDocument = 'Actor' | 'Item';

/** The least a document has to look like for any of this to mean something. */
export interface SubTypedDocument {
  readonly id?: string;
  readonly name?: string;
  readonly type?: string;
  readonly system?: Record<string, unknown>;
  update(changes: Record<string, unknown>): Promise<unknown>;
}

interface Collection<T> {
  filter(fn: (entry: T) => boolean): T[];
}

function game(): GameApi | undefined {
  return (globalThis as { game?: GameApi }).game;
}

function collectionFor(document: SubTypeDocument): Collection<SubTypedDocument> | undefined {
  const g = game() as unknown as Record<string, Collection<SubTypedDocument> | undefined>;
  return document === 'Actor' ? g?.actors : g?.items;
}

/**
 * `foundry.data.operators.ForcedReplacement`, which is what makes a type
 * change legal. Read at call time: the namespace is not there in a unit test.
 */
function forcedReplacement(): ((value: unknown) => unknown) | undefined {
  const operators = (
    globalThis as {
      foundry?: { data?: { operators?: { ForcedReplacement?: new (value: unknown) => unknown } } };
    }
  ).foundry?.data?.operators;
  const Operator = operators?.ForcedReplacement;
  if (typeof Operator !== 'function') return undefined;
  return (value: unknown) => new Operator(value);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new VttfError('VTTF-0015', message);
}

export interface SubTypeQuery {
  /** Module id. */
  readonly id: string;
  readonly document: SubTypeDocument;
  /** The bare type key, as it appears in `documentTypes` and `itemDataModels`. */
  readonly type: string;
}

/**
 * Every document in the world using one of this module's sub-types.
 *
 * The honest answer to "what does the user lose if they uninstall me". Show
 * the count before you convert, and again before you tell someone it is safe
 * to remove the module.
 */
export function subTypeDocuments<T extends SubTypedDocument = SubTypedDocument>(
  query: SubTypeQuery,
): T[] {
  assert(typeof query.id === 'string' && query.id !== '', 'subTypeDocuments() needs a module id.');
  assert(
    typeof query.type === 'string' && query.type !== '',
    'subTypeDocuments() needs a bare type key.',
  );
  const wanted = moduleSubType(query.id, query.type);
  return (collectionFor(query.document)?.filter((entry) => entry.type === wanted) ?? []) as T[];
}

export interface ConvertSubTypesOptions<T extends SubTypedDocument = SubTypedDocument>
  extends SubTypeQuery {
  /**
   * The type to become. Default `'base'`, which every document class has and
   * no package owns, so it survives anything else being uninstalled too.
   */
  readonly to?: string;
  /**
   * The system data the converted document keeps. Default: what it already
   * had, unchanged. A core type stores it as a plain object, so nothing is
   * lost even where nothing reads it.
   */
  readonly system?: (document: T) => Record<string, unknown>;
  /** Anything else to set while converting, such as a name or a flag. */
  readonly changes?: (document: T) => Record<string, unknown>;
}

export interface ConvertedSubTypes {
  readonly converted: number;
  /** The ones that refused, with what Foundry said. */
  readonly failed: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly reason: string;
  }>;
}

/**
 * Convert every document of one of this module's sub-types to another type.
 *
 * One update each, in place: ids, flags, folders, ownership and embedded
 * documents all survive. Run it from a settings button or a macro, before the
 * user switches the module off.
 */
export async function convertSubTypes<T extends SubTypedDocument = SubTypedDocument>(
  options: ConvertSubTypesOptions<T>,
): Promise<ConvertedSubTypes> {
  const replace = forcedReplacement();
  assert(
    replace !== undefined,
    'foundry.data.operators.ForcedReplacement is not available. Converting a document type needs it, and Foundry refuses the whole update without it.',
  );

  const to = options.to ?? 'base';
  assert(
    typeof to === 'string' && to !== '',
    'convertSubTypes() needs a type to convert to, or nothing for "base".',
  );
  assert(
    to !== moduleSubType(options.id, options.type),
    `convertSubTypes() was asked to convert "${to}" into itself.`,
  );

  const documents = subTypeDocuments<T>(options);
  const failed: Array<{ id: string; name: string; reason: string }> = [];
  let converted = 0;

  for (const document of documents) {
    const system = options.system ? options.system(document) : { ...(document.system ?? {}) };
    try {
      await document.update({
        ...(options.changes ? options.changes(document) : {}),
        type: to,
        // Without this Foundry refuses the update, all of it.
        system: replace(system),
      });
      converted += 1;
    } catch (error) {
      failed.push({
        id: document.id ?? '',
        name: document.name ?? '',
        reason: String((error as { message?: string })?.message ?? error),
      });
    }
  }

  return { converted, failed };
}
