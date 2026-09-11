/**
 * A dialog from a list of fields.
 *
 * Every system writes the same dialog several times: a title, a few inputs,
 * an OK button, and the values back as an object. `DialogV2.input` returns
 * the form data; what it leaves to you is the markup, and the markup is where
 * a name attribute goes missing or a number comes back as a string.
 * `promptFields` builds the form from Foundry's own input helpers, so every
 * field is a proper form group with a label and a hint, and the result is
 * typed by the fields you listed.
 *
 * ```ts
 * const answer = await promptFields(
 *   [
 *     { name: 'name', type: 'text', label: 'Name', value: 'Rope' },
 *     { name: 'quantity', type: 'number', label: 'Quantity', value: 1, min: 1 },
 *     { name: 'kind', type: 'select', label: 'Kind', options: { stowed: 'Stowed', equipped: 'Equipped' } },
 *   ],
 *   { title: 'New gear' },
 * );
 * if (answer) await Item.create({ name: answer.name, ... });
 * // answer: { name: string; quantity: number; kind: string } | null
 * ```
 */

import { VttfError } from './errors/registry.js';
import { localize } from './text.js';

interface PromptFieldBase {
  /** The key in the result, and the input's `name`. */
  readonly name: string;
  /** Label, as a localization key or text. */
  readonly label: string;
  /** Hint under the input, as a localization key or text. */
  readonly hint?: string;
}

export interface TextPromptField extends PromptFieldBase {
  readonly type: 'text';
  readonly value?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
}

export interface TextareaPromptField extends PromptFieldBase {
  readonly type: 'textarea';
  readonly value?: string;
  readonly placeholder?: string;
  readonly rows?: number;
}

export interface NumberPromptField extends PromptFieldBase {
  readonly type: 'number';
  readonly value?: number;
  readonly min?: number;
  readonly max?: number;
  /** Default `1`. `'any'` allows decimals. */
  readonly step?: number | 'any';
}

export interface CheckboxPromptField extends PromptFieldBase {
  readonly type: 'checkbox';
  readonly value?: boolean;
}

export interface SelectPromptOption {
  readonly value: string;
  /** As a localization key or text. */
  readonly label: string;
  readonly group?: string;
  readonly disabled?: boolean;
}

export interface SelectPromptField extends PromptFieldBase {
  readonly type: 'select';
  readonly value?: string;
  /** `{ value: label }`, or a list when order or groups matter. */
  readonly options: Readonly<Record<string, string>> | readonly SelectPromptOption[];
  /** Text for an empty first option. Left out, there is none. */
  readonly blank?: string;
}

export type PromptField =
  | TextPromptField
  | TextareaPromptField
  | NumberPromptField
  | CheckboxPromptField
  | SelectPromptField;

/** The value a field of each type comes back as. */
export type PromptFieldValue<F extends PromptField> = F extends NumberPromptField
  ? number
  : F extends CheckboxPromptField
    ? boolean
    : string;

/** The object `promptFields` resolves to: one key per field. */
export type PromptResult<Fields extends readonly PromptField[]> = {
  [F in Fields[number] as F['name']]: PromptFieldValue<F>;
};

export interface PromptFieldsOptions {
  /** Window title, as a localization key or text. */
  readonly title?: string;
  /** OK button label, as a localization key or text. Default: Foundry's. */
  readonly ok?: string;
  /** OK button icon class. */
  readonly icon?: string;
  /** HTML shown above the fields. Cleaned by Foundry. */
  readonly content?: string;
  /** Block the rest of the interface until answered. */
  readonly modal?: boolean;
  /** Reject instead of resolving `null` when the dialog is dismissed. */
  readonly rejectClose?: boolean;
}

interface SelectOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
}

interface FieldsApi {
  createFormGroup(config: Record<string, unknown>): HTMLElement;
  createTextInput(config: Record<string, unknown>): HTMLElement;
  createTextareaInput(config: Record<string, unknown>): HTMLElement;
  createNumberInput(config: Record<string, unknown>): HTMLElement;
  createCheckboxInput(config: Record<string, unknown>): HTMLElement;
  createSelectInput(config: Record<string, unknown>): HTMLElement;
}

interface DialogApi {
  input(config: Record<string, unknown>): Promise<unknown>;
}

function foundryApis(): { fields: FieldsApi; DialogV2: DialogApi } {
  const foundry = (globalThis as Record<string, unknown>).foundry as
    | { applications?: { fields?: FieldsApi; api?: { DialogV2?: DialogApi } } }
    | undefined;
  const fields = foundry?.applications?.fields;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (!fields?.createFormGroup || !DialogV2?.input) {
    throw new VttfError(
      'VTTF-0002',
      'foundry.applications.fields and DialogV2 are not available. Call promptFields() inside a Foundry runtime or stub them in tests',
    );
  }
  return { fields, DialogV2 };
}

function selectOptions(field: SelectPromptField): SelectOption[] {
  const list: SelectOption[] = Array.isArray(field.options)
    ? (field.options as readonly SelectPromptOption[]).map((option) => ({ ...option }))
    : Object.entries(field.options as Record<string, string>).map(([value, label]) => ({
        value,
        label,
      }));
  return list.map((option) => ({ ...option, label: localize(option.label) }));
}

/** The `<div class="form-group">` for one field. Exported for a custom dialog. */
export function promptFieldGroup(field: PromptField): HTMLElement {
  const { fields } = foundryApis();
  let input: HTMLElement;
  switch (field.type) {
    case 'text':
      input = fields.createTextInput({
        name: field.name,
        value: field.value ?? '',
        placeholder: field.placeholder === undefined ? undefined : localize(field.placeholder),
        required: field.required,
      });
      break;
    case 'textarea':
      input = fields.createTextareaInput({
        name: field.name,
        value: field.value ?? '',
        placeholder: field.placeholder === undefined ? undefined : localize(field.placeholder),
        rows: field.rows,
      });
      break;
    case 'number':
      input = fields.createNumberInput({
        name: field.name,
        value: field.value,
        min: field.min,
        max: field.max,
        step: field.step ?? 1,
      });
      break;
    case 'checkbox':
      input = fields.createCheckboxInput({ name: field.name, value: field.value ?? false });
      break;
    case 'select':
      input = fields.createSelectInput({
        name: field.name,
        value: field.value,
        options: selectOptions(field),
        blank: field.blank === undefined ? undefined : localize(field.blank),
      });
      break;
    default:
      throw new VttfError(
        'VTTF-0002',
        `promptFields(): unknown field type "${String((field as { type: unknown }).type)}"`,
      );
  }
  return fields.createFormGroup({
    input,
    label: localize(field.label),
    hint: field.hint === undefined ? undefined : localize(field.hint),
  });
}

/**
 * Show the fields in a dialog and resolve to their values, or `null` when the
 * dialog is dismissed.
 *
 * Numbers come back as numbers and checkboxes as booleans; Foundry's form
 * reader casts them from the input type. The first field gets the focus.
 */
export async function promptFields<const Fields extends readonly PromptField[]>(
  fields: Fields,
  options: PromptFieldsOptions = {},
): Promise<PromptResult<Fields> | null> {
  if (fields.length === 0) {
    throw new VttfError('VTTF-0002', 'promptFields(): give it at least one field');
  }
  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field.name)) {
      throw new VttfError(
        'VTTF-0002',
        `promptFields(): two fields are named "${field.name}"; the result has one key per name`,
      );
    }
    seen.add(field.name);
  }
  const { DialogV2 } = foundryApis();
  const content = document.createElement('div');
  if (options.content) {
    const intro = document.createElement('div');
    intro.innerHTML = options.content;
    content.append(intro);
  }
  for (const field of fields) content.append(promptFieldGroup(field));
  content.querySelector<HTMLElement>('input, select, textarea')?.setAttribute('autofocus', '');

  const ok: Record<string, unknown> = {};
  if (options.ok !== undefined) ok.label = options.ok;
  if (options.icon !== undefined) ok.icon = options.icon;
  const config: Record<string, unknown> = { content, ok };
  if (options.title !== undefined) config.window = { title: options.title };
  if (options.modal !== undefined) config.modal = options.modal;
  if (options.rejectClose !== undefined) config.rejectClose = options.rejectClose;

  const result = await DialogV2.input(config);
  if (result === null || result === undefined || typeof result !== 'object') return null;
  return result as PromptResult<Fields>;
}
