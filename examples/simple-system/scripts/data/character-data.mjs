/**
 * CharacterData — typed schema for the `character` Actor type.
 *
 * Schema mirrors the canonical Figma reference (character-sheet.jsx): quick
 * stats are HP / AC / SPD / INIT, abilities are the six D&D-style scores,
 * derived state (modifiers, max HP, AC, initiative) is computed in-memory.
 *
 * Never write to the database in prepareDerivedData — only assign onto `this`.
 */

import { BaseTypeDataModel, fields } from '@vttforge/core';

/**
 * The schema, as a function passed to the factory rather than a `static
 * defineSchema()` on the class.
 *
 * Both work at runtime. Only this one is typed: hand the factory your schema
 * and `this.level` is a number inside `prepareDerivedData`, while the
 * no-argument form leaves every field unknown. The example used the untyped
 * form and nobody noticed, because an index signature was making every
 * property access legal.
 */
export const defineCharacterSchema = () => {
  const f = fields();
  // The six ability scores are written once, as a factory rather than a
  // shared options object: a field keeps the options it was handed, and
  // some field classes write back into them.
  // One ability. `value` is what is stored and what the sheet's input writes
  // to (`name="system.abilities.str.value"`); `mod` is derived below and
  // deliberately absent here, because a derived value is not source data.
  //
  // This used to be a bare NumberField while the form wrote to `.value` and
  // prepareDerivedData replaced the number with an object. Three shapes for
  // one field, and nothing said so until the schema started being typed.
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
      // Derived: rewritten by prepareDerivedData on every preparation, and
      // never meaningful as stored data. It is in the schema anyway because
      // this file is JavaScript, and JavaScript has no `declare` — a class
      // field would emit and set the property to undefined at construction.
      // A TypeScript system writes `declare mod: number` on the class and
      // leaves this out.
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
      value: new f.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 10,
      }),
      max: new f.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 10,
      }),
    }),
    power: new f.SchemaField({
      value: new f.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 5,
      }),
      max: new f.NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 5,
      }),
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

    const conMod = this.abilities.con.mod;
    this.health.max = 10 + this.level + conMod;

    this.armorClass = 10 + this.abilities.dex.mod;

    // INIT mirrors DEX modifier — matches the Figma reference (.qv +4 with DEX 18).
    this.initiative = this.abilities.dex.mod;
  }
}
