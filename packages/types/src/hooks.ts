/**
 * Foundry's hook catalogue, typed by name.
 *
 * `Hooks.on('createActor', (actor) => ...)` infers `actor` from the name.
 * The names Foundry ships are here; the ones a package invents at runtime
 * are not, and they fall through to the open overloads on `HooksApi`.
 *
 * Three families are generated rather than listed, because Foundry builds
 * their names from a document or a class name:
 *
 * - `create<Document>`, `update<Document>`, `delete<Document>` and the
 *   matching `pre` forms.
 * - `render<Class>`, `close<Class>`, `preRender<Class>`.
 * - `get<Document>ContextOptions`.
 */

import type {
  ApplicationHeaderControlsEntry,
  ApplicationRenderContext,
  ApplicationRenderOptions,
} from './application.js';
import type { ActiveEffectLike, ActorLike, DocumentMembers, ItemLike } from './documents.js';
import type { ApplicationV2Members } from './foundry.js';
import type { CompendiumCollection, UserLike } from './globals.js';
import type {
  CanvasApi,
  ChatMessageLike,
  CombatHistoryData,
  CombatLike,
  FolderLikeDocument,
  JournalEntryLike,
  MacroLike,
  SceneLike,
  TokenDocumentLike,
  TokenObjectLike,
} from './world-documents.js';

/** Options a document write carries through to its hooks. */
export interface DatabaseOperationOptions {
  render?: boolean;
  renderSheet?: boolean;
  noHook?: boolean;
  diff?: boolean;
  recursive?: boolean;
  [key: string]: unknown;
}

/** Which type each document name resolves to. */
export interface DocumentTypeMap {
  Actor: ActorLike;
  Item: ItemLike;
  ActiveEffect: ActiveEffectLike;
  ChatMessage: ChatMessageLike;
  Combat: CombatLike;
  Combatant: DocumentMembers;
  Scene: SceneLike;
  Token: TokenDocumentLike;
  JournalEntry: JournalEntryLike;
  JournalEntryPage: DocumentMembers;
  Macro: MacroLike;
  Folder: FolderLikeDocument;
  RollTable: DocumentMembers;
  Playlist: DocumentMembers;
  PlaylistSound: DocumentMembers;
  Cards: DocumentMembers;
  Card: DocumentMembers;
  User: UserLike;
  Wall: DocumentMembers;
  AmbientLight: DocumentMembers;
  AmbientSound: DocumentMembers;
  Drawing: DocumentMembers;
  MeasuredTemplate: DocumentMembers;
  Note: DocumentMembers;
  Region: DocumentMembers;
  RegionBehavior: DocumentMembers;
  Tile: DocumentMembers;
  Level: DocumentMembers;
  Setting: DocumentMembers;
  FogExploration: DocumentMembers;
  Adventure: DocumentMembers;
}

export type DocumentHookName = keyof DocumentTypeMap;

/**
 * The document lifecycle hooks.
 *
 * A `pre` hook may return `false` to cancel the write. The rest run after it
 * lands, on every connected client: guard a side effect with
 * `if (game.userId !== userId) return;`.
 */
export type DocumentLifecycleHooks = {
  [K in DocumentHookName as `create${K}`]: [DocumentTypeMap[K], DatabaseOperationOptions, string];
} & {
  [K in DocumentHookName as `preCreate${K}`]: [
    DocumentTypeMap[K],
    Record<string, unknown>,
    DatabaseOperationOptions,
    string,
  ];
} & {
  [K in DocumentHookName as `update${K}`]: [
    DocumentTypeMap[K],
    Record<string, unknown>,
    DatabaseOperationOptions,
    string,
  ];
} & {
  [K in DocumentHookName as `preUpdate${K}`]: [
    DocumentTypeMap[K],
    Record<string, unknown>,
    DatabaseOperationOptions,
    string,
  ];
} & {
  [K in DocumentHookName as `delete${K}`]: [DocumentTypeMap[K], DatabaseOperationOptions, string];
} & {
  [K in DocumentHookName as `preDelete${K}`]: [
    DocumentTypeMap[K],
    DatabaseOperationOptions,
    string,
  ];
};

/** The sidebar context menu hooks, one per document. */
export type ContextMenuHooks = {
  [K in DocumentHookName as `get${K}ContextOptions`]: [ApplicationV2Members, ContextMenuEntry[]];
} & {
  [K in DocumentHookName as `get${K}PlaceableContextOptions`]: [
    ApplicationV2Members,
    ContextMenuEntry[],
  ];
};

/** One entry of a context menu. */
export interface ContextMenuEntry {
  name: string;
  icon?: string;
  classes?: string;
  group?: string;
  condition?: boolean | ((target: HTMLElement) => boolean);
  callback: (target: HTMLElement) => void;
}

/** One button in the scene controls. */
export interface SceneControl {
  name: string;
  title: string;
  icon: string;
  order?: number;
  visible?: boolean;
  tools: Record<string, unknown>;
  activeTool?: string;
}

/** What a hot reload hands over. */
export interface HotReloadData {
  packageType: string;
  packageId: string;
  content: string;
  path: string;
  extension: string;
}

/** The hooks Foundry names itself. */
export interface StaticHooks {
  // Lifecycle
  init: [];
  i18nInit: [];
  setup: [];
  ready: [];
  streamReady: [];
  error: [string, Error, Record<string, unknown>];
  pauseGame: [boolean, { broadcast?: boolean; userId?: string }];
  updateWorldTime: [number, number, Record<string, unknown>, string];
  hotReload: [HotReloadData];
  userConnected: [UserLike, boolean];
  clientSettingChanged: [string, unknown, Record<string, unknown>];
  /**
   * Declared by Foundry, and nothing fires it. The three below are what a
   * volume change actually calls.
   */
  globalVolumeChanged: [number];
  /** The music channel. The argument is clamped to 0 through 1. */
  globalPlaylistVolumeChanged: [number];
  /** The ambient channel. The argument is clamped to 0 through 1. */
  globalAmbientVolumeChanged: [number];
  /** The interface channel. The argument is clamped to 0 through 1. */
  globalInterfaceVolumeChanged: [number];

  // Canvas
  canvasConfig: [Record<string, unknown>];
  canvasInit: [CanvasApi];
  canvasReady: [CanvasApi];
  canvasDraw: [CanvasApi];
  canvasPan: [CanvasApi, { x: number; y: number; scale: number }];
  canvasTearDown: [CanvasApi, Record<string, unknown>];
  dropCanvasData: [CanvasApi, Record<string, unknown>, DragEvent];
  highlightObjects: [boolean];
  initializeEdges: [SceneLike];
  drawLayer: [unknown, Record<string, unknown>];
  tearDownLayer: [unknown, Record<string, unknown>];
  activateLayer: [unknown];
  activateCanvasLayer: [unknown];
  deactivateLayer: [unknown];
  pastePlaceableObject: [unknown[], Record<string, unknown>[], { cut: boolean }];

  // Placeables
  drawObject: [unknown];
  refreshObject: [unknown];
  destroyObject: [unknown];
  controlObject: [unknown, boolean];
  hoverObject: [unknown, boolean];
  targetToken: [UserLike, TokenObjectLike, boolean];
  applyTokenStatusEffect: [TokenObjectLike, string, boolean];
  chatBubbleHTML: [TokenObjectLike, HTMLElement, string, Record<string, unknown>];
  modifyTokenAttribute: [
    { attribute: string; value: number; isDelta: boolean; isBar: boolean },
    Record<string, unknown>,
    ActorLike,
  ];
  /** New in v14, alongside the rest of the token movement family. */
  planToken: [TokenDocumentLike];
  moveToken: [TokenDocumentLike, Record<string, unknown>, Record<string, unknown>, UserLike];
  preMoveToken: [TokenDocumentLike, Record<string, unknown>, Record<string, unknown>];
  stopToken: [TokenDocumentLike];
  pauseToken: [TokenDocumentLike];
  recordToken: [TokenDocumentLike];
  activateNote: [unknown, Record<string, unknown>];

  // Applications
  preRenderApplication: [ApplicationV2Members, ApplicationRenderContext, ApplicationRenderOptions];
  renderApplicationV2: [
    ApplicationV2Members,
    HTMLElement,
    ApplicationRenderContext,
    ApplicationRenderOptions,
  ];
  closeApplicationV2: [ApplicationV2Members];
  getHeaderControlsApplicationV2: [ApplicationV2Members, ApplicationHeaderControlsEntry[]];
  getDocumentContextOptions: [ApplicationV2Members, ContextMenuEntry[]];
  getPlaceableContextOptions: [ApplicationV2Members, ContextMenuEntry[]];
  getSceneControlButtons: [Record<string, SceneControl>];
  hotbarDrop: [unknown, Record<string, unknown>, number];
  collapseSidebar: [unknown, boolean];
  changeSidebarTab: [unknown];
  collapseSceneNavigation: [unknown, boolean];
  /** New in v14: an application moved into its own browser window. */
  openDetachedWindow: [string, WindowProxy];
  closeDetachedWindow: [string, WindowProxy];

  // Chat
  chatInput: [KeyboardEvent, { recordPending: boolean }];
  chatMessage: [unknown, string, Record<string, unknown>];
  renderChatInput: [unknown, Record<string, HTMLElement>, Record<string, unknown>];
  /** `renderChatMessage`, the jQuery one, is deprecated and goes in v15. */
  renderChatMessageHTML: [ChatMessageLike, HTMLElement, Record<string, unknown>];

  // Combat
  combatStart: [CombatLike, { round: number; turn: number }];
  combatTurn: [CombatLike, { round: number; turn: number }, { direction: number }];
  combatRound: [CombatLike, { round: number; turn: number }, { direction: number }];
  combatTurnChange: [CombatLike, CombatHistoryData, CombatHistoryData];
  initializeCombatConfiguration: [Record<string, unknown>];

  // Documents and packages
  applyActiveEffect: [
    ActorLike,
    Record<string, unknown>,
    unknown,
    unknown,
    Record<string, unknown>,
  ];
  updateCompendium: [CompendiumCollection, DocumentMembers[], Record<string, unknown>, string];
  applyCompendiumArt: [
    unknown,
    Record<string, unknown>,
    CompendiumCollection,
    Record<string, unknown>,
  ];
  preImportAdventure: [
    DocumentMembers,
    Record<string, unknown>,
    Record<string, Record<string, unknown>[]>,
    Record<string, Record<string, unknown>[]>,
  ];
  importAdventure: [
    DocumentMembers,
    Record<string, unknown>,
    Record<string, DocumentMembers[]>,
    Record<string, DocumentMembers[]>,
  ];
  dropActorSheetData: [ActorLike, ApplicationV2Members, Record<string, unknown>];
  /** New in v14. */
  dropItemSheetData: [ItemLike, ApplicationV2Members, Record<string, unknown>];
  dropRollTableSheetData: [DocumentMembers, ApplicationV2Members, Record<string, unknown>];
  dealCards: [DocumentMembers, DocumentMembers[], Record<string, unknown>];
  passCards: [DocumentMembers, DocumentMembers, Record<string, unknown>];
  returnCards: [DocumentMembers, DocumentMembers[], Record<string, unknown>];

  // Editor
  getProseMirrorMenuDropDowns: [unknown];
  getProseMirrorMenuItems: [unknown, unknown[]];
  createProseMirrorEditor: [string, Record<string, unknown>];
}

/** Every hook name Foundry ships, with the arguments it passes. */
export interface HookMap extends StaticHooks, DocumentLifecycleHooks, ContextMenuHooks {}

export type HookName = keyof HookMap;

/** A listener for a named hook. */
export type HookCallback<Args extends readonly unknown[] = readonly unknown[]> = (
  ...args: Args
) => unknown;

/**
 * The `Hooks` global.
 *
 * A known name infers its arguments. A `render<Class>` or `close<Class>` name
 * a package invents falls to the application shape, since that is what those
 * hooks always carry. Anything else is open, because a package may call
 * `Hooks.callAll` with a name of its own.
 */
export interface HooksApi {
  on<K extends HookName>(event: K, fn: HookCallback<HookMap[K]>): number;
  on(
    event: `render${string}`,
    fn: HookCallback<
      [ApplicationV2Members, HTMLElement, ApplicationRenderContext, ApplicationRenderOptions]
    >,
  ): number;
  on(
    event: `preRender${string}`,
    fn: HookCallback<[ApplicationV2Members, ApplicationRenderContext, ApplicationRenderOptions]>,
  ): number;
  on(event: `close${string}`, fn: HookCallback<[ApplicationV2Members]>): number;
  on(event: string, fn: HookCallback): number;

  once<K extends HookName>(event: K, fn: HookCallback<HookMap[K]>): number;
  once(
    event: `render${string}`,
    fn: HookCallback<
      [ApplicationV2Members, HTMLElement, ApplicationRenderContext, ApplicationRenderOptions]
    >,
  ): number;
  once(event: string, fn: HookCallback): number;

  /** Pass the id `on` returned, or the same function reference. */
  off(event: string, idOrFn: number | HookCallback): boolean;
  /** Stops at the first listener that returns `false`. */
  call<K extends HookName>(event: K, ...args: HookMap[K]): boolean;
  call(event: string, ...args: readonly unknown[]): boolean;
  /** Runs every listener, whatever they return. */
  callAll<K extends HookName>(event: K, ...args: HookMap[K]): boolean;
  callAll(event: string, ...args: readonly unknown[]): boolean;
}
