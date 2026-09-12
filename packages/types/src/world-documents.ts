/**
 * The world documents past Actor and Item: chat messages, combat, scenes,
 * tokens and the rest.
 *
 * Fields follow each document's own schema for v14; the getters and methods
 * follow Foundry's published API. Where a document carries `type` and
 * `system`, the `System` parameter is that data.
 */

import type { RollLike, ToMessageOptions } from './dice.js';
import type { ActorLike, DocumentMembers, EmbeddedCollection } from './documents.js';
import type { UserLike } from './globals.js';

/** Who a chat message is attributed to. */
export interface ChatSpeakerData {
  scene: string | null;
  actor: string | null;
  token: string | null;
  alias: string;
}

/** A chat message. */
export interface ChatMessageLike<System = Record<string, unknown>> extends DocumentMembers<System> {
  readonly style: number;
  readonly author: UserLike | null;
  readonly timestamp: number;
  readonly content: string;
  readonly flavor: string;
  readonly title: string;
  readonly speaker: ChatSpeakerData;
  readonly whisper: string[];
  readonly blind: boolean;
  readonly emote: boolean;
  readonly rolls: RollLike[];
  readonly sound: string | null;

  /** The speaker's display name. */
  readonly alias: string;
  readonly isAuthor: boolean;
  readonly isContentVisible: boolean;
  readonly isRoll: boolean;
  readonly visible: boolean;
  readonly speakerActor: ActorLike | null;

  getRollData(): Record<string, unknown>;
  renderHTML(options?: { canDelete?: boolean; canClose?: boolean }): Promise<HTMLElement>;
  /** Apply a `CONFIG.ChatMessage.modes` key to this message. */
  applyMode(mode: string): void;
  export(): string;
}

/** The `ChatMessage` class itself. */
export interface ChatMessageConstructor {
  create(
    data: Record<string, unknown>,
    options?: ToMessageOptions & Record<string, unknown>,
  ): Promise<ChatMessageLike | undefined>;
  getSpeaker(options?: {
    scene?: SceneLike;
    actor?: ActorLike;
    token?: TokenDocumentLike;
    alias?: string;
  }): ChatSpeakerData;
  getSpeakerActor(speaker: ChatSpeakerData): ActorLike | null;
  getWhisperRecipients(name: string): UserLike[];
  /** Apply a mode to message data before it is created. */
  applyMode(chatData: Record<string, unknown>, mode?: string): string;
}

/** One combatant in an encounter. */
export interface CombatantLike<System = Record<string, unknown>> extends DocumentMembers<System> {
  readonly actorId: string | null;
  readonly tokenId: string | null;
  readonly sceneId: string | null;
  readonly initiative: number | null;
  readonly hidden: boolean;
  readonly defeated: boolean;
  readonly group: string | null;
  /** The round this combatant joined. 1 for one that started the encounter. */
  readonly roundJoined: number;
  readonly actor: ActorLike | null;
  readonly token: TokenDocumentLike | null;
  readonly combat: CombatLike | null;
  readonly isOwner: boolean;
  readonly visible: boolean;
  getInitiativeRoll(formula?: string): RollLike;
  rollInitiative(formula?: string): Promise<this>;
}

/** How the tracker moved between turns. */
export interface CombatHistoryData {
  round: number | null;
  turn: number | null;
  tokenId: string | null;
  combatantId: string | null;
}

/** An encounter. */
export interface CombatLike<System = Record<string, unknown>> extends DocumentMembers<System> {
  readonly round: number;
  readonly turn: number | null;
  readonly active: boolean;
  readonly scene: SceneLike | null;
  readonly combatants: EmbeddedCollection<CombatantLike>;
  readonly turns: CombatantLike[];
  readonly combatant: CombatantLike | null;
  readonly nextCombatant: CombatantLike | null;
  readonly started: boolean;
  readonly visible: boolean;
  readonly isActive: boolean;
  readonly current: CombatHistoryData;
  readonly previous: CombatHistoryData;

  startCombat(): Promise<this>;
  endCombat(): Promise<this>;
  nextRound(): Promise<this>;
  previousRound(): Promise<this>;
  nextTurn(): Promise<this>;
  previousTurn(): Promise<this>;
  resetAll(options?: { updateTurn?: boolean }): Promise<this>;
  /**
   * Roll initiative for the named combatants.
   *
   * `messageMode` replaced `messageOptions.rollMode` in v14.
   */
  rollInitiative(
    ids: readonly string[],
    options?: {
      formula?: string | null;
      updateTurn?: boolean;
      messageMode?: string;
      messageOptions?: Record<string, unknown>;
    },
  ): Promise<this>;
  rollAll(options?: Record<string, unknown>): Promise<this>;
  rollNPC(options?: Record<string, unknown>): Promise<this>;
  setInitiative(id: string, value: number): Promise<void>;
  setupTurns(): CombatantLike[];
  /** Both return arrays since v14. The singular pair is deprecated. */
  getCombatantsByActor(actor: ActorLike | string): CombatantLike[];
  getCombatantsByToken(token: TokenDocumentLike | string): CombatantLike[];
}

/** A token's position and size on a scene. */
export interface TokenDocumentLike<System = Record<string, unknown>>
  extends DocumentMembers<System> {
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly width: number;
  readonly height: number;
  /** New in v14, alongside `level`. */
  readonly depth: number;
  readonly shape: number;
  /** The Level document this token stands on. New in v14. */
  readonly level: string;
  readonly rotation: number;
  readonly alpha: number;
  readonly hidden: boolean;
  readonly locked: boolean;
  readonly lockRotation: boolean;
  readonly sort: number;
  readonly disposition: number;
  readonly displayName: number;
  readonly displayBars: number;
  readonly actorId: string | null;
  readonly actorLink: boolean;
  readonly actor: ActorLike | null;
  readonly combatant: CombatantLike | null;
  readonly inCombat: boolean;
  readonly object: TokenObjectLike | null;
  readonly texture: { src: string | null; [key: string]: unknown };
  readonly bar1: { attribute: string | null };
  readonly bar2: { attribute: string | null };
  readonly sight: { enabled: boolean; range: number; [key: string]: unknown };
  readonly light: Record<string, unknown>;
  readonly movementAction: string;
  getCenterPoint(data?: Record<string, unknown>): { x: number; y: number; elevation: number };
  getSize(data?: Record<string, unknown>): { width: number; height: number };
  getUserLevel(user: UserLike): number | null;
}

/** The drawn token on the canvas, not the document. */
/**
 * What every object placed on the canvas carries.
 *
 * A token adds to it: see `TokenObjectLike`. The others have no members of
 * their own here yet, because no consumer has asked for one.
 */
export interface PlaceableObjectLike {
  readonly id: string;
  readonly document: DocumentMembers;
  /** The point the object is centred on, in scene coordinates. */
  readonly center: { x: number; y: number };
  readonly bounds: { x: number; y: number; width: number; height: number };
  readonly controlled: boolean;
  readonly hover: boolean;
  readonly isVisible: boolean;
  control(options?: Record<string, unknown>): boolean;
  release(options?: Record<string, unknown>): boolean;
}

export interface TokenObjectLike extends PlaceableObjectLike {
  readonly document: TokenDocumentLike;
  readonly actor: ActorLike | null;
  readonly name: string;
  readonly w: number;
  readonly h: number;
  readonly isTargeted: boolean;
  readonly inCombat: boolean;
  readonly combatant: CombatantLike | null;
  setTarget(targeted?: boolean, options?: Record<string, unknown>): void;
}

/** A Level document. New in v14: a scene's background lives here. */
export interface LevelLike extends DocumentMembers {
  readonly background: { src: string | null; [key: string]: unknown };
  readonly foreground: { src: string | null; [key: string]: unknown };
  readonly elevation: { bottom: number; top: number };
}

/** A scene. */
export interface SceneLike<System = Record<string, unknown>> extends DocumentMembers<System> {
  readonly active: boolean;
  readonly navigation: boolean;
  readonly navName: string;
  readonly navOrder: number;
  readonly thumb: string | null;
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly grid: {
    type: number;
    size: number;
    distance: number;
    units: string;
    style: string;
    [key: string]: unknown;
  };
  readonly tokenVision: boolean;
  readonly weather: string;
  /** New in v14. The background and fog moved onto these. */
  readonly levels: EmbeddedCollection<LevelLike>;
  readonly initialLevel: LevelLike | null;
  readonly firstLevel: LevelLike | null;
  readonly tokens: EmbeddedCollection<TokenDocumentLike>;
  readonly drawings: EmbeddedCollection<DocumentMembers>;
  readonly lights: EmbeddedCollection<DocumentMembers>;
  readonly notes: EmbeddedCollection<DocumentMembers>;
  readonly sounds: EmbeddedCollection<DocumentMembers>;
  readonly regions: EmbeddedCollection<DocumentMembers>;
  readonly tiles: EmbeddedCollection<DocumentMembers>;
  readonly walls: EmbeddedCollection<DocumentMembers>;
  readonly isView: boolean;
  readonly dimensions: Record<string, number>;
  activate(): Promise<this>;
  view(): Promise<this>;
}

/** A journal entry. */
export interface JournalEntryLike extends DocumentMembers {
  readonly pages: EmbeddedCollection<DocumentMembers>;
  readonly categories: EmbeddedCollection<DocumentMembers>;
  readonly sort: number;
}

/** A macro. */
export interface MacroLike extends DocumentMembers {
  readonly scope: string;
  readonly command: string;
  readonly author: UserLike | null;
  readonly canExecute: boolean;
  execute(scope?: Record<string, unknown>): Promise<unknown>;
}

/** A folder. */
export interface FolderLikeDocument extends DocumentMembers {
  readonly sorting: string;
  readonly color: unknown;
  readonly depth: number;
  readonly children: FolderLikeDocument[];
  readonly contents: DocumentMembers[];
}

/** The `canvas` global. */
export interface CanvasApi {
  readonly ready: boolean;
  readonly initialized: boolean;
  readonly id: string | null;
  readonly scene: SceneLike | null;
  /** The Level being viewed. New in v14. */
  readonly level: LevelLike | null;
  readonly dimensions: Record<string, number>;
  readonly grid: Record<string, unknown>;
  readonly activeLayer: unknown;
  readonly layers: Record<string, unknown>;
  readonly tokens: {
    readonly placeables: TokenObjectLike[];
    readonly controlled: TokenObjectLike[];
    get(id: string): TokenObjectLike | undefined;
  };
  readonly regions: {
    placeRegion(
      data: Record<string, unknown>,
      options?: { create?: boolean },
    ): Promise<DocumentMembers | null>;
    templateMode: boolean;
  };
  readonly walls: unknown;
  readonly lighting: unknown;
  readonly sounds: unknown;
  readonly notes: unknown;
  readonly tiles: unknown;
  readonly drawings: unknown;
  readonly effects: unknown;
  readonly edges: unknown;
  readonly masks: unknown;
  readonly colors: Record<string, unknown>;
  readonly darknessLevel: number;
  pan(position?: { x?: number; y?: number; scale?: number }): void;
  animatePan(position?: Record<string, unknown>): Promise<void>;
  draw(scene?: SceneLike): Promise<CanvasApi>;
}
