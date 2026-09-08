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
import type { GameApi, SettingConfig } from './foundry-globals.js';
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

/**
 * `game.settings`, read when it is used rather than when the class is
 * defined: the class is defined at import time, and `game` is not there yet.
 */
function gameSettings(): GameApi['settings'] {
  const game = (globalThis as Record<string, unknown>).game as GameApi | undefined;
  if (game?.settings === undefined) {
    throw new VttfError(
      'VTTF-0002',
      'game.settings is not available. A @SystemSetting accessor can be read or written inside or after the init hook.',
    );
  }
  return game.settings;
}

export interface SystemSettingOptions<T> extends Omit<SettingConfig<T>, 'default'> {
  /** The namespace to register under: your system or module id. */
  namespace: string;
  /** The setting key. Defaults to the accessor's name. */
  key?: string;
  /**
   * The initial value. Omit it and the accessor's own initializer is used:
   * `static accessor homebrew = false` registers with `default: false`.
   */
  default?: T;
}

/**
 * Register a setting, and read and write it through a static accessor.
 *
 * ```ts
 * class Settings {
 *   @SystemSetting({ namespace: 'my-system', scope: 'world', config: true, type: Boolean })
 *   static accessor homebrew = false;
 * }
 *
 * Settings.homebrew;         // game.settings.get('my-system', 'homebrew')
 * Settings.homebrew = true;  // game.settings.set('my-system', 'homebrew', true)
 * ```
 *
 * The registration waits for `init`, like every other decorator here. The
 * setter cannot be awaited, because assignment has no result: when you need
 * to know the write landed, call `game.settings.set` yourself.
 *
 * Only static accessors: a setting has one value for the world or the
 * client, not one per instance.
 *
 * @experimental New in 0.15, and no consumer has used it yet. The shape can
 * change in a minor.
 */
export function SystemSetting<T>(options: SystemSettingOptions<T>) {
  return (
    _target: ClassAccessorDecoratorTarget<unknown, T>,
    context: ClassAccessorDecoratorContext<unknown, T>,
  ): ClassAccessorDecoratorResult<unknown, T> => {
    if (!context.static) {
      throw new VttfError(
        'VTTF-0002',
        `@SystemSetting is on an instance accessor (${String(context.name)}). A setting has one value, not one per instance: make it static.`,
      );
    }
    const { namespace, key: explicitKey, default: explicitDefault, ...config } = options;
    const key = explicitKey ?? String(context.name);
    let initial: T | undefined;

    atInit(() => {
      gameSettings().register<T>(namespace, key, {
        ...config,
        default: (explicitDefault ?? initial) as T,
      });
    });

    return {
      // The initializer is the default, and nothing else: the value lives
      // in game.settings, so the field itself is never read.
      init(value: T): T {
        initial = value;
        return value;
      },
      get(): T {
        return gameSettings().get<T>(namespace, key);
      },
      set(value: T): void {
        void gameSettings().set<T>(namespace, key, value);
      },
    };
  };
}
