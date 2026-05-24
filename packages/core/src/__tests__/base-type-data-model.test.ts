import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseTypeDataModel } from '../base-type-data-model.js';
import { VttfError } from '../errors/registry.js';

class FakeFoundryTypeDataModel {
  static migrateData = vi.fn((data: Record<string, unknown>) => ({ ...data, _migrated: true }));
  static _addDataFieldMigrations = vi.fn();
  prepareBaseData(): void {}
}

beforeEach(() => {
  FakeFoundryTypeDataModel.migrateData.mockClear();
  FakeFoundryTypeDataModel._addDataFieldMigrations.mockClear();
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

  it('default migrateData() delegates to super (foundry-vtt-system-dev pitfall #8)', () => {
    const Sub = BaseTypeDataModel();
    const out = (
      Sub as unknown as { migrateData(d: Record<string, unknown>): Record<string, unknown> }
    ).migrateData({
      foo: 1,
    });
    expect(FakeFoundryTypeDataModel.migrateData).toHaveBeenCalledWith({ foo: 1 });
    expect(out).toEqual({ foo: 1, _migrated: true });
  });

  it('default _addDataFieldMigrations() delegates to super when it exists', () => {
    const Sub = BaseTypeDataModel();
    (Sub as unknown as { _addDataFieldMigrations(): void })._addDataFieldMigrations();
    expect(FakeFoundryTypeDataModel._addDataFieldMigrations).toHaveBeenCalledTimes(1);
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
