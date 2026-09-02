/**
 * GearData — typed schema for the `gear` Item type.
 *
 * Carries a `kind` enum that drives the `.sh-tag` pill on the character sheet:
 * `equipped` / `valued` render with the ember accent pill, `stowed` renders
 * muted. Mirrors the items column in character-sheet.jsx.
 */

import { BaseTypeDataModel, fields } from '@vttforge/core';

const GEAR_KINDS = /** @type {const} */ (['equipped', 'valued', 'stowed']);

// Passed to the factory rather than declared as `static defineSchema()`, so
// the fields are typed. Both forms work at runtime; only this one tells
// TypeScript what `this.quantity` is.
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
      choices: GEAR_KINDS,
      initial: 'stowed',
    }),
    description: new f.HTMLField(),
  };
};

export class GearData extends BaseTypeDataModel(defineGearSchema) {}
