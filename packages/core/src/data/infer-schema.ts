/**
 * `InferSchema<T>`: derive the runtime shape of `actor.system` (or
 * `item.system`) from a `defineSchema()` return value.
 *
 * v0.1 scope (PRD §7): the field brands in `./fields.ts`. Recurses through
 * `ArrayField`, `SetField` and `SchemaField`. Out of scope until v1.0 (moves
 * to `@vttforge/types`): `EmbeddedDataField`, `EmbeddedDocumentField` and
 * `TypedSchemaField`.
 *
 * Document-level fields (ownership, the `_stats` block) are deliberately
 * absent. They live on the document, never inside the schema a type data
 * model defines, so they cannot appear in what this maps.
 *
 * One thing to know when writing schemas: this reads the literal types of
 * the options you pass. Hand a field an options object held in a variable
 * and `nullable: false` widens to `boolean`, which says nothing, so the
 * field's own default applies instead. Pin such an object with `as const`
 * (or `/** @type {const} *\/` in JavaScript) and the declared values count.
 */
import type { Color } from './color.js';
import type {
  ArrayFieldInstance,
  BooleanFieldInstance,
  ColorFieldInstance,
  DocumentClass,
  EmbeddedDataFieldInstance,
  EmbeddedDocumentFieldInstance,
  FieldInstance,
  FilePathFieldInstance,
  ForeignDocumentFieldInstance,
  HTMLFieldInstance,
  NumberFieldInstance,
  SchemaFieldInstance,
  SetFieldInstance,
  StringFieldInstance,
  TypedSchemaFieldInstance,
} from './fields.js';

/**
 * Flatten an intersection / mapped type into a plain object literal so IDE
 * hovers stay readable (Matt Pocock's `Prettify`). Use on every public
 * conditional-type surface, for IDE performance.
 */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Whether a field's options gave an explicit `initial`.
 *
 * Presence of the key is the question, not its value: `{ initial: undefined }`
 * is not an initial.
 */
type HasInitial<O> = O extends { initial: unknown } ? true : false;

/**
 * What a field class decides on its own behalf, for the options a schema
 * leaves out.
 *
 * Every field type sets its own defaults, and they disagree. A number field
 * is optional and nullable out of the box; a boolean field is required and
 * starts at `false`. Reading a schema without knowing which defaults apply
 * gets the shape wrong for exactly the fields people write most.
 */
interface FieldDefaults {
  /** Whether the field is required when the schema does not say. */
  required: boolean;
  /** Whether the field admits `null` when the schema does not say. */
  nullable: boolean;
  /** Whether the field supplies a value when the schema gives no `initial`. */
  populated: boolean;
}

/** Read an option the schema may have set, falling back to the field's default. */
type Resolve<O, Key extends string, Fallback extends boolean> =
  O extends Record<Key, true> ? true : O extends Record<Key, false> ? false : Fallback;

/**
 * Widen a field's base type by what it can actually hold.
 *
 * Two independent widenings:
 *
 * - nullable admits `null`.
 * - not required, with nothing to fall back on, admits `undefined`: cleaning
 *   asks the field for an initial value and keeps whatever it gets, which is
 *   `undefined` when there is no initial to give.
 *
 * A required field never widens to `undefined`. It would fail validation
 * before the document existed, so there is no state to type.
 */
type Presence<O, T, D extends FieldDefaults> =
  | T
  | (Resolve<O, 'nullable', D['nullable']> extends true ? null : never)
  | (Resolve<O, 'required', D['required']> extends true
      ? never
      : HasInitial<O> extends true
        ? never
        : D['populated'] extends true
          ? never
          : undefined);

/** Optional, nullable, nothing to fall back on. */
type NumberDefaults = { required: false; nullable: true; populated: false };
/** Optional and non-nullable, so an unset one is simply absent. */
type StringDefaults = { required: false; nullable: false; populated: false };
/** Required, and starts at `false`. */
type BooleanDefaults = { required: true; nullable: false; populated: true };
/** Required and blank-friendly, so an unset one is the empty string. */
type HTMLDefaults = { required: true; nullable: false; populated: true };
/** Optional and nullable, but starts at `null` rather than absent. */
type NullStartDefaults = { required: false; nullable: true; populated: true };
/** Required, and builds its own empty value. */
type ContainerDefaults = { required: true; nullable: false; populated: true };
/** Required but nullable: an id that points at nothing is `null`. */
type ReferenceDefaults = { required: true; nullable: true; populated: false };

/**
 * What a `ColorField` holds once the model is initialized.
 *
 * Not a string. The field casts its stored value to a CSS string, but
 * `initialize` hands back a `Color` instance, so `system.tint` is an object
 * with `.css`, `.rgb`, `.hex` and friends, and typing it as `string` makes
 * every property access on it a lie the compiler accepts.
 *
 * It starts at `null`, so reading `.css` off a fresh document crashes unless
 * the schema gives it an initial. That is what this type refuses.
 */
type ColorFieldValue<O> = Presence<O, Color, NullStartDefaults>;

/**
 * What a `ForeignDocumentField` holds once the model is initialized.
 *
 * With `idOnly`, the stored id string. Without it the field resolves to a
 * getter, and the data model installs it as one, so reading the property
 * gives the document instance, not the function that fetched it. It yields
 * `null` when the id points at nothing, or when the parent lives in a
 * compendium.
 *
 * Two caveats this does not encode, both narrow enough to document rather
 * than type:
 *
 * - On the server the field keeps the id string in both cases, because there
 *   are no collections to resolve against. System code runs on both sides,
 *   but typing that union would put a string check in front of every read of
 *   a document reference.
 * - Under `readonly: true` the data model takes the read-only branch before
 *   the getter branch, so the property keeps the resolver function itself.
 *   The field turns that flag off by default and no schema has reason to
 *   turn it back on.
 */
type ForeignDocumentValue<Doc extends DocumentClass, O> = Presence<
  O,
  O extends { idOnly: true } ? string : InstanceType<Doc>,
  ReferenceDefaults
>;

/**
 * What a `TypedSchemaField` holds: one shape per entry, each carrying the
 * key it was filed under as its `type`.
 *
 * The field supplies that `type` when an entry does not declare one (a
 * required string validated to equal the key), so narrowing on `type` picks
 * exactly one branch.
 */
type TypedSchemaValue<T extends Record<string, Record<string, FieldInstance>>> = {
  [K in keyof T]: Prettify<InferSchema<T[K]> & { type: K }>;
}[keyof T];

/**
 * Map a single field instance to its runtime TypeScript type. `never` for
 * shapes we don't recognise; `@vttforge/types` will widen
 * this matrix to the remaining Foundry fields.
 */
export type InferField<F> =
  F extends NumberFieldInstance<infer O>
    ? Presence<O, number, NumberDefaults>
    : F extends StringFieldInstance<infer O>
      ? Presence<O, string, StringDefaults>
      : F extends BooleanFieldInstance<infer O>
        ? Presence<O, boolean, BooleanDefaults>
        : F extends HTMLFieldInstance<infer O>
          ? Presence<O, string, HTMLDefaults>
          : F extends ColorFieldInstance<infer O>
            ? ColorFieldValue<O>
            : F extends FilePathFieldInstance<infer O>
              ? Presence<O, string, NullStartDefaults>
              : F extends ForeignDocumentFieldInstance<infer Doc, infer O>
                ? ForeignDocumentValue<Doc, O>
                : F extends ArrayFieldInstance<infer Inner, infer O>
                  ? Presence<O, InferField<Inner>[], ContainerDefaults>
                  : F extends SetFieldInstance<infer Inner, infer O>
                    ? Presence<O, Set<InferField<Inner>>, ContainerDefaults>
                    : F extends SchemaFieldInstance<infer S, infer O>
                      ? Presence<O, InferSchema<S>, ContainerDefaults>
                      : F extends EmbeddedDocumentFieldInstance<infer Doc, infer O>
                        ? Presence<O, InstanceType<Doc>, ReferenceDefaults>
                        : F extends EmbeddedDataFieldInstance<infer Model, infer O>
                          ? Presence<O, InstanceType<Model>, ContainerDefaults>
                          : F extends TypedSchemaFieldInstance<infer T, infer O>
                            ? Presence<O, TypedSchemaValue<T>, ContainerDefaults>
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
