/**
 * `InferSchema<T>` — derive the runtime shape of `actor.system` (or
 * `item.system`) from a `defineSchema()` return value.
 *
 * v0.1 scope (PRD §7): the eight field brands in `./fields.ts`. Recurses
 * through `ArrayField` and `SchemaField`. Out of scope until v1.0 (moves to
 * `@vttforge/types`): `EmbeddedDataField`, `EmbeddedDocumentField`,
 * `TypedSchemaField`, and the full required×initial nullability matrix.
 *
 * The single nullability rule honoured here is `nullable: true` → `T | null`.
 * Combinations like `required: false, initial: undefined` → `T | undefined`
 * are intentionally out of scope; documenting them would lock semantics that
 * still need real-world validation against shipped systems.
 */

import type {
  ArrayFieldInstance,
  BooleanFieldInstance,
  ColorFieldInstance,
  FieldInstance,
  FilePathFieldInstance,
  HTMLFieldInstance,
  NumberFieldInstance,
  SchemaFieldInstance,
  StringFieldInstance,
} from './fields.js';

/**
 * Flatten an intersection / mapped type into a plain object literal so IDE
 * hovers stay readable (Matt Pocock's `Prettify`). Use on every public
 * conditional-type surface — PRD §7 TS-hygiene rule.
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

type ApplyNullability<O, T> = O extends { nullable: true } ? T | null : T;

/**
 * Map a single field instance to its runtime TypeScript type. `never` for
 * shapes we don't recognise — the v1.0 `@vttforge/types` package will widen
 * this matrix to the remaining Foundry fields.
 */
export type InferField<F> =
  F extends NumberFieldInstance<infer O>
    ? ApplyNullability<O, number>
    : F extends StringFieldInstance<infer O>
      ? ApplyNullability<O, string>
      : F extends BooleanFieldInstance<infer O>
        ? ApplyNullability<O, boolean>
        : F extends HTMLFieldInstance<infer O>
          ? ApplyNullability<O, string>
          : F extends ColorFieldInstance<infer O>
            ? ApplyNullability<O, string>
            : F extends FilePathFieldInstance<infer O>
              ? ApplyNullability<O, string>
              : F extends ArrayFieldInstance<infer Inner, infer O>
                ? ApplyNullability<O, InferField<Inner>[]>
                : F extends SchemaFieldInstance<infer S, infer O>
                  ? ApplyNullability<O, InferSchema<S>>
                  : never;

/**
 * Map a `defineSchema()` return value to the corresponding `system` shape.
 *
 * @example
 * ```ts
 * class CharacterData extends BaseTypeDataModel() {
 *   static defineSchema() {
 *     const f = fields();
 *     return {
 *       level: new f.NumberField({ required: true, initial: 1 }),
 *       biography: new f.HTMLField(),
 *     };
 *   }
 * }
 * type CharacterSystem = InferSchema<ReturnType<typeof CharacterData.defineSchema>>;
 * // → { level: number; biography: string }
 * ```
 */
export type InferSchema<S extends Record<string, FieldInstance>> = Prettify<{
  [K in keyof S]: InferField<S[K]>;
}>;
