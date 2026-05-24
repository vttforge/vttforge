/**
 * @vttforge/core — runtime utilities for FoundryVTT v13+ systems and modules.
 *
 * v0.0.1 surface:
 *
 *   - registerSystem()             — one-call init, replaces Hooks.once("init")
 *   - SystemConfig                 — typed wrapper around game.settings
 *   - BaseTypeDataModel()          — TypeDataModel with safe migrateData default
 *   - BaseActorSheet()             — ActorSheetV2 + HandlebarsApplicationMixin
 *   - VttfError + error registry   — VTTF-NNNN codes with docs URLs
 *
 * Foundry classes are resolved from `globalThis.foundry` lazily so the package
 * imports cleanly in Node/tests; concrete Foundry typing arrives with
 * `@vttforge/types` in v1.0.
 */

export const VTTFORGE_CORE_VERSION = '0.0.1';

export { BaseActorSheet, VTTFORGE_SHEET_CLASS } from './base-actor-sheet.js';
export { BaseTypeDataModel } from './base-type-data-model.js';
export {
  docsUrlFor,
  getErrorEntry,
  listErrorEntries,
  VttfError,
  type VttfErrorCode,
  type VttfErrorEntry,
} from './errors/registry.js';
export type {
  ActiveEffectConfig,
  CombatConfig,
  FoundryConfig,
  GameApi,
  GameSettingsApi,
  HookCallback,
  HooksApi,
  SettingConfig,
  SettingScope,
} from './foundry-globals.js';
export { registerSystem, type SystemRegistration } from './register-system.js';
export { SystemConfig } from './system-config.js';
