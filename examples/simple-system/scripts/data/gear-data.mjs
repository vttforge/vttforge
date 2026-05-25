/**
 * GearData — typed schema for the `gear` Item type.
 *
 * Trivial schema (quantity, weight, description) — the point isn't the data
 * model but the drag-drop path: a `gear` Item can be dragged from the sidebar
 * onto a CharacterSheet, and the sheet's typed `onDropItem` accepts it.
 */

import { BaseTypeDataModel, fields } from '@vttforge/core';

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
      description: new f.HTMLField(),
    };
  }
}
