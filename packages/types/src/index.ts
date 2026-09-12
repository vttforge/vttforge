/**
 * @vttforge/types: the TypeScript surface shared across VTTForge packages.
 *
 * Today that is the Foundry members the base factories in `@vttforge/core`
 * stand on. Core re-exports them, so importing from either package works.
 */
import { version } from '../package.json' with { type: 'json' };

export const VTTFORGE_TYPES_VERSION: string = version;

export type {
  ActiveEffectLike,
  ActorLike,
  DocumentFlags,
  DocumentMembers,
  EmbeddedCollection,
  EmbeddedDocumentOwner,
  FolderLike,
  ItemLike,
  TypeDataModelMembers,
} from './documents.js';
export type { ApplicationV2Members, DocumentSheetV2Members, VttforgeClass } from './foundry.js';
export type {
  ActiveEffectConfig,
  ChatMessageConfig,
  CombatConfig,
  CompendiumCollection,
  DiceConfig,
  DocumentConfig,
  FoundryCollection,
  FoundryConfig,
  FoundryConstants,
  FoundryGlobals,
  Game,
  GameSettingsApi,
  GameTimeApi,
  KeybindingsApi,
  KeyboardApi,
  LocalizationApi,
  Notification,
  NotificationOptions,
  NotificationsApi,
  NotificationType,
  PackageHandle,
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
} from './globals.js';
export type {
  AnyClass,
  DiffObjectOptions,
  FoundryUtils,
  LineCircleIntersection,
  LineIntersection,
  MergeObjectOptions,
  ParsedS3URL,
  Point,
  ResolvedUUID,
  SortOptions,
  SortUpdate,
} from './utils.js';
