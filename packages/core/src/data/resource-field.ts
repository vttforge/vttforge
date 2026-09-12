/**
 * A resource: `{ value, max }`, the shape a token bar reads.
 *
 * Hit points, power, stress, ammunition: every system writes this
 * `SchemaField` several times, and every time the two children must be
 * required, non-nullable numbers or the token bar degrades to a number with
 * no bar. `resourceField()` is that once, typed so `system.health.value` is a
 * `number` in `prepareDerivedData` and on the sheet.
 */

import { VttfError } from '../errors/registry.js';
import type { SchemaFieldOptions } from './field-options.js';
import { fields, type NumberFieldInstance, type SchemaFieldInstance } from './fields.js';

export interface ResourceFieldOptions {
  /** Starting `value`. Default `0`. */
  readonly initial?: number;
  /** Starting `max`. Default: the same as `initial`. */
  readonly max?: number;
  /** Lowest allowed for both. Default `0`. */
  readonly min?: number;
  /** Whole numbers only. Default `true`. */
  readonly integer?: boolean;
  /** Label for the field, as a localization key or text. */
  readonly label?: string;
  /** Hint for the field, as a localization key or text. */
  readonly hint?: string;
}

/** What the children are, as `InferSchema` reads them: a `number` each. */
export type ResourceChildField = NumberFieldInstance<{
  readonly required: true;
  readonly nullable: false;
  readonly integer: boolean;
  readonly min: number;
  readonly initial: number;
}>;

export type ResourceFieldInstance = SchemaFieldInstance<
  { value: ResourceChildField; max: ResourceChildField },
  SchemaFieldOptions
>;

/**
 * A `SchemaField` with `value` and `max`, both required, non-nullable
 * numbers.
 *
 * ```ts
 * const f = fields();
 * return {
 *   health: resourceField({ initial: 10 }),
 *   power: resourceField({ initial: 5, max: 5, label: 'MY_SYSTEM.Power' }),
 * };
 * ```
 *
 * Point the manifest's `primaryTokenAttribute` at the key, `health` here,
 * and the token bar has what it needs.
 */
export function resourceField(options: ResourceFieldOptions = {}): ResourceFieldInstance {
  const initial = options.initial ?? 0;
  const max = options.max ?? initial;
  const min = options.min ?? 0;
  const integer = options.integer ?? true;
  if (min > initial || min > max) {
    throw new VttfError(
      'VTTF-0010',
      `resourceField(): min (${min}) is above initial (${initial}) or max (${max}).`,
    );
  }
  const f = fields();
  const child = (start: number): ResourceChildField =>
    new f.NumberField({
      required: true,
      nullable: false,
      integer,
      min,
      initial: start,
    }) as ResourceChildField;
  const schemaOptions: { label?: string; hint?: string } = {};
  if (options.label !== undefined) schemaOptions.label = options.label;
  if (options.hint !== undefined) schemaOptions.hint = options.hint;
  return new f.SchemaField(
    { value: child(initial), max: child(max) },
    schemaOptions,
  ) as ResourceFieldInstance;
}

/**
 * Whether a schema declares a resource at `path`: a `SchemaField` whose
 * `fields` hold both `value` and `max`. Reads Foundry's own field objects,
 * so it works on any schema, not only one built with `resourceField()`.
 */
export function schemaHasResource(schema: unknown, path: string): boolean {
  let node: unknown = schema;
  for (const segment of path.split('.')) {
    const fieldsOf = (node as { fields?: Record<string, unknown> } | undefined)?.fields;
    if (!fieldsOf || typeof fieldsOf !== 'object') return false;
    node = fieldsOf[segment];
    if (node === undefined) return false;
  }
  const leaf = (node as { fields?: Record<string, unknown> } | undefined)?.fields;
  return Boolean(leaf && typeof leaf === 'object' && 'value' in leaf && 'max' in leaf);
}
