/**
 * GearData — typed schema for the `gear` Item type.
 *
 * Carries a `kind` enum that drives the `.sh-tag` pill on the character sheet:
 * `equipped` / `valued` render with the ember accent pill, `stowed` renders
 * muted. Mirrors the items column in character-sheet.jsx.
 */

import { BaseTypeDataModel, fields } from '@vttforge/core';

export const GEAR_KINDS = /** @type {const} */ (['equipped', 'valued', 'stowed']);

export class GearData extends BaseTypeDataModel() {
  static defineSchema() {
    const f = fields();
    return {
      quantity: new f.NumberField({
        required: true,
        integer: true,
        min: 0,
        initial: 1,
      }),
      weight: new f.NumberField({
        required: true,
        min: 0,
        initial: 0,
      }),
      kind: new f.StringField({
        required: true,
        choices: GEAR_KINDS,
        initial: 'stowed',
      }),
      description: new f.HTMLField(),
    };
  }
}
