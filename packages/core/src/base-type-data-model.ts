/**
 * BaseTypeDataModel — minimal extension of `foundry.abstract.TypeDataModel`.
 *
 * Provides safe defaults that systems usually copy-paste anyway:
 *
 * - `migrateData()` calls `super.migrateData(data)` (Foundry system guidance
 *   pitfall #8 — every TypeDataModel must do this).
 * - `_addDataFieldMigrations()` is a no-op stub so subclasses can override
 *   without needing to know that the base form exists.
 * - `prepareDerivedData()` is a no-op stub — override per type.
 *
 * Subclasses still own `defineSchema()` because there is no useful default —
 * we never invent a schema for you.
 *
 * Resolves the base class from `globalThis.foundry.abstract.TypeDataModel` at
 * runtime. In tests, the test harness installs a stub; in Foundry, the global
 * exists by the time this module runs (we are loaded from system esmodules).
 */

import { VttfError } from './errors/registry.js';

// biome-ignore lint/suspicious/noExplicitAny: we mix into Foundry's TypeDataModel whose shape lives in fvtt-types (deferred to @vttforge/types v1.0)
type AnyConstructor = new (...args: any[]) => any;

function resolveTypeDataModelClass(): AnyConstructor {
  const foundry = (globalThis as Record<string, unknown>).foundry as
    | { abstract?: { TypeDataModel?: AnyConstructor } }
    | undefined;
  const cls = foundry?.abstract?.TypeDataModel;
  if (typeof cls !== 'function') {
    throw new VttfError(
      'VTTF-0002',
      'foundry.abstract.TypeDataModel is not available. Define your BaseTypeDataModel subclasses inside the Foundry runtime (or stub the global in tests).',
    );
  }
  return cls;
}

/**
 * Resolve the runtime base class, then build a mixin that adds VTTForge defaults.
 *
 * Why a function: subclasses are declared once at module load, but Foundry
 * globals may not exist yet (test boot, ESM hoist). Calling `BaseTypeDataModel()`
 * lazy-resolves the global at the moment of subclassing.
 */
export function BaseTypeDataModel(): AnyConstructor {
  const Base = resolveTypeDataModelClass();

  class VttforgeBaseTypeDataModel extends Base {
    /**
     * Default no-op so subclasses can omit it when they have no value-level
     * migrations. Always end with `super.migrateData(data)` if you override.
     */
    static migrateData(data: Record<string, unknown>): Record<string, unknown> {
      const superMigrateData = (
        Base as { migrateData?: (d: Record<string, unknown>) => Record<string, unknown> }
      ).migrateData;
      if (typeof superMigrateData === 'function') {
        return superMigrateData.call(VttforgeBaseTypeDataModel, data);
      }
      return data;
    }

    /**
     * No-op stub. Override to register field renames via
     * `this._addDataFieldMigration("system.oldField", "system.newField")`.
     */
    static _addDataFieldMigrations(): void {
      const superFn = (Base as { _addDataFieldMigrations?: () => void })._addDataFieldMigrations;
      if (typeof superFn === 'function') {
        superFn.call(VttforgeBaseTypeDataModel);
      }
    }

    /**
     * No-op stub. Override per type to compute derived values.
     * Never write to the database here — purely in-memory.
     */
    prepareDerivedData(): void {
      // override me
    }
  }

  return VttforgeBaseTypeDataModel as unknown as AnyConstructor;
}
