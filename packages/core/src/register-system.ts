/**
 * registerSystem: one call that replaces the boilerplate `Hooks.once("init", ...)`
 * block in every Foundry system.
 *
 * Conforms to the canonical Foundry init lifecycle:
 *
 *   init       → CONFIG mutations (dataModels, documentClass, statusEffects)
 *   i18nInit   → translate the labels those mutations just wrote
 *   setup      → work that needs registered settings or loaded packages
 *   ready      → migrations (GM-only; the consumer guards inside onReady)
 *
 * All four are offered. The middle two exist because `init` is too early for
 * some work and `ready` is too late: `game.i18n` has not loaded during `init`,
 * so a CONFIG label translated there comes out as its own key, and settings
 * registered during `init` cannot be read until `setup`.
 *
 * We wrap the hooks so callers never write `Hooks.once("init", ...)`
 * themselves.
 */

import { schemaHasResource } from './data/resource-field.js';
import { VttfError, type VttfErrorCode } from './errors/registry.js';
import type {
  AnyClass,
  CombatConfig,
  FoundryConfig,
  HooksApi,
  StatusEffectConfig,
} from './foundry-globals.js';
import { assertKeywords, type Keyword, keywordEnricher, syncKeywordJournal } from './keywords.js';
import { type EnricherRegistration, registerEnrichers } from './register-enrichers.js';
import { registerSheets, type SheetRegistration } from './register-sheets.js';
import { addStatusEffects } from './status-effects.js';

export interface SystemRegistration {
  /** System id: must match the folder name and `system.json` `id`. */
  readonly id: string;

  /** Map of `documentTypes.Actor` key → TypeDataModel class. */
  readonly actorDataModels?: Readonly<Record<string, AnyClass>>;

  /** Map of `documentTypes.Item` key → TypeDataModel class. */
  readonly itemDataModels?: Readonly<Record<string, AnyClass>>;

  /** Replacement for `CONFIG.Actor.documentClass`. */
  readonly actorDocumentClass?: AnyClass;

  /** Replacement for `CONFIG.Item.documentClass`. */
  readonly itemDocumentClass?: AnyClass;

  /** Global initiative formula: assigned to `CONFIG.Combat.initiative`. */
  readonly combat?: { readonly initiative: CombatConfig['initiative'] };

  /**
   * Conditions this system adds to `CONFIG.statusEffects`, each keyed by its
   * `id`. An id that matches a core condition replaces it. The collection is
   * never assigned wholesale: that would drop the conditions other packages
   * added before this system's `init` ran.
   */
  readonly statusEffects?: readonly StatusEffectConfig[];

  /**
   * Sheets this system offers, registered under `<id>.<sheet id>`.
   *
   * Register them here rather than calling Foundry's `registerSheet` yourself:
   * Foundry derives the persisted key from the class name, and a bundler
   * renames classes between builds. See `registerSheets`.
   */
  readonly sheets?: readonly SheetRegistration[];

  /**
   * Text enrichers this system contributes, registered under `<id>.<enricher
   * id>`.
   *
   * Register them here rather than pushing to `CONFIG.TextEditor.enrichers`
   * yourself: that array has four ways to accept an entry and then do nothing
   * with it. See `registerEnrichers`.
   */
  readonly enrichers?: readonly EnricherRegistration[];

  /**
   * Optional pre-init hook for work that has to run before any of the CONFIG
   * mutations (rare; usually used to assign `globalThis.<systemId>` API).
   */
  readonly onBeforeInit?: () => void;

  /**
   * Rules terms this system defines. Each becomes `@Keyword[id]` in rich text,
   * shown as its label with the description as tooltip, and all of them are
   * written to a journal entry on the GM's client at `ready`. See `Keyword`.
   */
  readonly keywords?: readonly Keyword[];

  /**
   * The name of the keywords journal. Default: the package title followed by
   * "keywords". `false` registers the enricher and writes no journal.
   */
  readonly keywordsJournal?: string | false;

  /** Optional post-init hook for work that depends on the mutations above. */
  readonly onAfterInit?: () => void;

  /**
   * Optional `i18nInit` hook. Fires after Foundry loads the language files and
   * before `setup`.
   *
   * This is where CONFIG labels get translated. `game.i18n` is not loaded
   * during `init`, so `game.i18n.localize()` called there returns the key you
   * passed it, and the untranslated key is what players see. Do it here
   * instead, once, rather than localizing on every render.
   *
   * @example
   * ```ts
   * onI18nInit: () => {
   *   for (const ability of Object.values(CONFIG.MY_SYSTEM.abilities)) {
   *     ability.label = game.i18n.localize(ability.label);
   *   }
   * },
   * ```
   */
  readonly onI18nInit?: () => void;

  /**
   * Optional `setup` hook. Fires after every package is loaded and before the
   * canvas is drawn.
   *
   * The home for work that `init` is too early for and `ready` too late: a
   * setting registered during `init` can only be read from here on, and
   * compendium packs are available. Keep world data out of it, that is
   * `onReady`.
   */
  readonly onSetup?: () => void | Promise<void>;

  /**
   * Optional `ready` hook. Fires once after Foundry has finished bootstrap.
   * The natural home for migration runners (`createMigrationRunner().run()`).
   *
   * **Not GM-gated.** Guard inside your callback (`if (!game.user.isGM) return;`)
   * when the work is GM-only, and migrations always are.
   */
  readonly onReady?: () => void | Promise<void>;
}

const registered = new Set<string>();

/** For tests: clears the in-process "already registered" guard. */
export function _resetRegisteredSystemsForTests(): void {
  registered.clear();
}

function readHooks(): HooksApi {
  const hooks = (globalThis as Record<string, unknown>).Hooks as HooksApi | undefined;
  if (hooks === undefined || typeof hooks.once !== 'function') {
    throw vttfError(
      'VTTF-0002',
      'globalThis.Hooks is not available. Call registerSystem() inside a Foundry runtime or stub Hooks in tests',
    );
  }
  return hooks;
}

function readConfig(): FoundryConfig {
  const config = (globalThis as Record<string, unknown>).CONFIG as FoundryConfig | undefined;
  if (config === undefined) {
    throw vttfError(
      'VTTF-0002',
      'globalThis.CONFIG is not available. Call registerSystem() inside a Foundry runtime or stub CONFIG in tests',
    );
  }
  return config;
}

function vttfError(code: VttfErrorCode, message?: string): VttfError {
  return new VttfError(code, message);
}

/**
 * Register a Foundry system with VTTForge. Idempotency: the same `id` calling
 * twice throws VTTF-0001, almost always a hot-reload or duplicate import bug.
 *
 * Returns the registration object so consumers can inspect what was applied
 * (useful in tests). The actual CONFIG mutations are deferred until Foundry's
 * `init` hook fires.
 */
export function registerSystem(config: SystemRegistration): SystemRegistration {
  if (registered.has(config.id)) {
    throw vttfError('VTTF-0001', `System "${config.id}" was already registered`);
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
      // Foundry awaits ready-hook results, but `Hooks.once` types it as
      // `unknown` so we don't return anything ourselves; Foundry treats
      // Promise rejections as unhandled, which is the right escalation.
      void config.onReady?.();
    });
  }

  return config;
}

function applyInit(config: SystemRegistration): void {
  config.onBeforeInit?.();
  const CONFIG = readConfig();

  if (config.actorDataModels !== undefined) {
    Object.assign(CONFIG.Actor.dataModels, config.actorDataModels);
    assertTokenAttributes(config.id, config.actorDataModels);
  }
  if (config.itemDataModels !== undefined) {
    Object.assign(CONFIG.Item.dataModels, config.itemDataModels);
  }
  if (config.actorDocumentClass !== undefined) {
    CONFIG.Actor.documentClass = config.actorDocumentClass;
  }
  if (config.itemDocumentClass !== undefined) {
    CONFIG.Item.documentClass = config.itemDocumentClass;
  }
  if (config.combat?.initiative !== undefined) {
    CONFIG.Combat.initiative = config.combat.initiative;
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

interface SystemPackage {
  readonly primaryTokenAttribute?: string | null;
  readonly secondaryTokenAttribute?: string | null;
}

/**
 * The manifest's token bars must land on a `{ value, max }` field of some
 * Actor data model, or Foundry draws no bar and says nothing. Checked here,
 * once, where both sides are known: the manifest through `game.system`, the
 * schemas through the classes just registered.
 */
function assertTokenAttributes(
  systemId: string,
  dataModels: Readonly<Record<string, unknown>>,
): void {
  const game = (globalThis as Record<string, unknown>).game as
    | { system?: SystemPackage }
    | undefined;
  const system = game?.system;
  if (!system) return;
  const models = Object.values(dataModels);
  if (models.length === 0) return;
  for (const key of ['primaryTokenAttribute', 'secondaryTokenAttribute'] as const) {
    const path = system[key];
    if (typeof path !== 'string' || path.length === 0) continue;
    const found = models.some((model) =>
      schemaHasResource((model as { schema?: unknown }).schema, path),
    );
    if (!found) {
      throw vttfError(
        'VTTF-0010',
        `"${systemId}" sets ${key} to "${path}", but no Actor data model declares a { value, max } field at that path. Use resourceField() there, or point the manifest at a field that has value and max.`,
      );
    }
  }
}
