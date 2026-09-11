/**
 * registerModule: the module counterpart to `registerSystem`.
 *
 * A module is a guest in someone else's world, and Foundry enforces that. The
 * two differences that matter:
 *
 * - **Sub-type keys are namespaced.** A system registers `character`; a module
 *   registering the same thing must register `<module-id>.character`, and the
 *   manifest must declare it under `documentTypes`. Forget the prefix and the
 *   type silently never appears. This function adds it for you.
 * - **A module never owns the globals.** Document classes and the initiative
 *   formula belong to the system, so there is no option here to replace them.
 *   `statusEffects` adds conditions by id, which is what a module is allowed
 *   to do.
 */

import { VttfError, type VttfErrorCode } from './errors/registry.js';
import type { FoundryConfig, GameApi, HooksApi, StatusEffectConfig } from './foundry-globals.js';
import { assertKeywords, type Keyword, keywordEnricher, syncKeywordJournal } from './keywords.js';
import { type EnricherRegistration, registerEnrichers } from './register-enrichers.js';
import { registerSheets, type SheetRegistration } from './register-sheets.js';
import { addStatusEffects } from './status-effects.js';

export interface ModuleRegistration {
  /** Module id: must match the folder name and `module.json` `id`. */
  readonly id: string;

  /**
   * Actor sub-types this module contributes, keyed by the bare type name.
   * Registered under `<id>.<type>`, so declare them the same way in
   * `documentTypes.Actor` in your manifest.
   */
  readonly actorDataModels?: Readonly<Record<string, unknown>>;

  /** Item sub-types, same rule as `actorDataModels`. */
  readonly itemDataModels?: Readonly<Record<string, unknown>>;

  /**
   * Conditions this module adds to `CONFIG.statusEffects`, each keyed by its
   * `id`. Prefix the id with the module id (`my-module.dazed`) so it cannot
   * collide with the system's own. Added one by one, never assigned: the
   * collection belongs to the system, and replacing it would delete the
   * conditions the world depends on.
   */
  readonly statusEffects?: readonly StatusEffectConfig[];

  /**
   * Sheets this module offers, registered under `<id>.<sheet id>`.
   *
   * Register them here rather than calling Foundry's `registerSheet` yourself:
   * Foundry derives the persisted key from the class name, and a bundler
   * renames classes between builds. See `registerSheets`.
   */
  readonly sheets?: readonly SheetRegistration[];

  /**
   * Text enrichers this module contributes, registered under `<id>.<enricher
   * id>`.
   *
   * Register them here rather than pushing to `CONFIG.TextEditor.enrichers`
   * yourself: that array has four ways to accept an entry and then do nothing
   * with it. See `registerEnrichers`.
   */
  readonly enrichers?: readonly EnricherRegistration[];

  /**
   * Rules terms this module defines. Each becomes `@Keyword[id]` in rich text,
   * shown as its label with the description as tooltip, and all of them are
   * written to a journal entry on the GM's client at `ready`. See `Keyword`.
   */
  readonly keywords?: readonly Keyword[];

  /**
   * The name of the keywords journal. Default: the package title followed by
   * "keywords". `false` registers the enricher and writes no journal.
   */
  readonly keywordsJournal?: string | false;

  /**
   * What this module publishes at `game.modules.get(id).api`.
   *
   * Written at the top of `init`, before `onBeforeInit` and before any CONFIG
   * mutation. Nothing orders one package's `init` against another's, so a
   * module that publishes late is a module some readers find empty, with no
   * way to tell that apart from one that publishes nothing at all.
   */
  readonly api?: Readonly<Record<string, unknown>>;

  /** Runs before any CONFIG mutation: the usual home for the module API. */
  readonly onBeforeInit?: () => void;

  /** Runs after the mutations above, inside the same `init` hook. */
  readonly onAfterInit?: () => void;

  /**
   * Runs on `i18nInit`, after Foundry loads the language files.
   *
   * This is where CONFIG labels get translated. `game.i18n` is not loaded
   * during `init`, so `game.i18n.localize()` called there returns the key you
   * passed it, and the untranslated key is what players see.
   */
  readonly onI18nInit?: () => void;

  /**
   * Runs on `setup`, after every package is loaded and before the canvas is
   * drawn.
   *
   * For a module this is also the first point where the system it is extending
   * has finished its own `init`, so it is the place to read what the system
   * registered. A setting registered during `init` can only be read from here
   * on. Keep world data out of it, that is `onReady`.
   */
  readonly onSetup?: () => void | Promise<void>;

  /**
   * Runs once on `ready`.
   *
   * **Not GM-gated.** Guard inside your callback when the work is GM-only.
   */
  readonly onReady?: () => void | Promise<void>;
}

const registered = new Set<string>();

/** For tests: clears the in-process "already registered" guard. */
export function _resetRegisteredModulesForTests(): void {
  registered.clear();
}

/**
 * The key Foundry files a module's document sub-type under.
 *
 * Use it wherever you name the type outside `registerModule`: registering the
 * sheet, checking `actor.type`, writing `documentTypes` in the manifest. The
 * prefix is easy to get wrong by hand and fails silently when you do.
 *
 * @example
 * ```ts
 * moduleSubType('pdf-character-sheet', 'pdf'); // 'pdf-character-sheet.pdf'
 * ```
 */
export function moduleSubType(moduleId: string, type: string): string {
  return `${moduleId}.${type}`;
}

function vttfError(code: VttfErrorCode, message?: string): VttfError {
  return new VttfError(code, message);
}

function readHooks(): HooksApi {
  const hooks = (globalThis as Record<string, unknown>).Hooks as HooksApi | undefined;
  if (hooks === undefined || typeof hooks.once !== 'function') {
    throw vttfError(
      'VTTF-0002',
      'globalThis.Hooks is not available. Call registerModule() inside a Foundry runtime or stub Hooks in tests',
    );
  }
  return hooks;
}

function readConfig(): FoundryConfig {
  const config = (globalThis as Record<string, unknown>).CONFIG as FoundryConfig | undefined;
  if (config === undefined) {
    throw vttfError(
      'VTTF-0002',
      'globalThis.CONFIG is not available. Call registerModule() inside a Foundry runtime or stub CONFIG in tests',
    );
  }
  return config;
}

function assignSubTypes(
  target: Record<string, unknown>,
  moduleId: string,
  models: Readonly<Record<string, unknown>>,
): void {
  for (const [type, model] of Object.entries(models)) {
    target[moduleSubType(moduleId, type)] = model;
  }
}

/**
 * Register a Foundry module with VTTForge.
 *
 * Calling twice with the same `id` throws VTTF-0001, almost always a
 * hot-reload artefact or a duplicate import. The CONFIG mutations are deferred
 * until Foundry's `init` hook fires.
 */
export function registerModule(config: ModuleRegistration): ModuleRegistration {
  if (registered.has(config.id)) {
    throw vttfError('VTTF-0001', `Module "${config.id}" was already registered`);
  }
  registered.add(config.id);

  const hooks = readHooks();
  hooks.once('init', () => {
    applyInit(config);
  });
  if (config.onI18nInit !== undefined) {
    hooks.once('i18nInit', () => {
      config.onI18nInit?.();
    });
  }
  if (config.onSetup !== undefined) {
    hooks.once('setup', () => {
      void config.onSetup?.();
    });
  }
  if (config.keywords !== undefined && config.keywords.length > 0) {
    assertKeywords(config.id, config.keywords);
    if (config.keywordsJournal !== false) {
      const { id, keywords, keywordsJournal } = config;
      hooks.once('ready', () => {
        void syncKeywordJournal(id, keywords, keywordsJournal);
      });
    }
  }
  if (config.onReady !== undefined) {
    hooks.once('ready', () => {
      void config.onReady?.();
    });
  }

  return config;
}

/**
 * Publish the api on the module's own handle.
 *
 * Foundry builds the handle when it reads the manifest, so it is there by
 * `init`. When it is not, the module is not installed under the id it thinks
 * it has, which is worth saying out loud rather than dropping the api.
 */
function publishApi(moduleId: string, api: Readonly<Record<string, unknown>>): void {
  const modules = (globalThis as { game?: GameApi }).game?.modules;
  // No module list at all is a test bench, not a mismatched id.
  if (!modules) return;
  const handle = modules.get(moduleId);
  if (!handle) {
    throw vttfError(
      'VTTF-0014',
      `Cannot publish an api for "${moduleId}": Foundry has no module under that id. ` +
        'The id passed to registerModule() has to match the one in module.json.',
    );
  }
  handle.api = api;
}

function applyInit(config: ModuleRegistration): void {
  // First, before even `onBeforeInit`, so the module's own callbacks can read
  // it back off the handle rather than keeping a second reference.
  if (config.api !== undefined) publishApi(config.id, config.api);
  config.onBeforeInit?.();
  const CONFIG = readConfig();

  if (config.actorDataModels !== undefined) {
    assignSubTypes(CONFIG.Actor.dataModels, config.id, config.actorDataModels);
  }
  if (config.itemDataModels !== undefined) {
    assignSubTypes(CONFIG.Item.dataModels, config.id, config.itemDataModels);
  }
  if (config.statusEffects !== undefined && config.statusEffects.length > 0) {
    addStatusEffects(config.id, config.statusEffects, CONFIG);
  }
  const enrichers = [...(config.enrichers ?? [])];
  if (config.keywords !== undefined && config.keywords.length > 0) {
    enrichers.push(keywordEnricher(config.keywords));
  }
  if (enrichers.length > 0) {
    registerEnrichers(config.id, enrichers);
  }
  if (config.sheets !== undefined && config.sheets.length > 0) {
    registerSheets(config.id, config.sheets, {
      Actor: CONFIG.Actor.documentClass,
      Item: CONFIG.Item.documentClass,
    });
  }

  config.onAfterInit?.();
}
