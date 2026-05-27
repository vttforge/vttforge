/**
 * CharacterData — typed schema for the `character` Actor type.
 *
 * Quick stats are HP / AC / SPD / INIT, abilities are the six classic
 * scores (str/dex/con/int/wis/cha). Derived state (modifiers, max HP,
 * armor class, initiative) is computed in-memory in `prepareDerivedData`.
 *
 * `prepareBaseData` initialises fields that Active Effects need to mutate
 * (base max HP before any AE bonus); `prepareDerivedData` then computes
 * the AE-aware values (modifiers, percentages, totals). Never write to the
 * database in either hook — they're purely in-memory derivations.
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
      speed: new f.NumberField({
        required: true,
        integer: true,
        min: 0,
        initial: 30,
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
    for (const [key, value] of Object.entries(this.abilities)) {
      const score = typeof value === 'number' ? value : (value?.value ?? 10);
      const mod = Math.floor((score - 10) / 2);
      this.abilities[key] = { value: score, mod };
    }

    const conMod = this.abilities.con.mod;
    this.health.max = 10 + this.level + conMod;

    this.armorClass = 10 + this.abilities.dex.mod;
    this.initiative = this.abilities.dex.mod;
  }
}
