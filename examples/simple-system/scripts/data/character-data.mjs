/**
 * CharacterData — typed schema for the `character` Actor type.
 *
 * Demonstrates @vttforge/core's `fields()` + `BaseTypeDataModel()` working
 * together: one `defineSchema()` call drives runtime validation,
 * `system.json` migration, AND the TypeScript `system` shape (via
 * `InferSchema<typeof CharacterData.defineSchema>` in any TS consumer).
 *
 * Derived state (ability modifiers, computed max HP, armor class) is computed
 * in-memory only — never persisted. Matches foundry-vtt-system-dev rule
 * "Never write to the database in prepareDerivedData()".
 */

import { BaseTypeDataModel, fields } from '@vttforge/core';

export class CharacterData extends BaseTypeDataModel() {
  static defineSchema() {
    const f = fields();
    return {
      level: new f.NumberField({
        required: true,
        integer: true,
        min: 1,
        max: 20,
        initial: 1,
      }),
      abilities: new f.SchemaField({
        str: new f.NumberField({ required: true, integer: true, min: 1, max: 30, initial: 10 }),
        dex: new f.NumberField({ required: true, integer: true, min: 1, max: 30, initial: 10 }),
        con: new f.NumberField({ required: true, integer: true, min: 1, max: 30, initial: 10 }),
        int: new f.NumberField({ required: true, integer: true, min: 1, max: 30, initial: 10 }),
        wis: new f.NumberField({ required: true, integer: true, min: 1, max: 30, initial: 10 }),
        cha: new f.NumberField({ required: true, integer: true, min: 1, max: 30, initial: 10 }),
      }),
      health: new f.SchemaField({
        value: new f.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
        max: new f.NumberField({ required: true, integer: true, min: 0, initial: 10 }),
      }),
      power: new f.SchemaField({
        value: new f.NumberField({ required: true, integer: true, min: 0, initial: 5 }),
        max: new f.NumberField({ required: true, integer: true, min: 0, initial: 5 }),
      }),
      biography: new f.HTMLField(),
    };
  }

  prepareDerivedData() {
    // Ability modifiers: D&D 5e style.
    for (const [key, value] of Object.entries(this.abilities)) {
      const score = typeof value === 'number' ? value : (value?.value ?? 10);
      const mod = Math.floor((score - 10) / 2);
      this.abilities[key] = { value: score, mod };
    }

    // Derived max HP: 10 + level + Constitution modifier.
    const conMod = this.abilities.con.mod;
    this.health.max = 10 + this.level + conMod;

    // Armor class: 10 + Dex modifier.
    this.armorClass = 10 + this.abilities.dex.mod;
  }
}
