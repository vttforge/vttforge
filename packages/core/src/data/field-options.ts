/**
 * Option interfaces for the Foundry v13 data fields covered by `@vttforge/core`'s
 * v0.1 `InferSchema<T>` surface.
 *
 * Mirrors the shape documented at https://foundryvtt.com/api/v13/ for each
 * `foundry.data.fields.*` class. Properties are structural: they exist purely
 * so the conditional types in `./infer-schema.ts` can extract semantics like
 * `nullable: true` without us pulling in `fvtt-types` (deferred to
 * `@vttforge/types` v1.0).
 */

/**
 * Properties shared by every Foundry data field option object.
 *
 * Mirrors the base `DataFieldOptions` interface documented at
 * https://foundryvtt.com/api/v13/classes/foundry.data.fields.DataField.html.
 */
export interface DataFieldOptions {
  readonly required?: boolean;
  readonly nullable?: boolean;
  readonly initial?: unknown;
  readonly readonly?: boolean;
  readonly gmOnly?: boolean;
  readonly label?: string;
  readonly hint?: string;
  readonly validationError?: string;
  readonly validate?: (value: unknown) => boolean | undefined;
}

export interface NumberFieldOptions extends DataFieldOptions {
  readonly integer?: boolean;
  readonly positive?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly choices?: readonly number[] | Record<string, number>;
}

export interface StringFieldOptions extends DataFieldOptions {
  readonly blank?: boolean;
  readonly trim?: boolean;
  readonly textSearch?: boolean;
  readonly choices?: readonly string[] | Record<string, string>;
}

export type BooleanFieldOptions = DataFieldOptions;

export type HTMLFieldOptions = StringFieldOptions;

export type ColorFieldOptions = StringFieldOptions;

export interface FilePathFieldOptions extends StringFieldOptions {
  readonly categories?: ReadonlyArray<'IMAGE' | 'VIDEO' | 'AUDIO' | 'TEXT' | 'FONT' | 'GRAPHICS'>;
  readonly base64?: boolean;
  readonly wildcard?: boolean;
}

export interface ArrayFieldOptions extends DataFieldOptions {
  readonly min?: number;
  readonly max?: number;
}

export type SchemaFieldOptions = DataFieldOptions;

/**
 * `SetField` takes the same options as `ArrayField`. It is a subclass whose
 * only difference is what `initialize` hands back.
 */
export type SetFieldOptions = ArrayFieldOptions;

export interface ForeignDocumentFieldOptions extends DataFieldOptions {
  /**
   * Keep the stored id instead of resolving the document.
   *
   * With this off, the field initializes to a getter: reading the property
   * gives you a function, and calling it looks the document up. That is why
   * the two cases infer to different types.
   */
  readonly idOnly?: boolean;
}

/** `EmbeddedDataField` builds a SchemaField from the model's own schema. */
export type EmbeddedDataFieldOptions = SchemaFieldOptions;

/** `EmbeddedDocumentField` is the same, but nullable out of the box. */
export type EmbeddedDocumentFieldOptions = SchemaFieldOptions;

/** `TypedSchemaField` is required by default and takes no options of its own. */
export type TypedSchemaFieldOptions = DataFieldOptions;
