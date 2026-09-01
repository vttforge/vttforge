/**
 * A Foundry runtime, faked well enough to import a package and construct
 * its classes.
 *
 * Every `@vttforge/core` test built this by hand before this existed, and no
 * two built it quite the same way. That is the problem: the globals a package
 * needs are not obvious, they are not documented anywhere, and you discover
 * them one `ReferenceError` at a time.
 *
 * What this covers is the boundary the SDK actually sits on — everything up
 * to the moment a window renders. `_renderHTML` and beyond needs a real
 * browser and a real Foundry; that is what the Quench half is for.
 */

/** A Foundry document, as much of one as a unit test needs. */
export interface MockDocument {
  id: string;
  name: string;
  type: string;
  // biome-ignore lint/suspicious/noExplicitAny: a document's system data is whatever its schema says
  system: Record<string, any>;
  flags: Record<string, Record<string, unknown>>;
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<MockDocument>;
  unsetFlag(scope: string, key: string): Promise<MockDocument>;
  update(delta: Record<string, unknown>): Promise<MockDocument>;
  /** Every update this document received, in order. */
  readonly updates: ReadonlyArray<Record<string, unknown>>;
}

interface MockDocumentOptions {
  id?: string;
  name?: string;
  type?: string;
  // biome-ignore lint/suspicious/noExplicitAny: mirrors MockDocument.system
  system?: Record<string, any>;
  flags?: Record<string, Record<string, unknown>>;
}

let nextId = 0;

/** `{'system.hp.value': 3}` → `{system: {hp: {value: 3}}}`. */
function expand(flat: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path.split('.');
    const last = parts.pop();
    if (!last) continue;
    let target = out;
    for (const part of parts) {
      target[part] ??= {};
      target = target[part] as Record<string, unknown>;
    }
    target[last] = value;
  }
  return out;
}

/** Deep-merge, the way a document update behaves. Arrays replace wholesale. */
function merge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const isPlain =
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype;
    if (isPlain) {
      if (typeof target[key] !== 'object' || target[key] === null) target[key] = {};
      merge(target[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
}

function createMockDocument(kind: string, options: MockDocumentOptions = {}): MockDocument {
  nextId += 1;
  const updates: Record<string, unknown>[] = [];

  const doc: MockDocument = {
    id: options.id ?? `${kind}${String(nextId).padStart(12, '0')}`,
    name: options.name ?? `Test ${kind}`,
    type: options.type ?? 'base',
    system: options.system ?? {},
    flags: options.flags ?? {},
    updates,

    getFlag: (scope, key) => doc.flags[scope]?.[key],

    setFlag: async (scope, key, value) => {
      doc.flags[scope] ??= {};
      doc.flags[scope][key] = value;
      return doc;
    },

    unsetFlag: async (scope, key) => {
      delete doc.flags[scope]?.[key];
      return doc;
    },

    /**
     * Records the delta and merges it in.
     *
     * Merges, not replaces — which is what Foundry does and what a mock has
     * to match. Assigning `{system: {hp: {value: 4}}}` wholesale drops
     * `hp.max`, and a test written against that passes while the real thing
     * loses data.
     *
     * Dotted keys are expanded first, because that is how updates arrive.
     */
    update: async (delta) => {
      updates.push(delta);
      merge(doc as unknown as Record<string, unknown>, expand(delta));
      return doc;
    },
  };

  return doc;
}

/** An Actor for a test. Its `updates` record what the code under test wrote. */
export function createMockActor(options: MockDocumentOptions = {}): MockDocument {
  return createMockDocument('Actor', { type: 'character', ...options });
}

/** An Item for a test. */
export function createMockItem(options: MockDocumentOptions = {}): MockDocument {
  return createMockDocument('Item', { type: 'base', ...options });
}
