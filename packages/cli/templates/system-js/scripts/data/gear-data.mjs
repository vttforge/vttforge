/**
 * GearData — typed schema for the `gear` Item type.
 *
 * `kind` is an enum that drives the inventory pill on the character sheet:
 * `equipped` and `valued` render with the accent pill, `stowed` renders
 * muted.
 */
import { BaseTypeDataModel, fields } from '@vttforge/core';

const GEAR_KINDS = /** @type {const} */ (['equipped', 'valued', 'stowed']);

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
