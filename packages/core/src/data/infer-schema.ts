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

import type { Color } from './color.js';
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

/**
 * Whether a field's options gave an explicit `initial`.
 *
 * A field with an initial is always populated, so it never widens to
 * `undefined` no matter what `required` says. Presence of the key is the
 * question, not its value — `{ initial: undefined }` is not an initial.
 */
type HasInitial<O> = O extends { initial: unknown } ? true : false;

/**
 * Widen a field's base type by what its options allow it to be.
 *
 * Two independent widenings, derived from how a field resolves a value:
 *
 * - `nullable: true` admits `null`, and a required nullable field with no
 *   initial resolves to `null`.
 * - `required: false` with no explicit initial resolves to `undefined`.
 *
 * They compose: a field that is neither required nor nullable, with no
 * initial, is `T | undefined`; add `nullable` and it is `T | null | undefined`.
 */
type ApplyPresence<O, T> =
  | T
  | (O extends { nullable: true } ? null : never)
  | (O extends { required: false } ? (HasInitial<O> extends true ? never : undefined) : never);

/**
 * What a `ColorField` holds once the model is initialized.
 *
 * Not a string. The field casts its stored value to a CSS string, but
 * `initialize` hands back a `Color` instance — so `system.tint` is an object
 * with `.css`, `.rgb`, `.hex` and friends, and typing it as `string` makes
 * every property access on it a lie the compiler accepts.
 *
 * It is also nullable by default, unlike every other string-backed field:
 * the field's own defaults set `nullable: true, initial: null`. Writing
 * `new fields.ColorField()` and reading `.css` off it crashes on a fresh
 * document, which is exactly what this type now refuses.
 */
type ColorFieldValue<O> = O extends { nullable: false }
  ? ApplyPresence<O, Color>
  : ApplyPresence<O, Color> | null;

/**
 * Map a single field instance to its runtime TypeScript type. `never` for
 * shapes we don't recognise — the v1.0 `@vttforge/types` package will widen
 * this matrix to the remaining Foundry fields.
 */
export type InferField<F> =
  F extends NumberFieldInstance<infer O>
    ? ApplyPresence<O, number>
    : F extends StringFieldInstance<infer O>
      ? ApplyPresence<O, string>
      : F extends BooleanFieldInstance<infer O>
        ? ApplyPresence<O, boolean>
        : F extends HTMLFieldInstance<infer O>
          ? ApplyPresence<O, string>
          : F extends ColorFieldInstance<infer O>
            ? ColorFieldValue<O>
            : F extends FilePathFieldInstance<infer O>
              ? ApplyPresence<O, string>
              : F extends ArrayFieldInstance<infer Inner, infer O>
                ? ApplyPresence<O, InferField<Inner>[]>
                : F extends SchemaFieldInstance<infer S, infer O>
                  ? ApplyPresence<O, InferSchema<S>>
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
