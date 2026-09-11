import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { InferSchema } from '../data/infer-schema.js';
import { resourceField, schemaHasResource } from '../data/resource-field.js';
import { VttfError } from '../errors/registry.js';

class FakeNumberField {
  constructor(readonly options: Record<string, unknown>) {}
}

class FakeSchemaField {
  constructor(
    readonly fields: Record<string, unknown>,
    readonly options: Record<string, unknown> = {},
  ) {}
}

beforeEach(() => {
  (globalThis as Record<string, unknown>).foundry = {
    data: { fields: { NumberField: FakeNumberField, SchemaField: FakeSchemaField } },
  };
});

afterEach(() => {
  (globalThis as Record<string, unknown>).foundry = undefined;
});

describe('resourceField', () => {
  it('builds a SchemaField with required, non-nullable integer value and max', () => {
    const field = resourceField({ initial: 10 }) as unknown as FakeSchemaField;
    expect(field).toBeInstanceOf(FakeSchemaField);
    const value = field.fields.value as FakeNumberField;
    const max = field.fields.max as FakeNumberField;
    expect(value.options).toEqual({
      required: true,
      nullable: false,
      integer: true,
      min: 0,
      initial: 10,
    });
    expect(max.options).toEqual({
      required: true,
      nullable: false,
      integer: true,
      min: 0,
      initial: 10,
    });
    expect(field.options).toEqual({});
  });

  it('takes a separate max, a min, decimals, a label and a hint', () => {
    const field = resourceField({
      initial: 3,
      max: 8,
      min: 1,
      integer: false,
      label: 'X.Power',
      hint: 'X.PowerHint',
    }) as unknown as FakeSchemaField;
    expect((field.fields.value as FakeNumberField).options).toMatchObject({
      initial: 3,
      min: 1,
      integer: false,
    });
    expect((field.fields.max as FakeNumberField).options).toMatchObject({
      initial: 8,
      min: 1,
      integer: false,
    });
    expect(field.options).toEqual({ label: 'X.Power', hint: 'X.PowerHint' });
  });

  it('defaults everything to zero', () => {
    const field = resourceField() as unknown as FakeSchemaField;
    expect((field.fields.value as FakeNumberField).options).toMatchObject({ initial: 0, min: 0 });
    expect((field.fields.max as FakeNumberField).options).toMatchObject({ initial: 0, min: 0 });
  });

  it('refuses a min above the initial or the max', () => {
    expect(() => resourceField({ initial: 2, min: 5 })).toThrow(VttfError);
    expect(() => resourceField({ initial: 9, max: 2, min: 5 })).toThrow(/VTTF-0010/);
  });

  it('types as { value: number; max: number }', () => {
    const schema = { health: resourceField({ initial: 10 }) };
    type System = InferSchema<typeof schema>;
    const system: System = { health: { value: 4, max: 10 } };
    // @ts-expect-error value is a number, never null
    const wrong: System = { health: { value: null, max: 10 } };
    expect(system.health.value + wrong.health.max).toBe(14);
  });
});

describe('schemaHasResource', () => {
  const schema = {
    fields: {
      health: { fields: { value: {}, max: {} } },
      attributes: { fields: { hp: { fields: { value: {}, max: {} } }, level: {} } },
      name: {},
    },
  };

  it('resolves top-level and dotted paths to a value/max field', () => {
    expect(schemaHasResource(schema, 'health')).toBe(true);
    expect(schemaHasResource(schema, 'attributes.hp')).toBe(true);
  });

  it('rejects a missing path, a leaf, and a schema without both keys', () => {
    expect(schemaHasResource(schema, 'power')).toBe(false);
    expect(schemaHasResource(schema, 'name')).toBe(false);
    expect(schemaHasResource(schema, 'attributes.level')).toBe(false);
    expect(schemaHasResource(schema, 'attributes')).toBe(false);
    expect(schemaHasResource(undefined, 'health')).toBe(false);
  });
});
