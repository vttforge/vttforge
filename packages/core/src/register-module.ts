/**
 * registerModule — the module counterpart to `registerSystem`.
 *
 * A module is a guest in someone else's world, and Foundry enforces that. The
 * two differences that matter:
 *
 * - **Sub-type keys are namespaced.** A system registers `character`; a module
 *   registering the same thing must register `<module-id>.character`, and the
 *   manifest must declare it under `documentTypes`. Forget the prefix and the
 *   type silently never appears. This function adds it for you.
 * - **A module never owns the globals.** Document classes, the initiative
 *   formula and the status-effect array belong to the system. So there is no
 *   option here to replace them — `statusEffects` only appends, which is what
 *   a module is allowed to do.
 */

import { VttfError, type VttfErrorCode } from './errors/registry.js';
import type { FoundryConfig, HooksApi } from './foundry-globals.js';

export interface ModuleRegistration {
  /** Module id — must match the folder name and `module.json` `id`. */
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
   * Status effects to append to `CONFIG.statusEffects`.
   *
   * Appended, never assigned: the array belongs to the system, and replacing
   * it would delete conditions the world depends on.
   */
  readonly statusEffects?: readonly unknown[];

  /** Runs before any CONFIG mutation — the usual home for the module API. */
  readonly onBeforeInit?: () => void;

  /** Runs after the mutations above, inside the same `init` hook. */
  readonly onAfterInit?: () => void;

  /**
   * Runs once on `ready`.
   *
   * **Not GM-gated.** Guard inside your callback when the work is GM-only.
   */
  readonly onReady?: () => void | Promise<void>;
}

const registered = new Set<string>();

/** For tests — clears the in-process "already registered" guard. */
export function _resetRegisteredModulesForTests(): void {
  registered.clear();
}

/**
 * The key Foundry files a module's document sub-type under.
 *
 * Use it wherever you name the type outside `registerModule` — registering the
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
      'globalThis.Hooks is not available — call registerModule() inside a Foundry runtime or stub Hooks in tests',
    );
  }
  return hooks;
}

function readConfig(): FoundryConfig {
  const config = (globalThis as Record<string, unknown>).CONFIG as FoundryConfig | undefined;
  if (config === undefined) {
    throw vttfError(
      'VTTF-0002',
      'globalThis.CONFIG is not available — call registerModule() inside a Foundry runtime or stub CONFIG in tests',
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
 * Calling twice with the same `id` throws VTTF-0001 — almost always a
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
  if (config.onReady !== undefined) {
    hooks.once('ready', () => {
      void config.onReady?.();
    });
  }

  return config;
}

function applyInit(config: ModuleRegistration): void {
  config.onBeforeInit?.();
  const CONFIG = readConfig();

  if (config.actorDataModels !== undefined) {
    assignSubTypes(CONFIG.Actor.dataModels, config.id, config.actorDataModels);
  }
  if (config.itemDataModels !== undefined) {
    assignSubTypes(CONFIG.Item.dataModels, config.id, config.itemDataModels);
  }
  if (config.statusEffects !== undefined && config.statusEffects.length > 0) {
    CONFIG.statusEffects ??= [];
    CONFIG.statusEffects.push(...config.statusEffects);
  }

  config.onAfterInit?.();
}
