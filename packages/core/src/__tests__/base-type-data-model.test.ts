import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { BaseTypeDataModel } from '../base-type-data-model.js';
import type { NumberFieldInstance, SchemaFieldInstance } from '../data/fields.js';
import { VttfError } from '../errors/registry.js';

class FakeFoundryTypeDataModel {
  static migrateData = vi.fn((data: Record<string, unknown>) => ({ ...data, _migrated: true }));
  prepareBaseData(): void {}
}

beforeEach(() => {
  FakeFoundryTypeDataModel.migrateData.mockClear();
  (globalThis as Record<string, unknown>).foundry = {
    abstract: { TypeDataModel: FakeFoundryTypeDataModel },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).foundry;
});

describe('BaseTypeDataModel', () => {
  it('throws VTTF-0002 when foundry.abstract.TypeDataModel is missing', () => {
    delete (globalThis as Record<string, unknown>).foundry;
    expect(() => BaseTypeDataModel()).toThrow(VttfError);
  });

  it('returns a subclass of the Foundry base', () => {
    const Sub = BaseTypeDataModel();
    expect(Object.getPrototypeOf(Sub)).toBe(FakeFoundryTypeDataModel);
  });

  it('default migrateData() delegates to super (chained-migration guard)', () => {
    const Sub = BaseTypeDataModel();
    const out = (
      Sub as unknown as { migrateData(d: Record<string, unknown>): Record<string, unknown> }
    ).migrateData({
      foo: 1,
    });
    expect(FakeFoundryTypeDataModel.migrateData).toHaveBeenCalledWith({ foo: 1 });
    expect(out).toEqual({ foo: 1, _migrated: true });
  });

  it('default prepareBaseData() is a no-op that does not crash', () => {
    const Sub = BaseTypeDataModel();
    const instance = new Sub();
    expect(() => (instance as { prepareBaseData(): void }).prepareBaseData()).not.toThrow();
  });

  it('default prepareDerivedData() is a no-op that does not crash', () => {
    const Sub = BaseTypeDataModel();
    const instance = new Sub();
    expect(() => (instance as { prepareDerivedData(): void }).prepareDerivedData()).not.toThrow();
  });

  it('subclasses can override migrateData and still call super', () => {
    const Base = BaseTypeDataModel();
    class CharacterData extends Base {
      static migrateData(data: Record<string, unknown>): Record<string, unknown> {
        const transformed = { ...data, level: (data.level as number | undefined) ?? 1 };
        return (
          Base as unknown as { migrateData(d: Record<string, unknown>): Record<string, unknown> }
        ).migrateData(transformed);
      }
    }
    const result = CharacterData.migrateData({ name: 'hero' });
    expect(result).toEqual({ name: 'hero', level: 1, _migrated: true });
  });
});

describe('BaseTypeDataModel(defineSchema) — runtime', () => {
  const define = () => ({ level: 1 }) as unknown as Record<string, never>;

  it('implements defineSchema for the subclass, so the schema is written once', () => {
    class CharacterData extends BaseTypeDataModel(define) {}
    expect(CharacterData.defineSchema()).toEqual({ level: 1 });
  });

  it('lets a subclass override defineSchema, like any other static', () => {
    class CharacterData extends BaseTypeDataModel(define) {
      static override defineSchema() {
        return { level: 99 } as unknown as Record<string, never>;
      }
    }
    expect(CharacterData.defineSchema()).toEqual({ level: 99 });
  });

  it('leaves defineSchema alone in the no-argument form', () => {
    // Foundry's own TypeDataModel owns it there. Shadowing it with a stub
    // that returns nothing would break every existing subclass.
    const Base = BaseTypeDataModel();
    expect(Object.hasOwn(Base, 'defineSchema')).toBe(false);
  });

  it('still applies the hook defaults', () => {
    class CharacterData extends BaseTypeDataModel(define) {}
    const instance = new CharacterData();
    expect(() => instance.prepareBaseData()).not.toThrow();
    expect(() => instance.prepareDerivedData()).not.toThrow();
  });
});

describe('BaseTypeDataModel(defineSchema) — types', () => {
  type Score = NumberFieldInstance<{ required: true; nullable: false; initial: 0 }>;
  const defineCharacterSchema = (() => ({})) as unknown as () => {
    level: Score;
    health: SchemaFieldInstance<{ value: Score; max: Score }>;
  };

  // Wrapped in a factory so the class body is not evaluated at collection
  // time, before the Foundry stub is installed. The type is the same either
  // way, which is all these cases read.
  const makeCharacterData = () =>
    class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {
      // Derived values are not in the schema, so the author declares them.
      declare armorClass: number;

      override prepareDerivedData(): void {
        this.health.max = 10 + this.level;
        this.armorClass = 10;
      }
    };
  type CharacterData = InstanceType<ReturnType<typeof makeCharacterData>>;

  it('types the schema fields as instance properties', () => {
    expectTypeOf<CharacterData['level']>().toEqualTypeOf<number>();
    expectTypeOf<CharacterData['health']>().toEqualTypeOf<{ value: number; max: number }>();
  });

  it('names the inferred shape through $inferData', () => {
    expectTypeOf<CharacterData['$inferData']>().toEqualTypeOf<{
      level: number;
      health: { value: number; max: number };
    }>();
  });

  it('keeps the hooks on the instance', () => {
    expectTypeOf<CharacterData['prepareDerivedData']>().toEqualTypeOf<() => void>();
  });

  it('gives the no-argument form the hooks and nothing invented', () => {
    // Every scaffolded template calls it this way, and the typed overload
    // must not capture it and hand it a schema of nothing. What it does NOT
    // do any more is accept every member name: this used to compile with
    // `this.anythingAtAll = 1`, which is how a real module shipped a call to
    // a method that did not exist.
    class Legacy extends BaseTypeDataModel() {
      whatever(): void {
        this.prepareDerivedData();
      }
    }
    expect(typeof Legacy).toBe('function');
  });
});
