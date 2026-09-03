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
  const values = new Map<string, unknown>();
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
    ActiveEffect: {},
    statusEffects: [],
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
    modules: new Map(),
    actors: [],
    items: [],
    i18n: {
      localize: (key: string) => key,
      format: (key: string, data: Record<string, unknown>) => `${key} ${JSON.stringify(data)}`,
    },
    settings: {
      register: (namespace: string, key: string, config: Record<string, unknown>) => {
        settings.push({ namespace, key, config });
        values.set(`${namespace}.${key}`, config.default);
      },
      get: (namespace: string, key: string) => values.get(`${namespace}.${key}`),
      set: async (namespace: string, key: string, value: unknown) => {
        values.set(`${namespace}.${key}`, value);
        return value;
      },
    },
    ...options.game,
  };

  // Last, so naming one of the built-ins here overrides it rather than
  // being overwritten by it.
  for (const [name, value] of Object.entries(options.globals ?? {})) scope[name] = value;

  return {
    hooks,
    settings,
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
