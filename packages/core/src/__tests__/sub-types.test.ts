import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convertSubTypes, subTypeDocuments } from '../sub-types.js';

interface FakeDoc {
  id: string;
  name: string;
  type: string;
  system: Record<string, unknown>;
  update: (changes: Record<string, unknown>) => Promise<unknown>;
}

/** The same document, with the mock's own members visible. */
type MockedDoc = FakeDoc & { update: ReturnType<typeof vi.fn> };

/** What `_replace(value)` produces, so a test can see it was used. */
class ForcedReplacement {
  constructor(readonly value: unknown) {}
}

let items: MockedDoc[];
let actors: MockedDoc[];

/**
 * A document that refuses a type change without the operator, the way Foundry
 * does: the whole update is dropped, not just the type.
 */
function doc(id: string, type: string, system: Record<string, unknown> = {}): MockedDoc {
  const entry: MockedDoc = {
    id,
    name: `Doc ${id}`,
    type,
    system,
    update: vi.fn(async (changes: Record<string, unknown>) => {
      if ('type' in changes && !(changes.system instanceof ForcedReplacement)) {
        throw new Error(
          'The type of a Document may only be changed if the system field is also updated with a ForcedReplacement operator.',
        );
      }
      if (typeof changes.name === 'string') entry.name = changes.name;
      if (typeof changes.type === 'string') entry.type = changes.type;
      if (changes.system instanceof ForcedReplacement) {
        entry.system = changes.system.value as Record<string, unknown>;
      }
      return entry;
    }),
  };
  return entry;
}

beforeEach(() => {
  items = [];
  actors = [];
  (globalThis as Record<string, unknown>).game = {
    items: { filter: (fn: (d: MockedDoc) => boolean) => items.filter(fn) },
    actors: { filter: (fn: (d: MockedDoc) => boolean) => actors.filter(fn) },
  };
  (globalThis as Record<string, unknown>).foundry = { data: { operators: { ForcedReplacement } } };
});

afterEach(() => {
  (globalThis as Record<string, unknown>).game = undefined;
  (globalThis as Record<string, unknown>).foundry = undefined;
});

describe('finding what a module would strand', () => {
  it('matches the prefixed key and nothing else', () => {
    items = [
      doc('a', 'my-module.note'),
      doc('b', 'note'),
      doc('c', 'other-module.note'),
      doc('d', 'my-module.note'),
    ];
    const found = subTypeDocuments({ id: 'my-module', document: 'Item', type: 'note' });
    expect(found.map((entry) => entry.id)).toEqual(['a', 'd']);
  });

  it('reads the right collection, and an empty world is not an error', () => {
    actors = [doc('a', 'my-module.vehicle')];
    expect(subTypeDocuments({ id: 'my-module', document: 'Actor', type: 'vehicle' })).toHaveLength(
      1,
    );
    expect(subTypeDocuments({ id: 'my-module', document: 'Item', type: 'vehicle' })).toEqual([]);
  });

  it('refuses a call with no id or no type', () => {
    expect(() => subTypeDocuments({ id: '', document: 'Item', type: 'note' })).toThrow(
      /VTTF-0015[\s\S]*module id/,
    );
    expect(() => subTypeDocuments({ id: 'my-module', document: 'Item', type: '' })).toThrow(
      /bare type key/,
    );
  });
});

describe('converting', () => {
  it('changes the type in place, replacing the system data rather than merging it', async () => {
    items = [doc('a', 'my-module.note', { body: 'hello', pinned: false })];

    const result = await convertSubTypes({ id: 'my-module', document: 'Item', type: 'note' });

    expect(result).toEqual({ converted: 1, failed: [] });
    expect(items[0]?.type).toBe('base');
    // Kept as it was: a core type stores system as a plain object, so nothing
    // is lost even where nothing reads it.
    expect(items[0]?.system).toEqual({ body: 'hello', pinned: false });

    const changes = items[0]?.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(changes.system).toBeInstanceOf(ForcedReplacement);
  });

  it('takes a target type, new system data, and other changes', async () => {
    items = [doc('a', 'my-module.note', { body: 'hello' })];

    await convertSubTypes<FakeDoc>({
      id: 'my-module',
      document: 'Item',
      type: 'note',
      to: 'gear',
      system: (entry) => ({ description: entry.system.body }),
      changes: (entry) => ({ name: `${entry.name} (was a note)` }),
    });

    expect(items[0]?.type).toBe('gear');
    expect(items[0]?.system).toEqual({ description: 'hello' });
    expect(items[0]?.name).toBe('Doc a (was a note)');
  });

  it('reports the ones that refused and keeps going', async () => {
    const bad = doc('b', 'my-module.note');
    bad.update = vi.fn(async () => {
      throw new Error('You do not have permission');
    });
    items = [doc('a', 'my-module.note'), bad, doc('c', 'my-module.note')];

    const result = await convertSubTypes({ id: 'my-module', document: 'Item', type: 'note' });

    expect(result.converted).toBe(2);
    expect(result.failed).toEqual([
      { id: 'b', name: 'Doc b', reason: 'You do not have permission' },
    ]);
  });

  it('converts nothing, happily, when the world has none', async () => {
    await expect(
      convertSubTypes({ id: 'my-module', document: 'Item', type: 'note' }),
    ).resolves.toEqual({ converted: 0, failed: [] });
  });

  it('refuses to convert a type into itself', async () => {
    await expect(
      convertSubTypes({ id: 'my-module', document: 'Item', type: 'note', to: 'my-module.note' }),
    ).rejects.toThrow(/into itself/);
  });

  it('says so where the operator does not exist, rather than dropping every update', async () => {
    (globalThis as Record<string, unknown>).foundry = {};
    items = [doc('a', 'my-module.note')];
    await expect(
      convertSubTypes({ id: 'my-module', document: 'Item', type: 'note' }),
    ).rejects.toThrow(/VTTF-0015[\s\S]*ForcedReplacement/);
    expect(items[0]?.update).not.toHaveBeenCalled();
  });
});
