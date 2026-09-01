/**
 * `fields()` — typed bag of Foundry v13 data-field constructors.
 *
 * Foundry idiom inside `defineSchema()` is `const f = foundry.data.fields`. We
 * mirror that, but routed through a factory so the import succeeds in Node
 * (tests, IDE typecheck) where the global is absent. The factory resolves
 * `globalThis.foundry.data.fields` lazily — same pattern as
 * `BaseTypeDataModel()` (see `base-type-data-model.ts:25`) and
 * `BaseActorSheet()` (see `base-actor-sheet.ts:40`).
 *
 * v0.1 covers eight fields (PRD §7): NumberField, StringField, BooleanField,
 * HTMLField, ArrayField, SchemaField, ColorField, FilePathField. The instance
 * interfaces carry a phantom `[BRAND]` tag and an `options` capture so the
 * conditional types in `./infer-schema.ts` can extract the runtime semantics
 * (e.g. `nullable: true`).
 *
 * `EmbeddedDataField`, `EmbeddedDocumentField`, `TypedSchemaField`, and the
 * full required×initial nullability matrix ship with `@vttforge/types` v1.0.
 */

import { VttfError } from '../errors/registry.js';
import type {
  ArrayFieldOptions,
  BooleanFieldOptions,
  ColorFieldOptions,
  EmbeddedDataFieldOptions,
  EmbeddedDocumentFieldOptions,
  FilePathFieldOptions,
  ForeignDocumentFieldOptions,
  HTMLFieldOptions,
  NumberFieldOptions,
  SchemaFieldOptions,
  SetFieldOptions,
  StringFieldOptions,
  TypedSchemaFieldOptions,
} from './field-options.js';

declare const BRAND: unique symbol;

/**
 * Anything that satisfies the `FieldInstance` shape — used as the inner-field
 * constraint on `ArrayField` and as the value type of `SchemaField`'s child
 * map. Keeps the conditional types in `./infer-schema.ts` straightforward.
 */
export interface FieldInstance {
  readonly [BRAND]: string;
  readonly options: unknown;
}

export interface NumberFieldInstance<O extends NumberFieldOptions = NumberFieldOptions>
  extends FieldInstance {
  readonly [BRAND]: 'number';
  readonly options: O;
}

export interface StringFieldInstance<O extends StringFieldOptions = StringFieldOptions>
  extends FieldInstance {
  readonly [BRAND]: 'string';
  readonly options: O;
}

export interface BooleanFieldInstance<O extends BooleanFieldOptions = BooleanFieldOptions>
  extends FieldInstance {
  readonly [BRAND]: 'boolean';
  readonly options: O;
}

export interface HTMLFieldInstance<O extends HTMLFieldOptions = HTMLFieldOptions>
  extends FieldInstance {
  readonly [BRAND]: 'html';
  readonly options: O;
}

export interface ColorFieldInstance<O extends ColorFieldOptions = ColorFieldOptions>
  extends FieldInstance {
  readonly [BRAND]: 'color';
  readonly options: O;
}

export interface FilePathFieldInstance<O extends FilePathFieldOptions = FilePathFieldOptions>
  extends FieldInstance {
  readonly [BRAND]: 'filePath';
  readonly options: O;
}

export interface ArrayFieldInstance<
  Inner extends FieldInstance = FieldInstance,
  O extends ArrayFieldOptions = ArrayFieldOptions,
> extends FieldInstance {
  readonly [BRAND]: 'array';
  readonly element: Inner;
  readonly options: O;
}

/**
 * A `SetField` holds a `Set`, not an array.
 *
 * It extends `ArrayField` and validates the same way, but `initialize`
 * wraps the result in `new Set(...)` — so a schema that declares one and
 * types it as an array gets `.push` and index access from the compiler on a
 * value that has neither.
 */
export interface SetFieldInstance<
  Inner extends FieldInstance = FieldInstance,
  O extends SetFieldOptions = SetFieldOptions,
> extends FieldInstance {
  readonly [BRAND]: 'set';
  readonly element: Inner;
  readonly options: O;
}

/**
 * A reference to another document, stored as its id.
 *
 * What you read back depends on `idOnly`. With it, the id string. Without
 * it, the document itself: the field resolves to a getter, so reading the
 * property looks the document up in its collection and hands back the
 * instance — or `null` when it is gone or lives in a compendium.
 *
 * The field is nullable by default, so both shapes admit `null`.
 */
export interface ForeignDocumentFieldInstance<
  Doc extends DocumentClass = DocumentClass,
  O extends ForeignDocumentFieldOptions = ForeignDocumentFieldOptions,
> extends FieldInstance {
  readonly [BRAND]: 'foreignDocument';
  readonly model: Doc;
  readonly options: O;
}

/**
 * A nested data model.
 *
 * It is a `SchemaField` built from the model class's own `defineSchema()`, so
 * the value is an instance of that model — not a plain object. Reading it
 * gives you the model's derived data and methods too.
 */
export interface EmbeddedDataFieldInstance<
  Model extends DataModelClass = DataModelClass,
  O extends EmbeddedDataFieldOptions = EmbeddedDataFieldOptions,
> extends FieldInstance {
  readonly [BRAND]: 'embeddedData';
  readonly model: Model;
  readonly options: O;
}

/**
 * A single embedded document, stored inline.
 *
 * Like `EmbeddedDataField` but for a Document class, and nullable by default:
 * the field's own defaults turn `nullable` on, so an absent one reads `null`.
 */
export interface EmbeddedDocumentFieldInstance<
  Doc extends DataModelClass = DataModelClass,
  O extends EmbeddedDocumentFieldOptions = EmbeddedDocumentFieldOptions,
> extends FieldInstance {
  readonly [BRAND]: 'embeddedDocument';
  readonly model: Doc;
  readonly options: O;
}

/**
 * One of several shapes, told apart by a `type` property.
 *
 * Each entry becomes its own SchemaField. When an entry does not declare a
 * `type` field, the field adds one — a required string whose value must equal
 * that entry's key — which is what makes the result a discriminated union you
 * can narrow on.
 */
export interface TypedSchemaFieldInstance<
  T extends Record<string, Record<string, FieldInstance>> = Record<
    string,
    Record<string, FieldInstance>
  >,
  O extends TypedSchemaFieldOptions = TypedSchemaFieldOptions,
> extends FieldInstance {
  readonly [BRAND]: 'typedSchema';
  readonly types: T;
  readonly options: O;
}

export interface SchemaFieldInstance<
  S extends Record<string, FieldInstance> = Record<string, FieldInstance>,
  O extends SchemaFieldOptions = SchemaFieldOptions,
> extends FieldInstance {
  readonly [BRAND]: 'schema';
  readonly fields: S;
  readonly options: O;
}

export interface NumberFieldCtor {
  new <O extends NumberFieldOptions = NumberFieldOptions>(options?: O): NumberFieldInstance<O>;
}

export interface StringFieldCtor {
  new <O extends StringFieldOptions = StringFieldOptions>(options?: O): StringFieldInstance<O>;
}

export interface BooleanFieldCtor {
  new <O extends BooleanFieldOptions = BooleanFieldOptions>(options?: O): BooleanFieldInstance<O>;
}

export interface HTMLFieldCtor {
  new <O extends HTMLFieldOptions = HTMLFieldOptions>(options?: O): HTMLFieldInstance<O>;
}

export interface ColorFieldCtor {
  new <O extends ColorFieldOptions = ColorFieldOptions>(options?: O): ColorFieldInstance<O>;
}

export interface FilePathFieldCtor {
  new <O extends FilePathFieldOptions = FilePathFieldOptions>(
    options?: O,
  ): FilePathFieldInstance<O>;
}

export interface ArrayFieldCtor {
  new <Inner extends FieldInstance, O extends ArrayFieldOptions = ArrayFieldOptions>(
    element: Inner,
    options?: O,
  ): ArrayFieldInstance<Inner, O>;
}

export interface SetFieldCtor {
  new <Inner extends FieldInstance, O extends SetFieldOptions = SetFieldOptions>(
    element: Inner,
    options?: O,
  ): SetFieldInstance<Inner, O>;
}

/**
 * Any document class — what `ForeignDocumentField` takes as its first
 * argument. Declared structurally so the inference surface stays free of a
 * dependency on a Foundry type package.
 */
export type DocumentClass = abstract new (...args: never[]) => object;

export interface ForeignDocumentFieldCtor {
  new <
    Doc extends DocumentClass,
    O extends ForeignDocumentFieldOptions = ForeignDocumentFieldOptions,
  >(
    model: Doc,
    options?: O,
  ): ForeignDocumentFieldInstance<Doc, O>;
}

/** Any DataModel subclass — what the embedded fields take as their type. */
export type DataModelClass = abstract new (...args: never[]) => object;

export interface EmbeddedDataFieldCtor {
  new <Model extends DataModelClass, O extends EmbeddedDataFieldOptions = EmbeddedDataFieldOptions>(
    model: Model,
    options?: O,
  ): EmbeddedDataFieldInstance<Model, O>;
}

export interface EmbeddedDocumentFieldCtor {
  new <
    Doc extends DataModelClass,
    O extends EmbeddedDocumentFieldOptions = EmbeddedDocumentFieldOptions,
  >(
    model: Doc,
    options?: O,
  ): EmbeddedDocumentFieldInstance<Doc, O>;
}

export interface TypedSchemaFieldCtor {
  new <
    T extends Record<string, Record<string, FieldInstance>>,
    O extends TypedSchemaFieldOptions = TypedSchemaFieldOptions,
  >(
    types: T,
    options?: O,
  ): TypedSchemaFieldInstance<T, O>;
}

export interface SchemaFieldCtor {
  new <S extends Record<string, FieldInstance>, O extends SchemaFieldOptions = SchemaFieldOptions>(
    fields: S,
    options?: O,
  ): SchemaFieldInstance<S, O>;
}

/**
 * Typed bag returned by `fields()`. Each property is the corresponding
 * `foundry.data.fields.*` class — the runtime value is Foundry's own
 * constructor; the type is our overlay.
 */
export interface FieldsApi {
  readonly NumberField: NumberFieldCtor;
  readonly StringField: StringFieldCtor;
  readonly BooleanField: BooleanFieldCtor;
  readonly HTMLField: HTMLFieldCtor;
  readonly ColorField: ColorFieldCtor;
  readonly FilePathField: FilePathFieldCtor;
  readonly ArrayField: ArrayFieldCtor;
  readonly SetField: SetFieldCtor;
  readonly ForeignDocumentField: ForeignDocumentFieldCtor;
  readonly SchemaField: SchemaFieldCtor;
  readonly EmbeddedDataField: EmbeddedDataFieldCtor;
  readonly EmbeddedDocumentField: EmbeddedDocumentFieldCtor;
  readonly TypedSchemaField: TypedSchemaFieldCtor;
}

interface FoundryDataNamespace {
  readonly fields?: Record<string, unknown>;
}

interface FoundryRoot {
  readonly data?: FoundryDataNamespace;
}

/**
 * Resolve `globalThis.foundry.data.fields` and return it typed as `FieldsApi`.
 *
 * Call this inside `defineSchema()` (or any code that runs after Foundry's
 * `init` hook). Calling at module scope will throw when imported from Node
 * tests — the global only exists inside the Foundry runtime.
 *
 * @throws `VttfError` with code `VTTF-0002` when `foundry.data.fields` is
 * missing.
 */
export function fields(): FieldsApi {
  const foundry = (globalThis as Record<string, unknown>).foundry as FoundryRoot | undefined;
  const f = foundry?.data?.fields;
  if (f === undefined || f === null) {
    throw new VttfError(
      'VTTF-0002',
      'foundry.data.fields is not available. Call fields() inside the Foundry runtime (or stub the global in tests).',
    );
  }
  return f as unknown as FieldsApi;
}
