/**
 * `foundry.utils`: the helper namespace Foundry exposes on the global.
 *
 * Every member Foundry documents for v13+ and v14 is here, with the
 * signature its own API reference gives. The bare globals these replaced
 * (`mergeObject`, `getProperty`, and the rest) are gone in v14, so the
 * namespace is the only way in.
 */

/** A point on the canvas or in a shape. */
export interface Point {
  x: number;
  y: number;
}

/** Where two lines meet, and how far along each the meeting is. */
export interface LineIntersection {
  x: number;
  y: number;
  /** How far along the first segment, 0 at its start and 1 at its end. */
  t0: number;
  /** The same for the second segment. Present when asked for. */
  t1?: number;
}

/** Where a line enters and leaves a circle. */
export interface LineCircleIntersection {
  aInside: boolean;
  bInside: boolean;
  contained: boolean;
  outside: boolean;
  tangent: boolean;
  intersections: Point[];
}

/** A UUID taken apart. */
export interface ResolvedUUID {
  uuid: string;
  type?: string;
  id?: string;
  primaryType?: string;
  primaryId?: string;
  collection?: unknown;
  embedded: string[];
  doc?: unknown;
}

/** What `parseS3URL` reads out of a key. */
export interface ParsedS3URL {
  bucket: string | null;
  keyPrefix: string;
}

// biome-ignore lint/suspicious/noExplicitAny: a constructor of anything, which is what these helpers take
export type AnyClass = new (...args: any[]) => any;

export interface MergeObjectOptions {
  insertKeys?: boolean;
  insertValues?: boolean;
  overwrite?: boolean;
  recursive?: boolean;
  inplace?: boolean;
  enforceTypes?: boolean;
  /** Apply `ForcedDeletion` and `ForcedReplacement` values instead of copying them. */
  applyOperators?: boolean;
}

export interface DiffObjectOptions {
  inner?: boolean;
  deletionKeys?: boolean;
  bidirectional?: boolean;
}

export interface SortOptions<T> {
  target?: T | null;
  siblings?: readonly T[];
  sortKey?: string;
  sortBefore?: boolean;
}

/** One entry of the result of `performIntegerSort`. */
export interface SortUpdate<T> {
  target: T;
  update: Record<string, number>;
}

/**
 * The `foundry.utils` namespace.
 *
 * Grouped the way the API reference groups it: objects, strings and HTML,
 * documents and UUIDs, classes, geometry, timing.
 */
export interface FoundryUtils {
  // Objects
  mergeObject<T extends object>(
    original: T,
    other?: object,
    options?: MergeObjectOptions,
  ): T & Record<string, unknown>;
  diffObject(original: object, other: object, options?: DiffObjectOptions): Record<string, unknown>;
  filterObject(
    source: object,
    template: object,
    options?: { templateValues?: boolean },
  ): Record<string, unknown>;
  expandObject(obj: object): Record<string, unknown>;
  /** Expands dot keys in place. Returns whether anything expanded. */
  expandObjectInPlace(data: object, options?: { shallow?: boolean }): boolean;
  flattenObject(obj: object): Record<string, unknown>;
  invertObject(obj: object): Record<string, unknown>;
  /** Replaces `objectsEqual`, which is deprecated. */
  equals(a: unknown, b: unknown): boolean;
  isEmpty(value: unknown): boolean;
  isPlainObject(value: unknown): boolean;
  getType(variable: unknown): string;

  hasProperty(object: object, key: string): boolean;
  getProperty<T = unknown>(object: object, key: string): T | undefined;
  setProperty(object: object, key: string, value: unknown): boolean;
  deleteProperty(object: object, key: string): boolean;

  deepClone<T>(original: T, options?: { strict?: boolean; prune?: boolean }): T;
  deepFreeze<T>(obj: T, options?: { strict?: boolean }): Readonly<T>;
  deepSeal<T>(obj: T, options?: { strict?: boolean }): T;
  /** `deepClone` is faster where it applies. */
  duplicate<T>(original: T): T;
  /** Resolve `ForcedDeletion` and `ForcedReplacement` values inside an object. */
  applyDataOperators<T>(obj: T): T;

  iterateEntries(obj: object): IterableIterator<[string, unknown]>;
  iterateKeys(obj: object): IterableIterator<string>;
  iterateValues(obj: object): IterableIterator<unknown>;
  objectEntries(obj: object): IterableIterator<[string, unknown]>;
  objectKeys(obj: object): IterableIterator<string>;
  objectValues(obj: object): IterableIterator<unknown>;

  // Strings, HTML and files
  randomID(length?: number): string;
  escapeHTML(value: unknown): string;
  unescapeHTML(value: string): string;
  /** Close unbalanced tags and strip what a sheet should not carry. */
  cleanHTML(raw: string): string;
  parseHTML(htmlString: string): HTMLElement | HTMLCollection | null;
  encodeURL(path: string): string;
  getRoute(path: string, options?: { prefix?: string | null }): string;
  getCacheBustURL(src: string): string | false;
  parseS3URL(key: string): ParsedS3URL;
  formatFileSize(size: number, options?: { decimalPlaces?: number; base?: 2 | 10 }): string;
  saveDataToFile(data: string, type: string, filename: string): void;
  readTextFromFile(file: File): Promise<string>;
  fetchResource(src: string, options?: { bustCache?: boolean }): Promise<Blob>;
  /** Relative to now, in words. */
  timeSince(timeStamp: Date | string): string;

  // Documents and UUIDs
  parseUuid(uuid: string, options?: { relative?: unknown }): ResolvedUUID | null;
  buildUuid(context: {
    id: string;
    documentName?: string;
    parent?: unknown;
    pack?: string | null;
  }): string | null;
  buildRelativeUuid(target: string | unknown, origin: string | unknown): string;
  fromUuid<T = unknown>(
    uuid: string,
    options?: { relative?: unknown; invalid?: boolean },
  ): Promise<T | null>;
  fromUuidSync<T = unknown>(
    uuid: string,
    options?: { relative?: unknown; invalid?: boolean; strict?: boolean },
  ): T | null;
  getDocumentClass(documentName: string): AnyClass | undefined;
  getPlaceableObjectClass(documentName: string): AnyClass | undefined;
  performIntegerSort<T extends object>(source: T, options?: SortOptions<T>): SortUpdate<T>[];

  // Classes and versions
  isSubclass(cls: AnyClass, parent: AnyClass): boolean;
  getParentClasses(cls: AnyClass): AnyClass[];
  getDefiningClass(obj: object | AnyClass, property: string): AnyClass;
  isElementInstanceOf(element: HTMLElement, tagOrClass: string | AnyClass): boolean;
  isNewerVersion(
    v1: number | string | null | undefined,
    v0: number | string | null | undefined,
    options?: { majorOnly?: boolean },
  ): boolean;
  logCompatibilityWarning(
    message: string,
    options?: { since?: number | string; until?: number | string; once?: boolean },
  ): void;

  // Timing
  debounce<A extends readonly unknown[]>(
    callback: (...args: A) => unknown,
    delay: number,
  ): ((...args: A) => void) & { cancel(): void };
  throttle<A extends readonly unknown[]>(
    callback: (...args: A) => unknown,
    delay: number,
  ): (...args: A) => void;
  debouncedReload(): void;
  benchmark(
    func: (...args: readonly unknown[]) => unknown,
    iterations: number,
    ...args: readonly unknown[]
  ): Promise<void>;
  /** Locks the thread. A debugging aid, never something to ship. */
  threadLock(ms: number, debug?: boolean): Promise<void>;

  // Geometry
  orient2dFast(a: Point, b: Point, c: Point): number;
  lineSegmentIntersects(a: Point, b: Point, c: Point, d: Point): boolean;
  lineLineIntersection(
    a: Point,
    b: Point,
    c: Point,
    d: Point,
    options?: { t1?: boolean },
  ): LineIntersection | null;
  lineSegmentIntersection(
    a: Point,
    b: Point,
    c: Point,
    d: Point,
    epsilon?: number,
  ): LineIntersection | null;
  lineCircleIntersection(
    a: Point,
    b: Point,
    center: Point,
    radius: number,
    epsilon?: number,
  ): LineCircleIntersection;
  closestPointToSegment(c: Point, a: Point, b: Point): Point;
  closestPointToPath(c: Point, points: readonly Point[] | readonly number[], close: boolean): Point;
  quadraticIntersection(
    p0: Point,
    p1: Point,
    center: Point,
    radius: number,
    epsilon?: number,
  ): LineIntersection[];
  polygonCentroid(points: readonly Point[] | readonly number[]): Point;
  pathCircleIntersects(
    points: readonly Point[] | readonly number[],
    close: boolean,
    center: Point,
    radius: number,
  ): boolean;
  circleCircleIntersects(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): boolean;

  /**
   * The classes the namespace carries. Typed as constructors rather than
   * described member by member: a consumer that subclasses one of these is
   * past what this package covers.
   */
  readonly Collection: AnyClass;
  readonly Color: AnyClass;
  readonly Semaphore: AnyClass;
  readonly BitMask: AnyClass;
  readonly HttpError: AnyClass;
  readonly IterableWeakMap: AnyClass;
  readonly IterableWeakSet: AnyClass;
  readonly StringTree: AnyClass;
  readonly WordTree: AnyClass;
  readonly StringNode: AnyClass;
  readonly EventEmitterMixin: (base: AnyClass) => AnyClass;
}
