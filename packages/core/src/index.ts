/**
 * @vttforge/core — runtime utilities for FoundryVTT v13+ systems and modules.
 *
 * v0.1 surface:
 *
 *   - registerSystem()             — one-call init, replaces Hooks.once("init")
 *   - registerModule()             — the same for modules, with namespaced sub-types
 *   - SystemConfig                 — typed wrapper around game.settings
 *   - BaseTypeDataModel()          — TypeDataModel with safe migrateData default
 *   - BaseActorSheet()             — ActorSheetV2 + HandlebarsApplicationMixin
 *   - BaseItemSheet()              — ItemSheetV2 + HandlebarsApplicationMixin
 *   - fields()                     — typed bag of foundry.data.fields constructors
 *   - InferSchema<T>               — derive `system` shape from defineSchema()
 *   - createMigrationRunner()      — declarative schema migrations (register + run)
 *   - VttfError + error registry   — VTTF-NNNN codes with docs URLs
 *
 * Foundry classes are resolved from `globalThis.foundry` lazily so the package
 * imports cleanly in Node/tests. The Foundry members the bases stand on are
 * declared in `@vttforge/types` and re-exported here.
 */

import { version } from '../package.json' with { type: 'json' };

export const VTTFORGE_CORE_VERSION: string = version;

export {
  BaseActorSheet,
  type DragDropConfig,
  type SheetBaseCtor,
  type SheetBaseMembers,
  type SheetBaseStatics,
  VTTFORGE_SHEET_CLASS,
} from './base-actor-sheet.js';
export {
  BaseApplication,
  type BaseApplicationMembers,
} from './base-application.js';
export {
  BaseDocumentSheet,
  type BaseDocumentSheetMembers,
  type DocumentSheetKind,
} from './base-document-sheet.js';
export { BaseItemSheet } from './base-item-sheet.js';
export {
  BaseTypeDataModel,
  type TypeDataModelHooks,
  type TypedTypeDataModel,
  type TypedTypeDataModelCtor,
} from './base-type-data-model.js';
export type {
  ArrayFieldOptions,
  BooleanFieldOptions,
  ColorFieldOptions,
  DataFieldOptions,
  EmbeddedDataFieldOptions,
  EmbeddedDocumentFieldOptions,
  FilePathFieldOptions,
  ForeignDocumentFieldOptions,
  HTMLFieldOptions,
  NumberFieldOptions,
  SchemaFieldOptions,
  SetFieldOptions,
  StringFieldOptions,
  TypedSchemaFieldOptions,
} from './data/field-options.js';
export {
  type ArrayFieldCtor,
  type ArrayFieldInstance,
  type BooleanFieldCtor,
  type BooleanFieldInstance,
  type ColorFieldCtor,
  type ColorFieldInstance,
  type DataModelClass,
  type DocumentClass,
  type EmbeddedDataFieldCtor,
  type EmbeddedDataFieldInstance,
  type EmbeddedDocumentFieldCtor,
  type EmbeddedDocumentFieldInstance,
  type FieldInstance,
  type FieldsApi,
  type FilePathFieldCtor,
  type FilePathFieldInstance,
  type ForeignDocumentFieldCtor,
  type ForeignDocumentFieldInstance,
  fields,
  type HTMLFieldCtor,
  type HTMLFieldInstance,
  type NumberFieldCtor,
  type NumberFieldInstance,
  type SchemaFieldCtor,
  type SchemaFieldInstance,
  type SetFieldCtor,
  type SetFieldInstance,
  type StringFieldCtor,
  type StringFieldInstance,
  type TypedSchemaFieldCtor,
  type TypedSchemaFieldInstance,
} from './data/fields.js';
export type { InferField, InferSchema, Prettify } from './data/infer-schema.js';
export {
  ERROR_MANIFEST_VERSION,
  type ErrorManifest,
  getErrorManifest,
} from './errors/manifest.js';
export {
  docsUrlFor,
  getErrorEntry,
  listErrorEntries,
  VttfError,
  type VttfErrorCode,
  type VttfErrorEntry,
} from './errors/registry.js';
export type {
  ApplicationV2Members,
  DocumentSheetV2Members,
  VttforgeClass,
} from './foundry-base.js';
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
export { createMigrationRunner } from './migrations/runner.js';
export type {
  Migration,
  MigrationLogger,
  MigrationRunner,
  MigrationRunnerOptions,
} from './migrations/types.js';
export {
  type EnricherRegistration,
  registerEnrichers,
} from './register-enrichers.js';
export {
  type ModuleRegistration,
  moduleSubType,
  registerModule,
} from './register-module.js';
export {
  registerSheets,
  type SheetDocumentKind,
  type SheetRegistration,
} from './register-sheets.js';
export { registerSystem, type SystemRegistration } from './register-system.js';
export { SystemConfig } from './system-config.js';
