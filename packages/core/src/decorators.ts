/**
 * Decorators for the registrations every package writes by hand.
 *
 * The timing is the whole problem these solve. `CONFIG` may only be touched
 * inside the `init` hook, but a class is defined the moment its module is
 * imported — long before `init`. So the obvious version, which assigns to
 * `CONFIG` from the decorator body, works in a test and silently does nothing
 * in Foundry.
 *
 * These register a listener instead. `Hooks` is a plain static class that
 * exists as soon as Foundry's scripts load, so subscribing at class-definition
 * time is safe; the assignment itself waits for `init` like it must.
 *
 * Standard TC39 decorators, not the legacy `experimentalDecorators` kind.
 */

import { VttfError } from './errors/registry.js';
import { registerSheets, type SheetDocumentKind } from './register-sheets.js';

interface HooksApi {
  once(event: string, fn: () => void): unknown;
  on(event: string, fn: (...args: unknown[]) => unknown): unknown;
}

function hooks(): HooksApi {
  const api = (globalThis as Record<string, unknown>).Hooks as HooksApi | undefined;
  if (typeof api?.once !== 'function') {
    throw new VttfError(
      'VTTF-0002',
      'globalThis.Hooks is not available. Decorated classes must be defined inside the Foundry runtime (or stub Hooks in tests).',
    );
  }
  return api;
}

// biome-ignore lint/suspicious/noExplicitAny: a decorator receives whatever class it is applied to
type AnyClass = abstract new (...args: any[]) => any;

/** Run something in `init`, which is the only place CONFIG may be touched. */
function atInit(fn: () => void): void {
  hooks().once('init', fn);
}

/**
 * The `dataModels` bag for a document kind.
 *
 * Reached through a helper because the failure worth reporting is a missing
 * `CONFIG.Actor`, not a `TypeError` about reading a property of undefined
 * three frames deep inside a hook.
 */
function dataModelsFor(kind: 'Actor' | 'Item'): Record<string, unknown> {
  const cfg = (globalThis as Record<string, unknown>).CONFIG as
    | Record<string, { dataModels?: Record<string, unknown> } | undefined>
    | undefined;
  const bag = cfg?.[kind]?.dataModels;
  if (bag === undefined) {
    throw new VttfError(
      'VTTF-0002',
      `CONFIG.${kind}.dataModels is not available inside the init hook.`,
    );
  }
  return bag;
}

/**
 * File this data model under an Actor subtype.
 *
 * ```ts
 * @ActorDataModel('character')
 * class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {}
 * ```
 *
 * The type is the key as it appears in your manifest's `documentTypes`. A
 * module contributing a subtype uses the prefixed form its manifest declares
 * — `my-module.vehicle` — because that is the key Foundry files it under.
 *
 * @experimental New in 0.13, and no consumer has used it yet. The shape can
 * change in a minor.
 */
export function ActorDataModel(type: string) {
  return (target: AnyClass, _context: ClassDecoratorContext): void => {
    atInit(() => {
      dataModelsFor('Actor')[type] = target;
    });
  };
}

/** The same for an Item subtype.
 *
 * @experimental New in 0.13, and no consumer has used it yet. The shape can
 * change in a minor.
 */
export function ItemDataModel(type: string) {
  return (target: AnyClass, _context: ClassDecoratorContext): void => {
    atInit(() => {
      dataModelsFor('Item')[type] = target;
    });
  };
}

export interface DocumentSheetOptions {
  /**
   * The id the sheet is filed under, as `<namespace>.<id>`.
   *
   * Foundry saves this key on every document whose owner picks the sheet, and
   * builds it from the class name, which a bundler renames between builds.
   * Naming the id here is what keeps the saved key pointing at a sheet that
   * still exists. Pick it once and keep it.
   */
  id: string;
  /** Which document this sheet is for. */
  document: SheetDocumentKind;
  /** The namespace to register under: your system or module id. */
  namespace: string;
  /** The subtypes it applies to. Omit for every type. */
  types?: readonly string[];
  /** Whether it becomes the default for those types. */
  makeDefault?: boolean;
  /** The label shown in the sheet picker, usually a locale key. */
  label?: string;
}

/**
 * The document classes `registerSheets` needs, read at init.
 *
 * `CONFIG.<kind>.documentClass` may be replaced by the system during its own
 * init, so it is read when the hook fires rather than when the class is
 * defined.
 */
function documentClasses(): Readonly<Record<SheetDocumentKind, unknown>> {
  const cfg = (globalThis as Record<string, unknown>).CONFIG as
    | Record<string, { documentClass?: unknown } | undefined>
    | undefined;
  if (cfg === undefined) {
    throw new VttfError('VTTF-0002', 'CONFIG is not available inside the init hook.');
  }
  return { Actor: cfg.Actor?.documentClass, Item: cfg.Item?.documentClass };
}

/**
 * Register this sheet for a document type.
 *
 * ```ts
 * @DocumentSheet({ id: 'character', document: 'Actor', namespace: 'my-system', types: ['character'], makeDefault: true })
 * class CharacterSheet extends BaseActorSheet() {}
 * ```
 *
 * Goes through `registerSheets`, the same path `registerSystem({ sheets })`
 * takes, so the persisted key is `<namespace>.<id>` and survives a rebuild.
 *
 * @experimental New in 0.13, and no consumer has used it yet. The shape can
 * change in a minor.
 */
export function DocumentSheet(options: DocumentSheetOptions) {
  return (target: AnyClass, _context: ClassDecoratorContext): void => {
    atInit(() => {
      registerSheets(
        options.namespace,
        [
          {
            id: options.id,
            document: options.document,
            sheet: target,
            ...(options.types ? { types: options.types } : {}),
            ...(options.label ? { label: options.label } : {}),
            ...(options.makeDefault !== undefined ? { makeDefault: options.makeDefault } : {}),
          },
        ],
        documentClasses(),
      );
    });
  };
}

/**
 * Call this method when a hook fires.
 *
 * ```ts
 * class MyModule {
 *   @OnHook('renderChatMessageHTML')
 *   static onChatRender(message: unknown, html: HTMLElement) {}
 * }
 * ```
 *
 * Only static methods: an instance method has no instance to run against at
 * the time the listener is registered, and inventing one would be a guess.
 *
 * @experimental New in 0.13, and no consumer has used it yet. The shape can
 * change in a minor.
 */
export function OnHook(event: string) {
  return (target: (...args: unknown[]) => unknown, context: ClassMethodDecoratorContext): void => {
    if (!context.static) {
      throw new VttfError(
        'VTTF-0002',
        `@OnHook('${event}') is on an instance method (${String(context.name)}). Hook listeners are registered before any instance exists — make it static.`,
      );
    }
    context.addInitializer(function (this: unknown) {
      hooks().on(event, (...args: unknown[]) => target.apply(this, args));
    });
  };
}
