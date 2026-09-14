/**
 * Install the Foundry globals a package needs, and take them away again.
 *
 * The globals are the awkward part of testing anything built on Foundry:
 * `foundry`, `game`, `CONFIG`, `Hooks`, `ui`, `CONST`. A package touches some
 * subset, the subset is not written down, and you find it one
 * `ReferenceError` at a time.
 *
 * Everything here is a plain object or a recording stub, so a test can assert
 * on what was registered rather than only on what did not throw.
 */

import type { MockDocument } from './mock-foundry.js';

/** A hook registration the code under test made. */
export interface RecordedHook {
  event: string;
  once: boolean;
  fn: (...args: unknown[]) => unknown;
}

/** A setting the code under test registered. */
export interface RecordedSetting {
  namespace: string;
  key: string;
  config: Record<string, unknown>;
}

/** A settings menu the code under test registered. */
export interface RecordedMenu {
  namespace: string;
  key: string;
  config: Record<string, unknown>;
}

/** A keybinding the code under test registered. */
export interface RecordedKeybinding {
  namespace: string;
  action: string;
  config: Record<string, unknown>;
}

/** One `DocumentSheetConfig.registerSheet`, as VTTForge makes it. */
export interface RecordedSheet {
  /** The key Foundry persists: `<package id>.<sheet id>`. */
  readonly key: string;
  /** The package that registered it. */
  readonly scope: string;
  /** The sheet id, the class name VTTForge pinned. */
  readonly id: string;
  readonly sheetClass: unknown;
  readonly documentClass: unknown;
  readonly options: Record<string, unknown>;
}

/** One entry pushed onto `CONFIG.TextEditor.enrichers`. */
export interface RecordedEnricher {
  /** The namespaced id: `<package id>.<enricher id>`. */
  readonly id: string;
  readonly pattern: RegExp;
  readonly onRender?: unknown;
}

export interface MockFoundry {
  /** Every `Hooks.on` and `Hooks.once`, in order. */
  readonly hooks: ReadonlyArray<RecordedHook>;
  /** Every `game.settings.register`, in order. */
  readonly settings: ReadonlyArray<RecordedSetting>;
  /** Every `game.settings.registerMenu`, in order. */
  readonly menus: ReadonlyArray<RecordedMenu>;
  /** Every `game.keybindings.register`, in order. */
  readonly keybindings: ReadonlyArray<RecordedKeybinding>;
  /** Every notification raised, by severity. */
  readonly notifications: ReadonlyArray<{ level: 'info' | 'warn' | 'error'; message: string }>;
  /**
   * Every sheet registered, in order.
   *
   * `key` is the thing worth asserting: Foundry saves it on each document
   * using the sheet, so a test that pins the key is a test that the reader's
   * choice survives your next build.
   */
  readonly sheets: ReadonlyArray<RecordedSheet>;
  /**
   * Every text enricher registered, in order.
   *
   * `id` is namespaced, which is what stops a common name from colliding with
   * another package, and what makes `onRender` fire at all.
   */
  readonly enrichers: ReadonlyArray<RecordedEnricher>;
  /** Fire a hook the way Foundry would, for the listeners registered so far. */
  callHook(event: string, ...args: unknown[]): unknown[];
  /** Read back a registered setting's current value. */
  getSetting(namespace: string, key: string): unknown;
  /** Put every global back the way it was. */
  restore(): void;
}

export interface MockFoundryOptions {
  /** The current user. Defaults to a GM, since most module code checks. */
  user?: { id?: string; isGM?: boolean; name?: string };
  /**
   * The modules installed in this world.
   *
   * `game.modules.get(id)` invents a handle for any id the code under test
   * names, which is enough for a package reading its own. Code that walks the
   * list, an update checker or a report, needs one to walk: name them here.
   *
   * ```ts
   * withMockFoundry({
   *   modules: [{ id: 'other-module', version: '1.2.0', url: 'https://…' }],
   * });
   * ```
   */
  modules?: readonly MockModuleOptions[];
  /**
   * The documents the world holds.
   *
   * Each collection answers `get`, `getName`, `find`, `filter`, `size` and
   * iteration, so code that reads a world reads this the way it reads Foundry.
   * `createMockActor` and `createMockItem` build entries with flags and
   * `update` already on them; a plain object works too.
   *
   * ```ts
   * withMockFoundry({ items: [createMockItem({ id: 'a', name: 'Sword' })] });
   * ```
   */
  actors?: readonly MockWorldDocument[];
  items?: readonly MockWorldDocument[];
  journal?: readonly MockWorldDocument[];
  /** Extra `foundry.*` members, merged over the defaults. */
  foundry?: Record<string, unknown>;
  /** Extra `game.*` members, merged over the defaults. */
  game?: Record<string, unknown>;
  /**
   * Any other globals your code reads, installed for the life of the mock and
   * removed by `restore()` along with the rest.
   *
   * Foundry puts each document class on the global scope, and code under test
   * reaches for them by name: `Actor.create`, `JournalEntry.create`,
   * `ChatMessage.getSpeaker`. Those are not part of the fixed set this helper
   * installs, so name the ones you need.
   *
   * ```ts
   * withMockFoundry({
   *   globals: { JournalEntry: { create: vi.fn() } },
   * });
   * ```
   */
  globals?: Record<string, unknown>;
}

const GLOBALS = ['foundry', 'game', 'CONFIG', 'Hooks', 'ui', 'CONST'] as const;

/**
 * Flatten and expand, the way `foundry.utils` does.
 *
 * Provided because SDK code calls them on the global, not because a test
 * needs them: leaving them out means every consumer stubs them again.
 */
/** One module handle, as Foundry builds it from a manifest. */
interface MockModuleHandle {
  id: string;
  title: string;
  version: string;
  active: boolean;
  socket: boolean;
  url?: string;
  manifest?: string;
  api?: unknown;
  [key: string]: unknown;
}

/**
 * What a test says about a module it wants installed. Only `id` is required.
 *
 * A type, not an interface, and the extra fields ride in a separate member of
 * the intersection. An interface never satisfies an index signature, so a test
 * that declared its fixtures with `interface Handle { id: string; ... }` could
 * not pass them here, and the compiler's explanation reads like a puzzle.
 */
export type MockModuleOptions =
  | {
      readonly id: string;
      readonly title?: string;
      readonly version?: string;
      readonly active?: boolean;
      readonly socket?: boolean;
      readonly url?: string;
      readonly manifest?: string;
    }
  | (Record<string, unknown> & { readonly id: string });

/**
 * A document a test puts in the world.
 *
 * `createMockActor` and `createMockItem` build one with flags and `update`
 * already on it. A plain object works too, which is why this is a union: a
 * `MockDocument` is an interface and does not satisfy an index signature.
 */
export type MockWorldDocument =
  | MockDocument
  | { readonly id?: string; readonly name?: string }
  | Record<string, unknown>;

/**
 * `game.actors`, `game.items` and `game.journal`: a collection a test can walk.
 *
 * These were empty arrays, which answer `filter` and iteration and nothing
 * else. Code that calls `get`, `getName`, `find` or `size` on them, which is
 * most code that reads a world, then had to be handed a collection the test
 * built by hand.
 *
 * Unlike `game.modules`, nothing is invented: a world holds the documents it
 * holds, and `get` on an id that is not there answers `undefined`, the same as
 * Foundry.
 */
function mockDocuments(seed: readonly MockWorldDocument[] = []) {
  // The spread comes first: a document that names no id gets one, and one that
  // does keeps it. The other way round, `...document` would put an `undefined`
  // id straight back.
  const documents: Record<string, unknown>[] = seed.map((document, index) => {
    const fields = document as Record<string, unknown>;
    return { ...fields, id: String(fields.id ?? `mock${index}`) };
  });
  const byId = new Map(documents.map((document) => [String(document.id), document]));

  return {
    get size() {
      return documents.length;
    },
    get contents() {
      return [...documents];
    },
    get: (id: string) => byId.get(id),
    getName: (name: string) => documents.find((document) => document.name === name),
    has: (id: string) => byId.has(id),
    keys: () => byId.keys(),
    values: () => documents.values(),
    entries: () => byId.entries(),
    [Symbol.iterator]: () => documents.values(),
    find: (condition: (entry: Record<string, unknown>) => boolean) => documents.find(condition),
    filter: (condition: (entry: Record<string, unknown>) => boolean) => documents.filter(condition),
    map: <U>(transformer: (entry: Record<string, unknown>) => U) => documents.map(transformer),
    reduce: <U>(reducer: (carry: U, entry: Record<string, unknown>) => U, initial: U) =>
      documents.reduce(reducer, initial),
    forEach: (fn: (entry: Record<string, unknown>) => void) => {
      for (const document of documents) fn(document);
    },
    some: (condition: (entry: Record<string, unknown>) => boolean) => documents.some(condition),
    every: (condition: (entry: Record<string, unknown>) => boolean) => documents.every(condition),
  };
}

/**
 * `game.modules`, made up as it is asked for.
 *
 * Foundry builds one handle per installed module. A unit test has no module
 * list, so any id the code under test names is treated as installed and
 * switched on. The handle is remembered, so writing an api on it and reading
 * it back works the way it does in a world.
 */
function mockModules(seed: readonly MockModuleOptions[] = []) {
  const handles = new Map<string, MockModuleHandle>();
  const build = (options: MockModuleOptions): MockModuleHandle => ({
    title: options.id,
    version: '1.0.0',
    active: true,
    socket: true,
    ...(options as Record<string, unknown>),
    id: options.id,
  });
  for (const options of seed) handles.set(options.id, build(options));

  return {
    get(id: string) {
      const existing = handles.get(id);
      if (existing) return existing;
      const handle = build({ id });
      handles.set(id, handle);
      return handle;
    },
    has: (id: string) => handles.has(id),
    get size() {
      return handles.size;
    },
    get contents() {
      return [...handles.values()];
    },
    keys: () => handles.keys(),
    values: () => handles.values(),
    entries: () => handles.entries(),
    [Symbol.iterator]: () => handles.values(),
    find: (condition: (entry: MockModuleHandle) => boolean) =>
      [...handles.values()].find(condition),
    filter: (condition: (entry: MockModuleHandle) => boolean) =>
      [...handles.values()].filter(condition),
    map: <U>(transformer: (entry: MockModuleHandle) => U) => [...handles.values()].map(transformer),
    forEach: (fn: (entry: MockModuleHandle) => void) => {
      for (const handle of handles.values()) fn(handle);
    },
    some: (condition: (entry: MockModuleHandle) => boolean) =>
      [...handles.values()].some(condition),
    every: (condition: (entry: MockModuleHandle) => boolean) =>
      [...handles.values()].every(condition),
  };
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const isPlain =
      value !== null &&
      typeof value === 'object' &&
      Object.getPrototypeOf(value) === Object.prototype;
    if (isPlain && Object.keys(value as object).length > 0) {
      Object.assign(flat, flattenObject(value as Record<string, unknown>, path));
    } else {
      flat[path] = value;
    }
  }
  return flat;
}

function expandObject(flat: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    const last = parts.pop();
    if (!last) continue;
    let target = out;
    for (const part of parts) {
      target[part] ??= {};
      target = target[part] as Record<string, unknown>;
    }
    target[last] = value;
  }
  return out;
}

/**
 * Stand up the globals, run the callback, tear them down.
 *
 * ```ts
 * const foundry = withMockFoundry();
 * registerMyModule();
 * expect(foundry.hooks.map((h) => h.event)).toContain('init');
 * foundry.restore();
 * ```
 */
export function withMockFoundry(options: MockFoundryOptions = {}): MockFoundry {
  const saved = new Map<string, unknown>();
  const scope = globalThis as Record<string, unknown>;
  const extra = Object.keys(options.globals ?? {});
  // Saved before anything is installed, so `restore()` puts back whatever was
  // there, including nothing.
  for (const name of [...GLOBALS, ...extra]) saved.set(name, scope[name]);

  const hooks: RecordedHook[] = [];
  const settings: RecordedSetting[] = [];
  const menus: RecordedMenu[] = [];
  const keybindings: RecordedKeybinding[] = [];
  const values = new Map<string, unknown>();
  // The registry Foundry keeps, keyed `namespace.key`. It is the only way to
  // reach a setting belonging to a package the code under test did not write,
  // so anything that enumerates, reports on or copies a world reads this.
  const registry = new Map<string, Record<string, unknown>>();
  const menuRegistry = new Map<string, Record<string, unknown>>();

  /** The scopes Foundry accepts. Anything else falls back to `client`. */
  const SCOPES = new Set(['world', 'client', 'user']);
  const notifications: { level: 'info' | 'warn' | 'error'; message: string }[] = [];

  const Hooks = {
    on: (event: string, fn: (...a: unknown[]) => unknown) => {
      hooks.push({ event, once: false, fn });
      return hooks.length;
    },
    once: (event: string, fn: (...a: unknown[]) => unknown) => {
      hooks.push({ event, once: true, fn });
      return hooks.length;
    },
    off: () => {},
    call: (event: string, ...args: unknown[]) => callHook(event, ...args).every((r) => r !== false),
    callAll: (event: string, ...args: unknown[]) => {
      callHook(event, ...args);
      return true;
    },
  };

  function callHook(event: string, ...args: unknown[]): unknown[] {
    return hooks.filter((h) => h.event === event).map((h) => h.fn(...args));
  }

  const user = { id: 'user000000000001', isGM: true, name: 'Gamemaster', ...options.user };

  const sheets: RecordedSheet[] = [];
  const enrichers: RecordedEnricher[] = [];

  scope.Hooks = Hooks;
  scope.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 } };
  scope.CONFIG = {
    Actor: { dataModels: {}, sheetClasses: {} },
    Item: { dataModels: {}, sheetClasses: {} },
    TextEditor: { enrichers },
    Combat: {},
    // v14 keys the collection by status id, so registration writes
    // `CONFIG.statusEffects[id]` and a test reads it back the same way.
    statusEffects: {},
    debug: { hooks: false },
  };
  scope.ui = {
    notifications: {
      info: (m: string) => notifications.push({ level: 'info', message: m }),
      warn: (m: string) => notifications.push({ level: 'warn', message: m }),
      error: (m: string) => notifications.push({ level: 'error', message: m }),
    },
  };
  scope.foundry = {
    utils: {
      flattenObject,
      expandObject,
      mergeObject: (a: Record<string, unknown>, b: Record<string, unknown>) => ({ ...a, ...b }),
      deepClone: <T>(v: T): T => structuredClone(v),
      randomID: () => Math.random().toString(36).slice(2, 18),
      isNewerVersion: (a: string, b: string) =>
        a.localeCompare(b, undefined, { numeric: true }) > 0,
    },
    abstract: { TypeDataModel: class {}, DataModel: class {}, Document: class {} },
    data: { fields: {} },
    applications: {
      api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (b: unknown) => b },
      sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} },
      apps: {
        // Where `registerSystem({ sheets })` and `registerModule({ sheets })`
        // register. Foundry builds the key from the class name, so this
        // records the same key it would persist.
        DocumentSheetConfig: {
          registerSheet(
            documentClass: unknown,
            scope: string,
            sheetClass: { name: string },
            sheetOptions: Record<string, unknown> = {},
          ) {
            sheets.push({
              key: `${scope}.${sheetClass.name}`,
              scope,
              id: sheetClass.name,
              sheetClass,
              documentClass,
              options: sheetOptions,
            });
          },
          unregisterSheet: () => {},
        },
      },
      ux: {},
      instances: new Map(),
    },
    documents: {
      collections: {
        Actors: { registerSheet: () => {}, unregisterSheet: () => {} },
        Items: { registerSheet: () => {}, unregisterSheet: () => {} },
      },
    },
    ...options.foundry,
  };
  scope.game = {
    user,
    userId: user.id,
    ready: true,
    // A handle per id, made on first ask. A unit test is not a world with a
    // module list: whatever the code under test names is the module it is,
    // installed and switched on. Without this, anything that reads or writes
    // `game.modules.get(id)` sees nothing and reports a missing module.
    modules: mockModules(options.modules),
    actors: mockDocuments(options.actors),
    items: mockDocuments(options.items),
    journal: mockDocuments(options.journal),
    i18n: {
      localize: (key: string) => key,
      format: (key: string, data: Record<string, unknown>) => `${key} ${JSON.stringify(data)}`,
    },
    settings: {
      settings: registry,
      menus: menuRegistry,
      register: (namespace: string, key: string, config: Record<string, unknown>) => {
        settings.push({ namespace, key, config });
        values.set(`${namespace}.${key}`, config.default);
        // Registration normalises as it stores, so an entry read back always
        // carries a real scope and a real default. A setting value may be
        // `null` and may not be `undefined`.
        registry.set(`${namespace}.${key}`, {
          ...config,
          id: `${namespace}.${key}`,
          namespace,
          key,
          scope: SCOPES.has(String(config.scope)) ? config.scope : 'client',
          default: config.default ?? null,
        });
      },
      registerMenu: (namespace: string, key: string, config: Record<string, unknown>) => {
        menus.push({ namespace, key, config });
        menuRegistry.set(`${namespace}.${key}`, {
          ...config,
          id: `${namespace}.${key}`,
          namespace,
          key,
        });
      },
      get: (namespace: string, key: string) => values.get(`${namespace}.${key}`),
      set: async (namespace: string, key: string, value: unknown) => {
        values.set(`${namespace}.${key}`, value);
        return value;
      },
    },
    keybindings: {
      register: (namespace: string, action: string, config: Record<string, unknown>) => {
        keybindings.push({ namespace, action, config });
      },
      get: () => [],
      set: async () => {},
    },
    ...options.game,
  };

  // Last, so naming one of the built-ins here overrides it rather than
  // being overwritten by it.
  for (const [name, value] of Object.entries(options.globals ?? {})) scope[name] = value;

  return {
    hooks,
    settings,
    menus,
    keybindings,
    notifications,
    sheets,
    enrichers,
    callHook,
    getSetting: (namespace, key) => values.get(`${namespace}.${key}`),
    restore() {
      for (const [name, value] of saved) {
        if (value === undefined) delete scope[name];
        else scope[name] = value;
      }
    },
  };
}
