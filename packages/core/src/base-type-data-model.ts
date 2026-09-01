/**
 * BaseTypeDataModel — minimal extension of `foundry.abstract.TypeDataModel`.
 *
 * Provides safe defaults that systems usually copy-paste anyway:
 *
 * - `migrateData()` calls `super.migrateData(data)` — every TypeDataModel
 *   must do this so chained migrations from base classes still run.
 * - `prepareBaseData()` is a no-op stub — override to initialize fields that
 *   Active Effects need to mutate (e.g. base max HP before AE bonus). Foundry
 *   applies Active Effects between `prepareBaseData()` and `prepareDerivedData()`,
 *   so anything you compute here is the input AEs see.
 * - `prepareDerivedData()` is a no-op stub — override for computed values
 *   that depend on AE-mutated state (modifiers, percentages, totals).
 *
 * Subclasses still own `defineSchema()` because there is no useful default —
 * we never invent a schema for you.
 *
 * Resolves the base class from `globalThis.foundry.abstract.TypeDataModel` at
 * runtime. In tests, the test harness installs a stub; in Foundry, the global
 * exists by the time this module runs (we are loaded from system esmodules).
 */

import type { FieldInstance } from './data/fields.js';
import type { InferSchema } from './data/infer-schema.js';
import { VttfError } from './errors/registry.js';
import type { VttforgeClass } from './foundry-base.js';

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
/** The two hooks this base fills in, so a subclass can omit either. */
export interface TypeDataModelHooks {
  prepareBaseData(): void;
  prepareDerivedData(): void;
}

/**
 * What an instance looks like when the schema is known.
 *
 * The schema's fields ARE the instance properties — inside
 * `prepareDerivedData()` you read `this.level`, not `this.system.level`, and
 * `actor.system` is this instance.
 *
 * Derived values are not in the schema, so they are not here either. Declare
 * them on the subclass:
 *
 * ```ts
 * declare armorClass: number;
 * ```
 */
export type TypedTypeDataModel<S extends Record<string, FieldInstance>> = InferSchema<S> &
  TypeDataModelHooks & {
    /**
     * Phantom property carrying the schema's inferred shape. Never assigned,
     * never present at runtime — it exists so the type has a name:
     *
     * ```ts
     * type CharacterSystem = CharacterData['$inferData'];
     * ```
     */
    readonly $inferData: InferSchema<S>;
  };

export interface TypedTypeDataModelCtor<S extends Record<string, FieldInstance>> {
  // biome-ignore lint/suspicious/noExplicitAny: a subclass with its own constructor passes Foundry's (data, context) through to super
  new (...args: any[]): TypedTypeDataModel<S>;
  defineSchema(): S;
  migrateData(data: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Build a base class with no knowledge of the schema.
 *
 * The hooks are typed; the schema's own fields are not, since nothing said
 * what they are. Pass your schema function instead to get those too.
 */
export function BaseTypeDataModel(): VttforgeClass<TypeDataModelHooks>;
/**
 * Build a base class that knows its schema.
 *
 * Hand it the function that returns your fields and it implements
 * `static defineSchema()` for you, so the schema is written once:
 *
 * ```ts
 * const defineCharacterSchema = () => {
 *   const f = fields();
 *   return { level: new f.NumberField({ required: true, nullable: false, initial: 1 }) };
 * };
 *
 * class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {
 *   declare armorClass: number;
 *   prepareDerivedData() {
 *     this.armorClass = 10 + this.level; // this.level is number
 *   }
 * }
 * ```
 *
 * It has to be a function, not an object: `fields()` reads a Foundry global
 * that does not exist when the module is first evaluated.
 *
 * A subclass may still declare its own `static defineSchema()`; that one wins,
 * the same as any other static.
 */
export function BaseTypeDataModel<S extends Record<string, FieldInstance>>(
  defineSchema: () => S,
): TypedTypeDataModelCtor<S>;
export function BaseTypeDataModel(
  defineSchema?: () => Record<string, FieldInstance>,
): AnyConstructor {
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
     * No-op stub. Override per type to initialize fields whose values Active
     * Effects need to consume — base max HP, base AC, etc. Foundry calls this
     * BEFORE applying Active Effects, so anything you set here is the input
     * that AE changes (`ADD`, `MULTIPLY`, `OVERRIDE`, …) operate on.
     *
     * Use `prepareDerivedData()` instead for values that depend on the
     * AE-mutated state (modifiers, percentages, totals).
     *
     * Never write to the database here — purely in-memory.
     */
    prepareBaseData(): void {
      // override me
    }

    /**
     * No-op stub. Override per type to compute derived values from the
     * AE-mutated state (modifiers, percentages, totals). Runs AFTER Active
     * Effects apply; use `prepareBaseData()` for values that AEs need to read.
     *
     * Never write to the database here — purely in-memory.
     */
    prepareDerivedData(): void {
      // override me
    }
  }

  if (defineSchema !== undefined) {
    // Assigned rather than declared in the class body so the no-argument form
    // keeps inheriting Foundry's own defineSchema instead of shadowing it
    // with one that returns nothing.
    Object.defineProperty(VttforgeBaseTypeDataModel, 'defineSchema', {
      value: defineSchema,
      writable: true,
      configurable: true,
    });
  }

  return VttforgeBaseTypeDataModel as unknown as AnyConstructor;
}
