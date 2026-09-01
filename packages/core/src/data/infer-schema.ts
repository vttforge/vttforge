/**
 * `InferSchema<T>` — derive the runtime shape of `actor.system` (or
 * `item.system`) from a `defineSchema()` return value.
 *
 * v0.1 scope (PRD §7): the field brands in `./fields.ts`. Recurses through
 * `ArrayField`, `SetField` and `SchemaField`. Out of scope until v1.0 (moves
 * to `@vttforge/types`): `EmbeddedDataField`, `EmbeddedDocumentField` and
 * `TypedSchemaField`.
 *
 * Document-level fields — ownership, the `_stats` block — are deliberately
 * absent. They live on the document, never inside the schema a type data
 * model defines, so they cannot appear in what this maps.
 */
import type { Color } from './color.js';
import type {
  ArrayFieldInstance,
  BooleanFieldInstance,
  ColorFieldInstance,
  DocumentClass,
  FieldInstance,
  FilePathFieldInstance,
  ForeignDocumentFieldInstance,
  HTMLFieldInstance,
  NumberFieldInstance,
  SchemaFieldInstance,
  SetFieldInstance,
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
 * Presence for a field whose own defaults already admit `null`.
 *
 * Most fields are non-nullable until the schema asks otherwise. A few invert
 * that — they hold `null` out of the box, and only an explicit
 * `nullable: false` takes it away.
 */
type PresenceNullableByDefault<O, T> = O extends { nullable: false }
  ? ApplyPresence<O, T>
  : ApplyPresence<O, T> | null;

/**
 * What a `ColorField` holds once the model is initialized.
 *
 * Not a string. The field casts its stored value to a CSS string, but
 * `initialize` hands back a `Color` instance — so `system.tint` is an object
 * with `.css`, `.rgb`, `.hex` and friends, and typing it as `string` makes
 * every property access on it a lie the compiler accepts.
 *
 * It is also nullable by default, unlike every other string-backed field.
 * Writing `new fields.ColorField()` and reading `.css` off it crashes on a
 * fresh document, which is exactly what this type now refuses.
 */
type ColorFieldValue<O> = PresenceNullableByDefault<O, Color>;

/**
 * What a `ForeignDocumentField` holds once the model is initialized.
 *
 * With `idOnly`, the stored id string. Without it the field resolves to a
 * getter, and the data model installs it as one — so reading the property
 * gives the document instance, not the function that fetched it. It yields
 * `null` when the id points at nothing, or when the parent lives in a
 * compendium.
 *
 * Nullable by default, so `null` is in both shapes unless the schema says
 * otherwise.
 *
 * One caveat this does not encode: on the server the field keeps the id
 * string in both cases, because there are no collections to resolve against.
 * System code runs on both sides, and typing that union would put a string
 * check in front of every read of a document reference. The client shape is
 * the one worth typing.
 */
type ForeignDocumentValue<Doc extends DocumentClass, O> = PresenceNullableByDefault<
  O,
  O extends { idOnly: true } ? string : InstanceType<Doc>
>;

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
              : F extends ForeignDocumentFieldInstance<infer Doc, infer O>
                ? ForeignDocumentValue<Doc, O>
                : F extends ArrayFieldInstance<infer Inner, infer O>
                  ? ApplyPresence<O, InferField<Inner>[]>
                  : F extends SetFieldInstance<infer Inner, infer O>
                    ? ApplyPresence<O, Set<InferField<Inner>>>
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
