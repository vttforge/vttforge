import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { Color } from '../data/color.js';
import {
  type ArrayFieldInstance,
  type BooleanFieldInstance,
  type ColorFieldInstance,
  type FilePathFieldInstance,
  type ForeignDocumentFieldInstance,
  fields,
  type HTMLFieldInstance,
  type NumberFieldInstance,
  type SchemaFieldInstance,
  type SetFieldInstance,
  type StringFieldInstance,
} from '../data/fields.js';
import type { InferField, InferSchema } from '../data/infer-schema.js';
import { VttfError } from '../errors/registry.js';

class FakeNumberField {}
class FakeStringField {}
class FakeBooleanField {}
class FakeHTMLField {}
class FakeColorField {}
class FakeFilePathField {}
class FakeArrayField {}
class FakeSetField {}
class FakeForeignDocumentField {}
class FakeSchemaField {}

/** Stands in for a document class in the reference-field cases. */
declare class FakeActor {
  readonly name: string;
}

/**
 * A document class shaped more like a real one: a constructor that takes
 * arguments, and an overload. The `DocumentClass` bound has to accept these
 * or it only works against the synthetic case above.
 */
declare class FakeItem {
  constructor(data: { name: string }, context?: { parent?: FakeActor });
  readonly name: string;
  readonly parent: FakeActor | null;
}

beforeEach(() => {
  (globalThis as Record<string, unknown>).foundry = {
    data: {
      fields: {
        NumberField: FakeNumberField,
        StringField: FakeStringField,
        BooleanField: FakeBooleanField,
        HTMLField: FakeHTMLField,
        ColorField: FakeColorField,
        FilePathField: FakeFilePathField,
        ArrayField: FakeArrayField,
        SetField: FakeSetField,
        ForeignDocumentField: FakeForeignDocumentField,
        SchemaField: FakeSchemaField,
      },
    },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).foundry;
});

describe('fields()', () => {
  it('throws VTTF-0002 when foundry.data.fields is missing', () => {
    delete (globalThis as Record<string, unknown>).foundry;
    expect(() => fields()).toThrow(VttfError);
  });

  it('throws VTTF-0002 when foundry exists but data.fields does not', () => {
    (globalThis as Record<string, unknown>).foundry = { data: {} };
    expect(() => fields()).toThrow(VttfError);
  });

  it('returns the foundry data.fields bag when present', () => {
    const f = fields();
    expect(f.NumberField).toBe(FakeNumberField);
    expect(f.StringField).toBe(FakeStringField);
    expect(f.BooleanField).toBe(FakeBooleanField);
    expect(f.HTMLField).toBe(FakeHTMLField);
    expect(f.ColorField).toBe(FakeColorField);
    expect(f.FilePathField).toBe(FakeFilePathField);
    expect(f.ArrayField).toBe(FakeArrayField);
    expect(f.SetField).toBe(FakeSetField);
    expect(f.ForeignDocumentField).toBe(FakeForeignDocumentField);
    expect(f.SchemaField).toBe(FakeSchemaField);
  });
});

describe('InferField<F> — scalar fields, with nothing declared', () => {
  // Each field class picks its own defaults, and they disagree. These cases
  // pin what an author gets from `new fields.X()` with no options — the
  // shape that used to be typed as the bare scalar across the board.

  it('NumberField is optional and nullable, so it is neither', () => {
    expectTypeOf<InferField<NumberFieldInstance>>().toEqualTypeOf<number | null | undefined>();
  });

  it('NumberField becomes a plain number once the schema says so', () => {
    expectTypeOf<
      InferField<NumberFieldInstance<{ required: true; nullable: false; initial: 0 }>>
    >().toEqualTypeOf<number>();
  });

  it('StringField is optional, but not nullable', () => {
    expectTypeOf<InferField<StringFieldInstance>>().toEqualTypeOf<string | undefined>();
  });

  it('BooleanField is required and starts at false', () => {
    expectTypeOf<InferField<BooleanFieldInstance>>().toEqualTypeOf<boolean>();
  });

  it('HTMLField is required and blank-friendly, so it is always a string', () => {
    expectTypeOf<InferField<HTMLFieldInstance>>().toEqualTypeOf<string>();
  });

  it('ColorField → Color | null, because it is neither a string nor non-null by default', () => {
    // The field stores a CSS string but initializes into a Color instance,
    // and its own defaults are `nullable: true, initial: null` — so reading
    // `.css` off a fresh document is a real crash the old `string` typing
    // let through.
    expectTypeOf<InferField<ColorFieldInstance>>().toEqualTypeOf<Color | null>();
  });

  it('ColorField drops the null once nullable is turned off', () => {
    expectTypeOf<
      InferField<ColorFieldInstance<{ required: true; nullable: false }>>
    >().toEqualTypeOf<Color>();
  });

  it('FilePathField starts at null, like ColorField', () => {
    expectTypeOf<InferField<FilePathFieldInstance>>().toEqualTypeOf<string | null>();
  });

  it('FilePathField drops the null once nullable is turned off', () => {
    expectTypeOf<InferField<FilePathFieldInstance<{ nullable: false }>>>().toEqualTypeOf<string>();
  });
});

describe('InferField<F> — composite fields', () => {
  it('ArrayField is required and builds its own empty array', () => {
    // The container is never absent. Its elements still carry whatever the
    // element field's own defaults allow.
    type T = InferField<ArrayFieldInstance<NumberFieldInstance>>;
    expectTypeOf<T>().toEqualTypeOf<(number | null | undefined)[]>();
  });

  it('ArrayField of a declared StringField → string[]', () => {
    type T = InferField<ArrayFieldInstance<StringFieldInstance<{ required: true }>>>;
    expectTypeOf<T>().toEqualTypeOf<string[]>();
  });

  it('SchemaField → recursive object', () => {
    type T = InferField<
      SchemaFieldInstance<{
        value: NumberFieldInstance<{ required: true; nullable: false; initial: 0 }>;
        max: NumberFieldInstance<{ required: true; nullable: false; initial: 0 }>;
      }>
    >;
    expectTypeOf<T>().toEqualTypeOf<{ value: number; max: number }>();
  });

  it('SchemaField nested inside ArrayField → object[]', () => {
    type T = InferField<
      ArrayFieldInstance<SchemaFieldInstance<{ name: StringFieldInstance<{ required: true }> }>>
    >;
    expectTypeOf<T>().toEqualTypeOf<{ name: string }[]>();
  });
});

describe('InferField<F> — what the schema declares beats the default', () => {
  it('nullable: true admits null', () => {
    type T = InferField<NumberFieldInstance<{ required: true; nullable: true }>>;
    expectTypeOf<T>().toEqualTypeOf<number | null>();
  });

  it('nullable: false takes it away, even from a field that defaults to nullable', () => {
    type T = InferField<NumberFieldInstance<{ required: true; nullable: false }>>;
    expectTypeOf<T>().toEqualTypeOf<number>();
  });

  it('required: false takes it away from a field that defaults to required', () => {
    type T = InferField<BooleanFieldInstance<{ required: false }>>;
    // The initial is the field's own, not the schema's, so it still applies.
    expectTypeOf<T>().toEqualTypeOf<boolean>();
  });
});

describe('InferSchema<S>', () => {
  it('flat schema of three scalar fields', () => {
    type T = InferSchema<{
      level: NumberFieldInstance<{ required: true; nullable: false; initial: 1 }>;
      name: StringFieldInstance<{ required: true }>;
      active: BooleanFieldInstance;
    }>;
    expectTypeOf<T>().toEqualTypeOf<{ level: number; name: string; active: boolean }>();
  });

  it('character-shaped schema with nested SchemaField and ArrayField', () => {
    type Score = NumberFieldInstance<{ required: true; nullable: false; initial: 0 }>;
    type T = InferSchema<{
      level: NumberFieldInstance<{ required: true; nullable: false; initial: 1 }>;
      health: SchemaFieldInstance<{ value: Score; max: Score }>;
      biography: HTMLFieldInstance;
      nicknames: ArrayFieldInstance<StringFieldInstance<{ required: true }>>;
      portrait: FilePathFieldInstance;
    }>;
    expectTypeOf<T>().toEqualTypeOf<{
      level: number;
      health: { value: number; max: number };
      biography: string;
      nicknames: string[];
      portrait: string | null;
    }>();
  });

  it('propagates nullability through the schema', () => {
    type T = InferSchema<{
      hp: NumberFieldInstance<{ required: true; nullable: true }>;
      name: StringFieldInstance<{ required: true }>;
    }>;
    expectTypeOf<T>().toEqualTypeOf<{ hp: number | null; name: string }>();
  });
});

/**
 * How a field's options widen its type.
 *
 * Taken from how a field resolves a missing value: an explicit `initial`
 * always wins; otherwise a non-required field resolves to `undefined`, and a
 * required nullable one to `null`. Validation then admits `null` only when
 * nullable and `undefined` only when not required. So the two widenings are
 * independent and compose.
 */
describe('presence and nullability', () => {
  it('required and non-nullable is just the type', () => {
    expectTypeOf<
      InferField<NumberFieldInstance<{ required: true; nullable: false }>>
    >().toEqualTypeOf<number>();
  });

  it('nullable admits null', () => {
    expectTypeOf<
      InferField<NumberFieldInstance<{ required: true; nullable: true }>>
    >().toEqualTypeOf<number | null>();
  });

  it('not required, with no initial, admits undefined', () => {
    expectTypeOf<
      InferField<NumberFieldInstance<{ required: false; nullable: false }>>
    >().toEqualTypeOf<number | undefined>();
  });

  it('an explicit initial keeps undefined out, even when not required', () => {
    // The field always resolves to the initial, so the value is never absent.
    expectTypeOf<
      InferField<NumberFieldInstance<{ required: false; nullable: false; initial: 0 }>>
    >().toEqualTypeOf<number>();
  });

  it('neither required nor non-nullable admits both', () => {
    expectTypeOf<
      InferField<NumberFieldInstance<{ required: false; nullable: true }>>
    >().toEqualTypeOf<number | null | undefined>();
  });

  it('applies the same rule through a SchemaField', () => {
    type Nested = InferField<
      SchemaFieldInstance<
        { hp: NumberFieldInstance<{ required: false; nullable: false }> },
        { nullable: true }
      >
    >;
    expectTypeOf<Nested>().toEqualTypeOf<{ hp: number | undefined } | null>();
  });

  it('applies it to an array’s element type as well as the array', () => {
    type Tags = InferField<
      ArrayFieldInstance<StringFieldInstance<{ required: false }>, { required: true }>
    >;
    expectTypeOf<Tags>().toEqualTypeOf<(string | undefined)[]>();
  });
});

describe('InferField<F> — SetField', () => {
  it('is a Set, not an array', () => {
    type T = InferField<SetFieldInstance<StringFieldInstance<{ required: true }>>>;
    expectTypeOf<T>().toEqualTypeOf<Set<string>>();
    // The distinction is the whole point: a Set has no push and no index
    // access, so typing one as an array hands the author two methods that
    // throw at runtime.
    expectTypeOf<T>().not.toEqualTypeOf<string[]>();
  });

  it('carries the element type through', () => {
    expectTypeOf<
      InferField<SetFieldInstance<NumberFieldInstance<{ required: true; nullable: false }>>>
    >().toEqualTypeOf<Set<number>>();
  });

  it('applies presence to the element and to the set', () => {
    type T = InferField<
      SetFieldInstance<StringFieldInstance<{ required: false }>, { nullable: true }>
    >;
    expectTypeOf<T>().toEqualTypeOf<Set<string | undefined> | null>();
  });

  it('holds a set of objects when the element is a SchemaField', () => {
    type T = InferField<
      SetFieldInstance<SchemaFieldInstance<{ id: StringFieldInstance<{ required: true }> }>>
    >;
    expectTypeOf<T>().toEqualTypeOf<Set<{ id: string }>>();
  });
});

describe('InferField<F> — ForeignDocumentField', () => {
  it('resolves to the document, because the data model installs a getter', () => {
    type T = InferField<ForeignDocumentFieldInstance<typeof FakeActor>>;
    expectTypeOf<T>().toEqualTypeOf<FakeActor | null>();
  });

  it('is the id string under idOnly', () => {
    type T = InferField<ForeignDocumentFieldInstance<typeof FakeActor, { idOnly: true }>>;
    expectTypeOf<T>().toEqualTypeOf<string | null>();
  });

  it('drops null when the schema declares the field non-nullable', () => {
    type T = InferField<ForeignDocumentFieldInstance<typeof FakeActor, { nullable: false }>>;
    expectTypeOf<T>().toEqualTypeOf<FakeActor>();
  });

  it('is never the getter function itself', () => {
    type T = InferField<ForeignDocumentFieldInstance<typeof FakeActor>>;
    expectTypeOf<T>().not.toEqualTypeOf<(() => FakeActor | null) | null>();
  });

  it('reads as a document inside a schema', () => {
    type T = InferSchema<{
      owner: ForeignDocumentFieldInstance<typeof FakeActor>;
      ownerId: ForeignDocumentFieldInstance<typeof FakeActor, { idOnly: true }>;
    }>;
    expectTypeOf<T>().toEqualTypeOf<{ owner: FakeActor | null; ownerId: string | null }>();
  });
});

describe('DocumentClass — the bound accepts real document shapes', () => {
  it('takes a class whose constructor has parameters', () => {
    type T = InferField<ForeignDocumentFieldInstance<typeof FakeItem>>;
    expectTypeOf<T>().toEqualTypeOf<FakeItem | null>();
  });

  it('resolves to the instance type, not the class', () => {
    type T = InferField<ForeignDocumentFieldInstance<typeof FakeItem, { nullable: false }>>;
    expectTypeOf<T>().toHaveProperty('parent');
    expectTypeOf<T>().not.toEqualTypeOf<typeof FakeItem>();
  });
});
