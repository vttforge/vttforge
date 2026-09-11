/**
 * @vttforge/core: runtime utilities for FoundryVTT v14+ systems and modules.
 *
 * v0.1 surface:
 *
 *   - registerSystem(): one-call init, replaces Hooks.once("init")
 *   - registerModule(): the same for modules, with namespaced sub-types
 *   - PackageConfig: typed wrapper around game.settings
 *   - BaseTypeDataModel(): TypeDataModel with safe migrateData default
 *   - BaseActorSheet(): ActorSheetV2 + HandlebarsApplicationMixin
 *   - BaseItemSheet(): ItemSheetV2 + HandlebarsApplicationMixin
 *   - fields(): typed bag of foundry.data.fields constructors
 *   - InferSchema<T>: derive `system` shape from defineSchema()
 *   - createMigrationRunner(): declarative schema migrations (register + run)
 *   - VttfError + error registry: VTTF-NNNN codes with docs URLs
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
export {
  naturalResult,
  type PostableRoll,
  type PostRollOptions,
  postRoll,
  ROLL_CARD_CLASS,
  type RollOutcome,
  type RollThreshold,
  rollOutcome,
} from './chat.js';
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
  type ResourceChildField,
  type ResourceFieldInstance,
  type ResourceFieldOptions,
  resourceField,
  schemaHasResource,
} from './data/resource-field.js';
export {
  ActorDataModel,
  DocumentSheet,
  type DocumentSheetOptions,
  ItemDataModel,
  OnHook,
  SystemSetting,
  type SystemSettingOptions,
} from './decorators.js';
export type { ActorConfig, ConfigCollection, GameApi, ItemConfig } from './deprecated.js';
export { SystemConfig } from './deprecated.js';
export {
  type CountableRoll,
  countSuccesses,
  DEFAULT_DIE_LADDER,
  type DicePoolSpec,
  dicePool,
  type SuccessCount,
  stepDie,
} from './dice.js';
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
  ActiveEffectLike,
  ActorLike,
  ApplicationV2Members,
  DocumentFlags,
  DocumentMembers,
  DocumentSheetV2Members,
  EmbeddedCollection,
  EmbeddedDocumentOwner,
  FolderLike,
  ItemLike,
  TypeDataModelMembers,
  VttforgeClass,
} from './foundry-base.js';
export type {
  ActiveEffectConfig,
  AnyClass,
  ChatMessageConfig,
  CombatConfig,
  CompendiumCollection,
  DiceConfig,
  DocumentConfig,
  FoundryCollection,
  FoundryConfig,
  FoundryConstants,
  FoundryGlobals,
  FoundryUtils,
  Game,
  GameSettingsApi,
  GameTimeApi,
  HookCallback,
  HooksApi,
  KeybindingsApi,
  KeyboardApi,
  LocalizationApi,
  Notification,
  NotificationOptions,
  NotificationsApi,
  NotificationType,
  PackageHandle,
  Point,
  QueryHandlers,
  SettingConfig,
  SettingMenuConfig,
  SettingScope,
  SocketApi,
  StatusEffectConfig,
  SystemHandle,
  TextEditorConfig,
  UiApi,
  UserLike,
  WorldCollection,
  WorldHandle,
} from './foundry-globals.js';
export {
  INJECTION_ATTRIBUTE,
  type InjectOptions,
  type InjectPosition,
  inject,
} from './inject.js';
export {
  KEYWORD_ATTRIBUTE,
  KEYWORD_CLASS,
  KEYWORD_ENRICHER_ID,
  type Keyword,
  keywordEnricher,
  keywordJournalContent,
  syncKeywordJournal,
} from './keywords.js';
export { createMigrationRunner } from './migrations/runner.js';
export type {
  Migration,
  MigrationLogger,
  MigrationRunner,
  MigrationRunnerOptions,
} from './migrations/types.js';
export {
  isModuleActive,
  type MissingApiReason,
  moduleApi,
  type PackageApi,
  requireModuleApi,
} from './module-api.js';
export { PackageConfig } from './package-config.js';
export {
  type CheckboxPromptField,
  type NumberPromptField,
  type PromptField,
  type PromptFieldsOptions,
  type PromptFieldValue,
  type PromptResult,
  promptFieldGroup,
  promptFields,
  type SelectPromptField,
  type SelectPromptOption,
  type TextareaPromptField,
  type TextPromptField,
} from './prompt-fields.js';
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
export {
  EDIT_IN_PLAY_ATTRIBUTE,
  MODE_CLASS,
  type SheetMode,
  type SheetModesConfig,
  TOGGLE_MODE_ACTION,
} from './sheet-modes.js';
export {
  type AskGmOptions,
  type EmitOptions,
  type PackageKind,
  type PackageSocket,
  registerSocket,
  type SocketContext,
  type SocketMessageHandler,
  type SocketMessageRun,
  type SocketRegistration,
  type SocketRequestHandler,
  type SocketRequestRun,
  type SocketSender,
} from './sockets.js';
export {
  type ConvertedSubTypes,
  type ConvertSubTypesOptions,
  convertSubTypes,
  type SubTypeDocument,
  type SubTypedDocument,
  type SubTypeQuery,
  subTypeDocuments,
} from './sub-types.js';
