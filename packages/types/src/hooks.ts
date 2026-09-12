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
import type { CompendiumCollection, FoundryCollection, UserLike } from './globals.js';
import type {
  CanvasApi,
  ChatMessageLike,
  CombatHistoryData,
  CombatLike,
  FolderLikeDocument,
  JournalEntryLike,
  MacroLike,
  PlaceableObjectLike,
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
/**
 * A document that has an object placed on the canvas.
 *
 * `MeasuredTemplate` is deprecated since v14 and still fires its hooks, so it
 * is here. Reach for a Region instead when you write new code.
 */
export type PlaceableDocumentName =
  | 'AmbientLight'
  | 'AmbientSound'
  | 'Drawing'
  | 'MeasuredTemplate'
  | 'Note'
  | 'Region'
  | 'Tile'
  | 'Token'
  | 'Wall';

/** The object each placed document draws. */
export interface PlaceableObjectMap {
  AmbientLight: PlaceableObjectLike;
  AmbientSound: PlaceableObjectLike;
  Drawing: PlaceableObjectLike;
  MeasuredTemplate: PlaceableObjectLike;
  Note: PlaceableObjectLike;
  Region: PlaceableObjectLike;
  Tile: PlaceableObjectLike;
  Token: TokenObjectLike;
  Wall: PlaceableObjectLike;
}

/**
 * A layer Foundry draws on the canvas.
 *
 * The name is the layer's base class, so a system that subclasses `TokenLayer`
 * still fires `drawTokenLayer`.
 */
export type CanvasLayerName =
  | 'ControlsLayer'
  | 'DrawingsLayer'
  | 'GridLayer'
  | 'LightingLayer'
  | 'NotesLayer'
  | 'RegionLayer'
  | 'SoundsLayer'
  | 'TemplateLayer'
  | 'TilesLayer'
  | 'TokenLayer'
  | 'WallsLayer'
  | 'WeatherEffects';

/** A layer that takes tools and selection. These are the ones you activate. */
export type InteractionLayerName = Exclude<
  CanvasLayerName,
  'ControlsLayer' | 'GridLayer' | 'WeatherEffects'
>;

/** What a canvas layer hands its hooks. */
export interface CanvasLayerLike {
  readonly name: string;
  readonly hookName: string;
  readonly active: boolean;
}

/**
 * The hooks a placed object fires, one name per document.
 *
 * Foundry builds the name from the document, so a token fires `drawToken` and
 * a tile fires `drawTile`. There is no `drawObject`: that name appears in
 * Foundry's hook documentation to describe the family, and nothing calls it.
 */
export type PlaceableHooks = {
  [K in PlaceableDocumentName as `draw${K}`]: [PlaceableObjectMap[K]];
} & {
  [K in PlaceableDocumentName as `refresh${K}`]: [PlaceableObjectMap[K], Record<string, boolean>];
} & {
  [K in PlaceableDocumentName as `destroy${K}`]: [PlaceableObjectMap[K]];
} & {
  [K in PlaceableDocumentName as `control${K}`]: [PlaceableObjectMap[K], boolean];
} & {
  [K in PlaceableDocumentName as `hover${K}`]: [PlaceableObjectMap[K], boolean];
} & {
  [K in PlaceableDocumentName as `paste${K}`]: [
    PlaceableObjectMap[K][],
    Record<string, unknown>[],
    { cut: boolean },
  ];
};

/**
 * A group the canvas draws. Layers live inside these.
 *
 * The name is the group's class, the same way a layer's is.
 */
export type CanvasGroupName =
  | 'CanvasVisibility'
  | 'EffectsCanvasGroup'
  | 'EnvironmentCanvasGroup'
  | 'HiddenCanvasGroup'
  | 'InterfaceCanvasGroup'
  | 'OverlayCanvasGroup'
  | 'PrimaryCanvasGroup'
  | 'RenderedCanvasGroup';

/** An effect source that builds shaders: lights, darkness and vision. */
export type RenderedEffectSourceName =
  | 'GlobalLightSource'
  | 'PointDarknessSource'
  | 'PointLightSource'
  | 'PointVisionSource';

/** The hooks a canvas layer fires, one name per layer. */
export type CanvasLayerHooks = {
  [K in CanvasLayerName as `draw${K}`]: [CanvasLayerLike, Record<string, unknown>];
} & {
  [K in CanvasLayerName as `tearDown${K}`]: [CanvasLayerLike, Record<string, unknown>];
} & {
  [K in InteractionLayerName as `activate${K}`]: [CanvasLayerLike];
} & {
  [K in InteractionLayerName as `deactivate${K}`]: [CanvasLayerLike];
} & {
  [K in CanvasGroupName as `draw${K}`]: [unknown, Record<string, unknown>];
} & {
  [K in CanvasGroupName as `tearDown${K}`]: [unknown, Record<string, unknown>];
} & {
  [K in RenderedEffectSourceName as `initialize${K}Shaders`]: [unknown];
};

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
  /** The audio and video settings, and what changed in them. */
  rtcSettingsChanged: [unknown, Record<string, unknown>];
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
  //
  // The lighting, vision and environment hooks hand over a canvas group or the
  // visibility layer. Neither is typed here: wrapping the canvas is not what
  // this package does, and a name with the right arity is worth more than a
  // shape invented for it. Typing one later fills every slot at once.
  canvasConfig: [Record<string, unknown>];
  canvasInit: [CanvasApi];
  canvasReady: [CanvasApi];
  canvasDraw: [CanvasApi];
  canvasPan: [CanvasApi, { x: number; y: number; scale: number }];
  canvasTearDown: [CanvasApi, Record<string, unknown>];
  dropCanvasData: [CanvasApi, Record<string, unknown>, DragEvent];
  highlightObjects: [boolean];
  initializeEdges: [SceneLike];
  activateCanvasLayer: [unknown];
  /** The environment config, before the canvas reads it. */
  configureCanvasEnvironment: [Record<string, unknown>];
  initializeCanvasEnvironment: [];
  /** The effects group, after its light sources are built. */
  initializeLightSources: [unknown];
  initializePriorityLightSources: [unknown];
  lightingRefresh: [unknown];
  /** The visibility layer. */
  initializeVisionMode: [unknown];
  sightRefresh: [unknown];
  visibilityRefresh: [unknown];
  /** Every vision source on the canvas, keyed by id. */
  initializeVisionSources: [FoundryCollection<unknown>];
  /** The weather layer and the config it was given. */
  initializeWeatherEffects: [unknown, Record<string, unknown>];
  /** `CONFIG.Token.ring`, before the ring is built. */
  initializeDynamicTokenRingConfig: [unknown];

  // Placeables
  targetToken: [UserLike, TokenObjectLike, boolean];
  applyTokenStatusEffect: [TokenObjectLike, string, boolean];
  /**
   * Replaced by `renderChatMessageHTML`, and removed in v15. The second
   * argument is the jQuery object the old hook passed.
   */
  renderChatMessage: [ChatMessageLike, unknown, Record<string, unknown>];
  /** Replaced by `chatBubbleHTML`, and removed in v15. */
  chatBubble: [TokenObjectLike, unknown, string, Record<string, unknown>];
  /** The editor a legacy rich text field opened. Removed in v15. */
  activateEditorLegacy: [unknown, Record<string, unknown>, string];
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
  preRenderApplicationV2: [
    ApplicationV2Members,
    ApplicationRenderContext,
    ApplicationRenderOptions,
  ];
  renderApplicationV2: [
    ApplicationV2Members,
    HTMLElement,
    ApplicationRenderContext,
    ApplicationRenderOptions,
  ];
  closeApplicationV2: [ApplicationV2Members];
  getHeaderControlsApplicationV2: [ApplicationV2Members, ApplicationHeaderControlsEntry[]];
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
export interface HookMap
  extends StaticHooks,
    DocumentLifecycleHooks,
    ContextMenuHooks,
    PlaceableHooks,
    CanvasLayerHooks {}

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
