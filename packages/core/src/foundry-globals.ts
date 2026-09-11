/**
 * The Foundry globals VTTForge core touches, re-exported from `@vttforge/types`.
 *
 * Every name here is described in that package against Foundry's published
 * API for v13+ and v14. Core reads these through `globalThis` at runtime and
 * never bundles Foundry itself.
 */

export type {
  ActiveEffectConfig,
  AnyClass,
  ApplicationClickAction,
  ApplicationConfiguration,
  ApplicationFormConfiguration,
  ApplicationPosition,
  ApplicationTab,
  ApplicationTabsConfiguration,
  ApplicationWindowConfiguration,
  CanvasApi,
  ChatMessageConfig,
  ChatMessageConstructor,
  ChatMessageLike,
  ChatSpeakerData,
  CombatantLike,
  CombatConfig,
  CombatHistoryData,
  CombatLike,
  CompendiumCollection,
  DiceConfig,
  DiceTermResult,
  DieTermLike,
  DocumentConfig,
  FolderLikeDocument,
  FoundryCollection,
  FoundryConfig,
  FoundryConstants,
  FoundryGlobals,
  FoundryUtils,
  Game,
  GameSettingsApi,
  GameTimeApi,
  HandlebarsTemplatePart,
  JournalEntryLike,
  KeybindingsApi,
  KeyboardApi,
  LevelLike,
  LocalizationApi,
  MacroLike,
  Notification,
  NotificationOptions,
  NotificationsApi,
  NotificationType,
  PackageHandle,
  Point,
  QueryHandlers,
  RollConstructor,
  RollEvaluateOptions,
  RollLike,
  RollTermLike,
  SceneLike,
  SettingConfig,
  SettingMenuConfig,
  SettingScope,
  SocketApi,
  StatusEffectConfig,
  SystemHandle,
  TextEditorConfig,
  TokenDocumentLike,
  TokenObjectLike,
  ToMessageOptions,
  UiApi,
  UserLike,
  WorldCollection,
  WorldHandle,
} from '@vttforge/types';

export type HookCallback<Args extends readonly unknown[] = readonly unknown[]> = (
  ...args: Args
) => unknown | Promise<unknown>;

export interface HooksApi {
  once<Args extends readonly unknown[]>(event: string, fn: HookCallback<Args>): number;
  on<Args extends readonly unknown[]>(event: string, fn: HookCallback<Args>): number;
  off(event: string, idOrFn: number | HookCallback): boolean;
  call(event: string, ...args: readonly unknown[]): boolean;
  callAll(event: string, ...args: readonly unknown[]): boolean;
}
