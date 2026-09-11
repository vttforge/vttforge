/**
 * The globals Foundry puts on `window`: `game`, `ui`, `CONFIG` and `CONST`.
 *
 * These carry the members Foundry documents for v13+ and v14. A system or
 * module reads them constantly, and until now every read was a cast.
 */

import type { ActorLike, DocumentMembers, ItemLike } from './documents.js';
import type { AnyClass } from './utils.js';

/**
 * Foundry's `Collection`, which every world collection and every embedded
 * collection extends. Keyed by document id.
 */
export interface FoundryCollection<V> extends Iterable<V> {
  readonly size: number;
  /** The values as an array. */
  readonly contents: V[];
  get(key: string, options?: { strict?: boolean }): V | undefined;
  /** Look one up by `name` rather than by id. */
  getName(name: string, options?: { strict?: boolean }): V | undefined;
  find(condition: (entry: V) => boolean): V | undefined;
  filter(condition: (entry: V) => boolean): V[];
  map<U>(transformer: (entry: V) => U): U[];
  reduce<U>(reducer: (carry: U, entry: V) => U, initial: U): U;
  forEach(fn: (entry: V) => void): void;
  some(condition: (entry: V) => boolean): boolean;
  every(condition: (entry: V) => boolean): boolean;
  keys(): IterableIterator<string>;
  values(): IterableIterator<V>;
  entries(): IterableIterator<[string, V]>;
  toJSON(): Record<string, unknown>[];
}

/**
 * A world-level collection, as `game.actors` and `game.items` are. It adds
 * document creation and compendium import on top of a plain collection.
 */
export interface WorldCollection<V> extends FoundryCollection<V> {
  readonly documentName: string;
  readonly name: string;
  readonly directory: unknown;
  importFromCompendium(
    pack: CompendiumCollection,
    id: string,
    updateData?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<V>;
}

/** One compendium pack. */
export interface CompendiumCollection extends FoundryCollection<unknown> {
  readonly collection: string;
  readonly metadata: {
    readonly id: string;
    readonly type: string;
    readonly label: string;
    readonly packageName: string;
    readonly packageType: string;
    readonly system?: string;
  };
  readonly index: FoundryCollection<{ _id: string; name: string; type?: string; img?: string }>;
  readonly locked: boolean;
  getDocument<T = unknown>(id: string): Promise<T | null>;
  getDocuments<T = unknown>(query?: Record<string, unknown>): Promise<T[]>;
  getIndex(options?: { fields?: readonly string[] }): Promise<FoundryCollection<unknown>>;
  importDocument<T = unknown>(document: T, options?: Record<string, unknown>): Promise<T>;
  configure(options: Record<string, unknown>): Promise<unknown>;
}

export type SettingScope = 'world' | 'client' | 'user';

export interface SettingConfig<T = unknown> {
  readonly name?: string;
  readonly hint?: string;
  readonly scope: SettingScope;
  /** Show it in the settings menu. Leave it off for a schema version. */
  readonly config?: boolean;
  readonly type: unknown;
  readonly default: T;
  readonly choices?: Readonly<Record<string, string>>;
  readonly range?: { readonly min: number; readonly max: number; readonly step?: number };
  readonly requiresReload?: boolean;
  readonly onChange?: (value: T) => void;
}

export interface SettingMenuConfig {
  readonly name: string;
  readonly label: string;
  readonly hint?: string;
  readonly icon?: string;
  readonly type: AnyClass;
  readonly restricted?: boolean;
}

export interface GameSettingsApi {
  register<T>(namespace: string, key: string, data: SettingConfig<T>): void;
  registerMenu(namespace: string, key: string, data: SettingMenuConfig): void;
  get<T = unknown>(namespace: string, key: string, options?: { document?: boolean }): T;
  set<T>(namespace: string, key: string, value: T, options?: { document?: boolean }): Promise<T>;
}

/**
 * `game.i18n`.
 *
 * `localize(id, data)` formats placeholders since v14, so `format` and
 * `localize` do the same job. `_loc` is a global shorthand for `localize`.
 */
export interface LocalizationApi {
  readonly lang: string;
  readonly defaultModule: string;
  readonly translations: Record<string, unknown>;
  has(stringId: string, fallback?: boolean): boolean;
  localize(stringId: string, data?: Record<string, unknown>): string;
  format(stringId: string, data?: Record<string, unknown>): string;
  getListFormatter(options?: {
    style?: 'long' | 'short' | 'narrow';
    type?: 'conjunction' | 'disjunction' | 'unit';
  }): Intl.ListFormat;
  sortObjects<T extends object>(objects: T[], key: string): T[];
}

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface NotificationOptions {
  /** Treat the message as a localization key. */
  localize?: boolean;
  permanent?: boolean;
  progress?: boolean;
  console?: boolean;
  escape?: boolean;
  clean?: boolean;
  format?: Record<string, unknown>;
}

export interface Notification {
  readonly id: number;
  readonly type: NotificationType;
  readonly message: string;
  pct?: number;
}

/** `ui.notifications`. */
export interface NotificationsApi {
  notify(message: string, type?: NotificationType, options?: NotificationOptions): Notification;
  info(message: string, options?: NotificationOptions): Readonly<Notification>;
  warn(message: string, options?: NotificationOptions): Readonly<Notification>;
  error(message: string | Error, options?: NotificationOptions): Readonly<Notification>;
  success(message: string, options?: NotificationOptions): Readonly<Notification>;
  update(notification: Notification, update: Partial<Notification>): void;
  remove(notification: Notification): void;
  has(notification: Notification | number): boolean;
  clear(): void;
}

/** `game.time`. */
export interface GameTimeApi {
  readonly worldTime: number;
  readonly components: Record<string, number>;
  readonly calendar: unknown;
  readonly earthCalendar: unknown;
  advance(delta: number, options?: Record<string, unknown>): Promise<number>;
  set(time: number, options?: Record<string, unknown>): Promise<number>;
  format(time?: number | object, formatter?: string, options?: Record<string, unknown>): string;
}

/** One connected or known user. */
export interface UserLike extends DocumentMembers {
  readonly isGM: boolean;
  readonly isSelf: boolean;
  readonly active: boolean;
  readonly color: unknown;
  readonly character: ActorLike | null;
  readonly targets: Set<unknown>;
  readonly viewedScene: string | null;
  hasPermission(permission: string): boolean;
  hasRole(role: string | number, options?: { exact?: boolean }): boolean;
  /** Call a handler registered in `CONFIG.queries` on this user's client. */
  query<T = unknown>(name: string, data: unknown, options?: { timeout?: number }): Promise<T>;
}

/** A package's own handle, as Foundry builds it from the manifest. */
export interface PackageHandle {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  /** Installed and switched on in this world. Always true for the system. */
  readonly active: boolean;
  /** The manifest's `"socket"` flag. Without it the channel is never opened. */
  readonly socket: boolean;
  readonly compatibility: { minimum?: string; verified?: string; maximum?: string };
  readonly flags: Record<string, unknown>;
  /** Whatever the package chose to expose. Yours to narrow. */
  api?: unknown;
}

/** The system this world runs on. */
export interface SystemHandle extends PackageHandle {
  readonly documentTypes: Record<string, Record<string, unknown>>;
  readonly grid: { type: number; distance: number; units: string; diagonals: number };
}

/** `game.world`. */
export interface WorldHandle {
  readonly id: string;
  readonly title: string;
  readonly system: string;
  readonly coreVersion: string;
  readonly systemVersion: string;
}

/** `game.socket`. The second argument of a listener is the sender's user id. */
export interface SocketApi {
  emit(channel: string, message: unknown, options?: { recipients?: readonly string[] }): void;
  on(channel: string, listener: (message: unknown, senderId?: string) => void): void;
  off(channel: string, listener?: (message: unknown, senderId?: string) => void): void;
}

/** `game.keyboard`. */
export interface KeyboardApi {
  readonly downKeys: Set<string>;
  readonly moveKeys: Set<string>;
  isModifierActive(modifier: string): boolean;
  hasFocus(): boolean;
}

/** `game.keybindings`. */
export interface KeybindingsApi {
  register(namespace: string, action: string, data: Record<string, unknown>): void;
  get(namespace: string, action: string): unknown[];
  set(namespace: string, action: string, bindings: readonly unknown[]): Promise<void>;
}

/**
 * The `game` global.
 *
 * `game.user` is null during `init`. Read it from `ready` onwards.
 */
export interface Game {
  readonly ready: boolean;
  readonly view: string;
  readonly data: Record<string, unknown>;
  readonly userId: string | null;
  readonly release: { generation: number; build: number; version: string };
  readonly world: WorldHandle;
  readonly system: SystemHandle;
  readonly modules: FoundryCollection<PackageHandle>;
  readonly permissions: Record<string, readonly number[]>;

  readonly user: UserLike | null;
  readonly users: WorldCollection<UserLike>;
  readonly actors: WorldCollection<ActorLike>;
  readonly items: WorldCollection<ItemLike>;
  readonly journal: WorldCollection<DocumentMembers>;
  readonly macros: WorldCollection<DocumentMembers>;
  readonly messages: WorldCollection<DocumentMembers>;
  readonly scenes: WorldCollection<DocumentMembers>;
  readonly tables: WorldCollection<DocumentMembers>;
  readonly playlists: WorldCollection<DocumentMembers>;
  readonly folders: WorldCollection<DocumentMembers>;
  readonly cards: WorldCollection<DocumentMembers>;
  readonly combats: WorldCollection<DocumentMembers>;
  readonly combat: DocumentMembers | null;
  readonly packs: FoundryCollection<CompendiumCollection>;

  readonly settings: GameSettingsApi;
  readonly i18n: LocalizationApi;
  readonly time: GameTimeApi;
  readonly socket: SocketApi | null;
  readonly keyboard: KeyboardApi;
  readonly keybindings: KeybindingsApi;
  readonly audio: unknown;
  readonly video: unknown;
  readonly tours: FoundryCollection<unknown>;

  readonly paused: boolean;
  readonly isAdmin: boolean;
  readonly activeTool: string;
  readonly version: string;
  /** Type defaults, the replacement for the removed `game.template`. */
  readonly model: Record<string, Record<string, unknown>>;
  readonly documentTypes: Record<string, string[]>;
}

/** The `ui` global. Only the members a package registers against. */
export interface UiApi {
  readonly notifications: NotificationsApi;
  readonly sidebar: {
    readonly expanded: boolean;
    expand(): void;
    collapse(): void;
    toggleExpanded(expanded?: boolean): void;
    changeTab(tab: string, group: string): void;
  };
  readonly actors: unknown;
  readonly items: unknown;
  readonly chat: unknown;
  readonly combat: unknown;
  readonly scenes: unknown;
  readonly journal: unknown;
  readonly tables: unknown;
  readonly playlists: unknown;
  readonly compendium: unknown;
  readonly settings: unknown;
  readonly controls: unknown;
  readonly hotbar: unknown;
  readonly players: unknown;
  readonly nav: unknown;
  readonly menu: unknown;
  readonly windows: Record<number, unknown>;
  readonly activeWindow: unknown;
}

/** One entry of `CONFIG.statusEffects`, which v14 indexes by `id`. */
export interface StatusEffectConfig {
  readonly id: string;
  readonly name?: string;
  readonly img?: string;
  readonly system?: { changes?: readonly Record<string, unknown>[] };
  readonly [key: string]: unknown;
}

/**
 * `CONFIG.queries`. A handler here can be called on this client by another
 * user through `User#query`, and its return value travels back.
 */
export type QueryHandlers = Record<
  string,
  (data: unknown, context: { timeout?: number; user?: UserLike }) => unknown
>;

/** What every `CONFIG.<Document>` entry carries. */
export interface DocumentConfig<TClass = AnyClass> {
  documentClass: TClass;
  dataModels: Record<string, AnyClass>;
  /** Icon per subtype, shown in the sidebar and on creation dialogs. */
  typeIcons?: Record<string, string>;
  typeLabels?: Record<string, string>;
  collection?: AnyClass;
  compendiumIndexFields?: string[];
  sheetClasses?: Record<string, Record<string, unknown>>;
  sidebar?: { applicationClass?: AnyClass; order?: number };
}

export interface ActiveEffectConfig extends DocumentConfig {
  /** Register a package's own change type here, in `init`. */
  changeTypes: Record<string, unknown>;
  phases: string[];
  expiryEvents: Record<string, string>;
  expiryAction: 'update' | 'delete' | null;
}

export interface CombatConfig extends DocumentConfig {
  initiative: { formula: string | null; decimals?: number };
}

export interface DiceConfig {
  rolls: AnyClass[];
  terms: Record<string, AnyClass>;
  functions: Record<string, (...args: readonly unknown[]) => unknown>;
  randomUniform: () => number;
  parser: AnyClass;
  fulfillment?: Record<string, unknown>;
}

export interface ChatMessageConfig extends DocumentConfig {
  /** The replacement for the removed `CONFIG.Dice.rollModes`. */
  modes: Record<string, { label: string; icon?: string }>;
  template?: string;
}

export interface TextEditorConfig {
  /** Inline syntax a package adds, such as `@Check[strength]`. */
  enrichers: {
    pattern: RegExp;
    enricher: (match: RegExpMatchArray, options: Record<string, unknown>) => Promise<Node | null>;
    id?: string;
    onRender?: (element: HTMLElement) => void;
  }[];
  engines?: Record<string, unknown>;
  inserts?: Record<string, unknown>;
}

/**
 * The `CONFIG` global.
 *
 * The document entries and the ones a package writes in `init` are named.
 * The index signature carries the rest of Foundry's own `CONFIG`, which is
 * large and mostly canvas internals.
 */
export interface FoundryConfig {
  Actor: DocumentConfig;
  Item: DocumentConfig;
  ActiveEffect: ActiveEffectConfig;
  Combat: CombatConfig;
  Combatant: DocumentConfig;
  ChatMessage: ChatMessageConfig;
  JournalEntry: DocumentConfig;
  JournalEntryPage: DocumentConfig;
  Scene: DocumentConfig;
  Token: DocumentConfig & { objectClass?: AnyClass; barConfig?: Record<string, unknown> };
  Macro: DocumentConfig;
  Folder: DocumentConfig;
  RollTable: DocumentConfig;
  Playlist: DocumentConfig;
  Cards: DocumentConfig;
  User: DocumentConfig;
  Dice: DiceConfig;
  TextEditor: TextEditorConfig;
  /** A Proxy indexed by status id since v14. Assign by id, never by push. */
  statusEffects: Record<string, StatusEffectConfig>;
  specialStatusEffects: Record<string, string>;
  queries: QueryHandlers;
  Canvas: {
    layers: Record<string, { layerClass: AnyClass; group: string }>;
    [key: string]: unknown;
  };
  debug: { hooks?: boolean; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * The `CONST` global.
 *
 * The enumerations a package reads. Each is an object frozen by Foundry, so
 * the values are read-only. The index signature carries the rest.
 */
export interface FoundryConstants {
  /** Change type to its default priority: `custom` 0, `add` 20, `override` 50. */
  readonly ACTIVE_EFFECT_CHANGE_TYPES: Readonly<{
    custom: number;
    multiply: number;
    add: number;
    subtract: number;
    downgrade: number;
    upgrade: number;
    override: number;
  }>;
  /** An array, not a record. Core runs `initial` then `final`. */
  readonly ACTIVE_EFFECT_CHANGE_PHASES: readonly ['initial', 'final'];
  readonly ACTIVE_EFFECT_DURATION_UNITS: readonly string[];
  readonly ACTIVE_EFFECT_EXPIRY_EVENTS: readonly [
    'combatStart',
    'roundStart',
    'turnStart',
    'combatEnd',
    'roundEnd',
    'turnEnd',
  ];
  readonly ACTIVE_EFFECT_SHOW_ICON: Readonly<{
    NEVER: number;
    CONDITIONAL: number;
    ALWAYS: number;
  }>;
  readonly DOCUMENT_OWNERSHIP_LEVELS: Readonly<{
    INHERIT: number;
    NONE: number;
    LIMITED: number;
    OBSERVER: number;
    OWNER: number;
  }>;
  readonly DOCUMENT_META_OWNERSHIP_LEVELS: Readonly<Record<string, number>>;
  readonly USER_ROLES: Readonly<{
    NONE: number;
    PLAYER: number;
    TRUSTED: number;
    ASSISTANT: number;
    GAMEMASTER: number;
  }>;
  readonly USER_ROLE_NAMES: Readonly<Record<number, string>>;
  readonly USER_PERMISSIONS: Readonly<Record<string, Record<string, unknown>>>;
  readonly CHAT_MESSAGE_STYLES: Readonly<{
    OTHER: number;
    OOC: number;
    IC: number;
    EMOTE: number;
  }>;
  readonly TOKEN_DISPLAY_MODES: Readonly<{
    NONE: number;
    CONTROL: number;
    OWNER_HOVER: number;
    HOVER: number;
    OWNER: number;
    ALWAYS: number;
  }>;
  readonly TOKEN_DISPOSITIONS: Readonly<{
    SECRET: number;
    HOSTILE: number;
    NEUTRAL: number;
    FRIENDLY: number;
  }>;
  readonly TOKEN_SHAPES: Readonly<Record<string, number>>;
  readonly GRID_TYPES: Readonly<{
    GRIDLESS: number;
    SQUARE: number;
    HEXODDR: number;
    HEXEVENR: number;
    HEXODDQ: number;
    HEXEVENQ: number;
  }>;
  readonly GRID_DIAGONALS: Readonly<Record<string, number>>;
  readonly GRID_SNAPPING_MODES: Readonly<Record<string, number>>;
  readonly REGION_VISIBILITY: Readonly<{
    LAYER_UNLOCKED: number;
    LAYER: number;
    GAMEMASTER: number;
    OBSERVER: number;
    ALWAYS: number;
  }>;
  readonly REGION_EVENTS: Readonly<Record<string, string>>;
  /** Replaces `WALL_SENSE_TYPES`, which warns since v14 and goes in v16. */
  readonly EDGE_SENSE_TYPES: Readonly<Record<string, number>>;
  readonly EDGE_DIRECTIONS: Readonly<Record<string, number>>;
  readonly WALL_RESTRICTION_TYPES: readonly string[];
  readonly WORLD_DOCUMENT_TYPES: readonly string[];
  readonly PRIMARY_DOCUMENT_TYPES: readonly string[];
  readonly EMBEDDED_DOCUMENT_TYPES: readonly string[];
  readonly ALL_DOCUMENT_TYPES: readonly string[];
  readonly COMPENDIUM_DOCUMENT_TYPES: readonly string[];
  readonly FOLDER_DOCUMENT_TYPES: readonly string[];
  readonly PACKAGE_TYPES: readonly string[];
  readonly SETTING_SCOPES: Readonly<{ CLIENT: string; WORLD: string; USER: string }>;
  readonly TABLE_RESULT_TYPES: Readonly<Record<string, string>>;
  readonly MACRO_TYPES: Readonly<{ SCRIPT: string; CHAT: string }>;
  readonly MACRO_SCOPES: readonly string[];
  readonly JOURNAL_ENTRY_PAGE_FORMATS: Readonly<{ HTML: number; MARKDOWN: number }>;
  readonly TEXT_ANCHOR_POINTS: Readonly<Record<string, number>>;
  readonly CSS_THEMES: Readonly<Record<string, string>>;
  readonly GAME_VIEWS: readonly string[];
  readonly IMAGE_FILE_EXTENSIONS: Readonly<Record<string, string>>;
  readonly VIDEO_FILE_EXTENSIONS: Readonly<Record<string, string>>;
  readonly AUDIO_FILE_EXTENSIONS: Readonly<Record<string, string>>;
  readonly vtt: string;
  readonly VTT: string;
  readonly WEBSITE_URL: string;
  readonly [key: string]: unknown;
}

/** What a package sees on `globalThis` inside the Foundry runtime. */
export interface FoundryGlobals {
  readonly game: Game;
  readonly ui: UiApi;
  readonly CONFIG: FoundryConfig;
  readonly CONST: FoundryConstants;
}
