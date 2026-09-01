/**
 * GearData — typed schema for the `gear` Item type.
 *
 * `kind` is an enum that drives the inventory pill on the character sheet:
 * `equipped` and `valued` render with the accent pill, `stowed` renders
 * muted.
 */
import { BaseTypeDataModel, fields } from '@vttforge/core';

const GEAR_KINDS = ['equipped', 'valued', 'stowed'] as const;

export class GearData extends BaseTypeDataModel() {
  static defineSchema() {
    const f = fields();
    return {
      quantity: new f.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 1,
      }),
      weight: new f.NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0,
      }),
      kind: new f.StringField({
        required: true,
        choices: GEAR_KINDS as unknown as string[],
        initial: 'stowed',
      }),
      description: new f.HTMLField(),
    };
  }
}
