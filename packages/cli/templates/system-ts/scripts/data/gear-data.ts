/**
 * GearData — the `gear` Item type.
 *
 * `kind` drives the inventory pill on the character sheet: `equipped` and
 * `valued` render with the accent pill, `stowed` renders muted.
 */
import { BaseTypeDataModel, fields } from '@vttforge/core';

export const GEAR_KINDS = ['equipped', 'valued', 'stowed'] as const;
export type GearKind = (typeof GEAR_KINDS)[number];

const defineGearSchema = () => {
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
      nullable: false,
      choices: GEAR_KINDS,
      initial: 'stowed',
    }),
    description: new f.HTMLField(),
  };
};

export class GearData extends BaseTypeDataModel(defineGearSchema) {}

/** The shape of `item.system` for gear, derived from the schema. */
export type GearSystem = GearData['$inferData'];
