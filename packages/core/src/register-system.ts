/**
 * registerSystem — one call that replaces the boilerplate `Hooks.once("init", ...)`
 * block in every Foundry system.
 *
 * Conforms to the staged-init pattern documented in foundry-vtt-system-dev
 * §"Production Architecture":
 *
 *   init       → CONFIG mutations (dataModels, documentClass, statusEffects)
 *   i18nInit   → translate CONFIG labels
 *   setup      → enrichers, packs
 *   ready      → migrations (GM-only)
 *
 * v0.1 scope: `init` only. `setup`/`ready` callbacks land in v0.1.1.
 *
 * Per PRD §11 open question #1, we wrap the hook ourselves ("explicit hook for
 * now"); callers don't need to write `Hooks.once("init", ...)` themselves.
 */

import { VttfError, type VttfErrorCode } from './errors/registry.js';
import type {
  ActiveEffectConfig,
  CombatConfig,
  FoundryConfig,
  HooksApi,
} from './foundry-globals.js';

export interface SystemRegistration {
  /** System id — must match the folder name and `system.json` `id`. */
  readonly id: string;

  /** Map of `documentTypes.Actor` key → TypeDataModel class. */
  readonly actorDataModels?: Readonly<Record<string, unknown>>;

  /** Map of `documentTypes.Item` key → TypeDataModel class. */
  readonly itemDataModels?: Readonly<Record<string, unknown>>;

  /** Replacement for `CONFIG.Actor.documentClass`. */
  readonly actorDocumentClass?: unknown;

  /** Replacement for `CONFIG.Item.documentClass`. */
  readonly itemDocumentClass?: unknown;

  /** Global initiative formula — assigned to `CONFIG.Combat.initiative`. */
  readonly combat?: CombatConfig;

  /** Disables legacy Active Effect transferral. Defaults to true. */
  readonly activeEffect?: ActiveEffectConfig;

  /**
   * Replaces `CONFIG.statusEffects` (systems own this array — modules push).
   * If omitted, the existing array is kept untouched.
   */
  readonly statusEffects?: readonly unknown[];

  /**
   * Optional pre-init hook for work that has to run before any of the CONFIG
   * mutations (rare — usually used to assign `globalThis.<systemId>` API).
   */
  readonly onBeforeInit?: () => void;

  /** Optional post-init hook for work that depends on the mutations above. */
  readonly onAfterInit?: () => void;
}

const registered = new Set<string>();

/** For tests — clears the in-process "already registered" guard. */
export function _resetRegisteredSystemsForTests(): void {
  registered.clear();
}

function readHooks(): HooksApi {
  const hooks = (globalThis as Record<string, unknown>).Hooks as HooksApi | undefined;
  if (hooks === undefined || typeof hooks.once !== 'function') {
    throw vttfError(
      'VTTF-0002',
      'globalThis.Hooks is not available — call registerSystem() inside a Foundry runtime or stub Hooks in tests',
    );
  }
  return hooks;
}

function readConfig(): FoundryConfig {
  const config = (globalThis as Record<string, unknown>).CONFIG as FoundryConfig | undefined;
  if (config === undefined) {
    throw vttfError(
      'VTTF-0002',
      'globalThis.CONFIG is not available — call registerSystem() inside a Foundry runtime or stub CONFIG in tests',
    );
  }
  return config;
}

function vttfError(code: VttfErrorCode, message?: string): VttfError {
  return new VttfError(code, message);
}

/**
 * Register a Foundry system with VTTForge. Idempotency: the same `id` calling
 * twice throws VTTF-0001 — almost always a hot-reload or duplicate import bug.
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

  // Disable legacy Active Effect transferral by default — every modern v13
  // system wants this off (per foundry-vtt-system-dev §"Initialization Lifecycle").
  const legacyTransferral = config.activeEffect?.legacyTransferral ?? false;
  CONFIG.ActiveEffect.legacyTransferral = legacyTransferral;

  if (config.statusEffects !== undefined) {
    CONFIG.statusEffects = [...config.statusEffects];
  }

  config.onAfterInit?.();
}
