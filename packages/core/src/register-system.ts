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

import { VttfError, type VttfErrorCode } from './errors/registry.js';
import type {
  ActiveEffectConfig,
  CombatConfig,
  FoundryConfig,
  HooksApi,
} from './foundry-globals.js';
import { type EnricherRegistration, registerEnrichers } from './register-enrichers.js';
import { registerSheets, type SheetRegistration } from './register-sheets.js';

export interface SystemRegistration {
  /** System id: must match the folder name and `system.json` `id`. */
  readonly id: string;

  /** Map of `documentTypes.Actor` key → TypeDataModel class. */
  readonly actorDataModels?: Readonly<Record<string, unknown>>;

  /** Map of `documentTypes.Item` key → TypeDataModel class. */
  readonly itemDataModels?: Readonly<Record<string, unknown>>;

  /** Replacement for `CONFIG.Actor.documentClass`. */
  readonly actorDocumentClass?: unknown;

  /** Replacement for `CONFIG.Item.documentClass`. */
  readonly itemDocumentClass?: unknown;

  /** Global initiative formula: assigned to `CONFIG.Combat.initiative`. */
  readonly combat?: CombatConfig;

  /** Disables legacy Active Effect transferral. Defaults to true. */
  readonly activeEffect?: ActiveEffectConfig;

  /**
   * Replaces `CONFIG.statusEffects` (systems own this array; modules push).
   * If omitted, the existing array is kept untouched.
   */
  readonly statusEffects?: readonly unknown[];

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

  // Disable legacy Active Effect transferral by default; every modern v13
  // system wants this off (the modern AE model is opt-in via this flag).
  const legacyTransferral = config.activeEffect?.legacyTransferral ?? false;
  CONFIG.ActiveEffect.legacyTransferral = legacyTransferral;

  if (config.statusEffects !== undefined) {
    CONFIG.statusEffects = [...config.statusEffects];
  }
  if (config.enrichers !== undefined && config.enrichers.length > 0) {
    registerEnrichers(config.id, config.enrichers);
  }
  if (config.sheets !== undefined && config.sheets.length > 0) {
    registerSheets(config.id, config.sheets, {
      Actor: CONFIG.Actor.documentClass,
      Item: CONFIG.Item.documentClass,
    });
  }

  config.onAfterInit?.();
}
