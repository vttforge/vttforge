/**
 * The document surface the VTTForge bases hand to a consumer.
 *
 * Same rule as the rest of this package: every member here is one a real
 * consumer reached for, not one that exists in Foundry. The list came from
 * reading the systems and modules already ported to the SDK and counting
 * what their sheets and drop handlers actually touch. Reaching past it is a
 * cast, and a cast is a sentence you write on purpose.
 *
 * Names and shapes follow Foundry's published API for v13+ and v14.
 */

/** A document's `flags`, keyed by package id then by flag key. */
export type DocumentFlags = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

/**
 * An embedded collection, as `actor.items` and `actor.effects` are.
 *
 * Foundry's own collection carries more than this. These are the members a
 * ported sheet used: look one up, walk them, count them.
 */
export interface EmbeddedCollection<T> extends Iterable<T> {
  readonly size: number;
  readonly contents: readonly T[];
  get(id: string): T | undefined;
  find(fn: (entry: T) => boolean): T | undefined;
  filter(fn: (entry: T) => boolean): T[];
  map<U>(fn: (entry: T) => U): U[];
  reduce<U>(fn: (carry: U, entry: T) => U, initial: U): U;
  some(fn: (entry: T) => boolean): boolean;
}

/**
 * What every document carries, whatever kind it is.
 *
 * `System` is the document's `system` data. It defaults to an open record, so
 * a consumer who has not said what their schema is still compiles; pass the
 * inferred type from `BaseTypeDataModel` to get the fields.
 */
export interface DocumentMembers<System = Record<string, unknown>> {
  readonly id: string | null;
  readonly uuid: string;
  readonly name: string;
  /** The subtype, as declared under `documentTypes` in the manifest. */
  readonly type: string;
  /** The type data model instance. Its fields are the schema's fields. */
  readonly system: System;
  readonly img: string | null;
  /** `'Actor'`, `'Item'`, `'ActiveEffect'`, and so on. */
  readonly documentName: string;
  /** The document this one is embedded in, or `null` at the top level. */
  readonly parent: DocumentMembers | null;
  readonly flags: DocumentFlags;
  /** Whether the current user owns this document. */
  readonly isOwner: boolean;

  getFlag<T = unknown>(scope: string, key: string): T | undefined;
  setFlag(scope: string, key: string, value: unknown): Promise<this>;
  unsetFlag(scope: string, key: string): Promise<this>;

  update(
    data: Record<string, unknown>,
    operation?: Record<string, unknown>,
  ): Promise<this | undefined>;
  delete(operation?: Record<string, unknown>): Promise<this | undefined>;

  /** A plain-object copy. `source` reads the stored data instead of the prepared data. */
  toObject(source?: boolean): Record<string, unknown>;
}

/** The embedded-document writes a sheet makes on its own document. */
export interface EmbeddedDocumentOwner {
  createEmbeddedDocuments(
    name: string,
    data: readonly Record<string, unknown>[],
    operation?: Record<string, unknown>,
  ): Promise<unknown[]>;
  updateEmbeddedDocuments(
    name: string,
    updates: readonly Record<string, unknown>[],
    operation?: Record<string, unknown>,
  ): Promise<unknown[]>;
  deleteEmbeddedDocuments(
    name: string,
    ids: readonly string[],
    operation?: Record<string, unknown>,
  ): Promise<unknown[]>;
  getEmbeddedDocument(name: string, id: string): unknown;
}

/** An Active Effect, as a drop hands one over. */
export interface ActiveEffectLike<System = Record<string, unknown>>
  extends DocumentMembers<System> {
  readonly disabled: boolean;
  readonly transfer: boolean;
}

/** An Item, as a drop hands one over. */
export interface ItemLike<System = Record<string, unknown>>
  extends DocumentMembers<System>,
    EmbeddedDocumentOwner {
  /** The Actor this Item belongs to, or `null` for a world Item. */
  readonly actor: ActorLike | null;
  readonly effects: EmbeddedCollection<ActiveEffectLike>;
  /** Roll data for `@`-references in a formula. */
  getRollData(): Record<string, unknown>;
}

/** An Actor, as a sheet holds one and a drop hands one over. */
export interface ActorLike<System = Record<string, unknown>>
  extends DocumentMembers<System>,
    EmbeddedDocumentOwner {
  readonly items: EmbeddedCollection<ItemLike>;
  readonly effects: EmbeddedCollection<ActiveEffectLike>;
  /** Roll data for `@`-references in a formula. */
  getRollData(): Record<string, unknown>;
  /**
   * Every effect that may apply, including the transferred ones on owned
   * Items. Nothing is copied onto the Actor in v14; they apply in place.
   */
  allApplicableEffects(): Iterable<ActiveEffectLike>;
}

/** A Folder, as a drop hands one over. */
export interface FolderLike {
  readonly id: string | null;
  readonly uuid: string;
  readonly name: string;
  /** The document kind this folder holds: `'Actor'`, `'Item'`, and so on. */
  readonly type: string;
  readonly contents: readonly DocumentMembers[];
}

/**
 * What a `TypeDataModel` instance carries beyond its own schema fields.
 *
 * `parent` is the one that matters: inside `prepareDerivedData()` it is the
 * Actor or Item this data belongs to, and reaching it was a cast until now.
 */
export interface TypeDataModelMembers<Parent = DocumentMembers> {
  /**
   * The document this data belongs to: the Actor or Item whose `system` this
   * is. Inside `prepareDerivedData()` this is how you read the rest of the
   * document, `this.parent.name` or `this.parent.items`.
   *
   * Foundry types it nullable because a `DataModel` can stand on its own. A
   * type data model cannot: Foundry builds it with the document as parent.
   */
  readonly parent: Parent;
  /** A plain-object copy of the data. */
  toObject(source?: boolean): Record<string, unknown>;
  /** Change the source data in memory, without a database write. */
  updateSource(
    changes?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Record<string, unknown>;
}
