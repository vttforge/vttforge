import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import {
  type ArrayFieldInstance,
  type BooleanFieldInstance,
  type ColorFieldInstance,
  type FilePathFieldInstance,
  fields,
  type HTMLFieldInstance,
  type NumberFieldInstance,
  type SchemaFieldInstance,
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
class FakeSchemaField {}

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
    expect(f.SchemaField).toBe(FakeSchemaField);
  });
});

describe('InferField<F> — scalar fields', () => {
  it('NumberField → number', () => {
    expectTypeOf<InferField<NumberFieldInstance>>().toEqualTypeOf<number>();
  });

  it('StringField → string', () => {
    expectTypeOf<InferField<StringFieldInstance>>().toEqualTypeOf<string>();
  });

  it('BooleanField → boolean', () => {
    expectTypeOf<InferField<BooleanFieldInstance>>().toEqualTypeOf<boolean>();
  });

  it('HTMLField → string', () => {
    expectTypeOf<InferField<HTMLFieldInstance>>().toEqualTypeOf<string>();
  });

  it('ColorField → string', () => {
    expectTypeOf<InferField<ColorFieldInstance>>().toEqualTypeOf<string>();
  });

  it('FilePathField → string', () => {
    expectTypeOf<InferField<FilePathFieldInstance>>().toEqualTypeOf<string>();
  });
});

describe('InferField<F> — composite fields', () => {
  it('ArrayField of NumberField → number[]', () => {
    type T = InferField<ArrayFieldInstance<NumberFieldInstance>>;
    expectTypeOf<T>().toEqualTypeOf<number[]>();
  });

  it('ArrayField of StringField → string[]', () => {
    type T = InferField<ArrayFieldInstance<StringFieldInstance>>;
    expectTypeOf<T>().toEqualTypeOf<string[]>();
  });

  it('SchemaField → recursive object', () => {
    type T = InferField<
      SchemaFieldInstance<{
        value: NumberFieldInstance;
        max: NumberFieldInstance;
      }>
    >;
    expectTypeOf<T>().toEqualTypeOf<{ value: number; max: number }>();
  });

  it('SchemaField nested inside ArrayField → object[]', () => {
    type T = InferField<ArrayFieldInstance<SchemaFieldInstance<{ name: StringFieldInstance }>>>;
    expectTypeOf<T>().toEqualTypeOf<{ name: string }[]>();
  });
});

describe('InferField<F> — nullability (v0.1 single rule)', () => {
  it('nullable: true → T | null', () => {
    type T = InferField<NumberFieldInstance<{ nullable: true }>>;
    expectTypeOf<T>().toEqualTypeOf<number | null>();
  });

  it('nullable: false (default) → T', () => {
    type T = InferField<NumberFieldInstance<{ nullable: false }>>;
    expectTypeOf<T>().toEqualTypeOf<number>();
  });

  it('no nullable option → T', () => {
    type T = InferField<StringFieldInstance>;
    expectTypeOf<T>().toEqualTypeOf<string>();
  });
});

describe('InferSchema<S>', () => {
  it('flat schema of three scalar fields', () => {
    type T = InferSchema<{
      level: NumberFieldInstance;
      name: StringFieldInstance;
      active: BooleanFieldInstance;
    }>;
    expectTypeOf<T>().toEqualTypeOf<{ level: number; name: string; active: boolean }>();
  });

  it('character-shaped schema with nested SchemaField and ArrayField', () => {
    type T = InferSchema<{
      level: NumberFieldInstance;
      health: SchemaFieldInstance<{
        value: NumberFieldInstance;
        max: NumberFieldInstance;
      }>;
      biography: HTMLFieldInstance;
      nicknames: ArrayFieldInstance<StringFieldInstance>;
      portrait: FilePathFieldInstance;
    }>;
    expectTypeOf<T>().toEqualTypeOf<{
      level: number;
      health: { value: number; max: number };
      biography: string;
      nicknames: string[];
      portrait: string;
    }>();
  });

  it('propagates nullability through the schema', () => {
    type T = InferSchema<{
      hp: NumberFieldInstance<{ nullable: true }>;
      name: StringFieldInstance;
    }>;
    expectTypeOf<T>().toEqualTypeOf<{ hp: number | null; name: string }>();
  });
});
