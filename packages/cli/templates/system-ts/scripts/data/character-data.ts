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
    // The six ability scores are written once, as a factory rather than a
    // shared options object: a field keeps the options it was handed, and
    // some field classes write back into them.
    const score = () =>
      new f.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 1,
        max: 30,
        initial: 10,
      });
    return {
      level: new f.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 1,
        max: 20,
        initial: 1,
      }),
      speed: new f.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 30,
      }),
      abilities: new f.SchemaField({
        str: score(),
        dex: score(),
        con: score(),
        int: score(),
        wis: score(),
        cha: score(),
      }),
      health: new f.SchemaField({
        value: new f.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 10 }),
        max: new f.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 10 }),
      }),
      power: new f.SchemaField({
        value: new f.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 5 }),
        max: new f.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 5 }),
      }),
      biography: new f.HTMLField(),
    };
  }

  prepareDerivedData() {
    // biome-ignore lint/suspicious/noExplicitAny: schema-driven types ship in a later @vttforge/types release
    const self = this as any;
    for (const [key, value] of Object.entries(self.abilities)) {
      const score = typeof value === 'number' ? value : ((value as { value?: number })?.value ?? 10);
      const mod = Math.floor((score - 10) / 2);
      self.abilities[key] = { value: score, mod };
    }

    const conMod = self.abilities.con.mod;
    self.health.max = 10 + self.level + conMod;

    self.armorClass = 10 + self.abilities.dex.mod;
    self.initiative = self.abilities.dex.mod;
  }
}
