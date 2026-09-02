/**
 * CharacterData — the `character` Actor type.
 *
 * Quick stats are HP / AC / SPD / INIT; abilities are the six classic scores.
 * Derived state (modifiers, max HP, armour class, initiative) is computed in
 * memory in `prepareDerivedData`. Never write to the database from there.
 */
import { BaseTypeDataModel, fields } from '@vttforge/core';

/**
 * The schema, as a function handed to the factory.
 *
 * It has to be a function rather than an object because `fields()` reads a
 * Foundry global that does not exist when this module is first evaluated.
 * Handing it to `BaseTypeDataModel(...)` rather than declaring a `static
 * defineSchema()` is also what types the fields if you ever add `checkJs`.
 */
const defineCharacterSchema = () => {
  const f = fields();

  // One ability. `value` is stored and is what the sheet's input writes to
  // (`name="system.abilities.str.value"`). `mod` is derived on every data
  // preparation; it lives in the schema because JavaScript has no `declare`
  // — a class field would emit and reset the property to undefined.
  const score = () =>
    new f.SchemaField({
      value: new f.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 1,
        max: 30,
        initial: 10,
      }),
      mod: new f.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
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
};

export class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {
  /** @override */
  prepareDerivedData() {
    for (const ability of Object.values(this.abilities)) {
      ability.mod = Math.floor((ability.value - 10) / 2);
    }

    this.health.max = 10 + this.level + this.abilities.con.mod;
    this.armorClass = 10 + this.abilities.dex.mod;
    this.initiative = this.abilities.dex.mod;
  }
}
