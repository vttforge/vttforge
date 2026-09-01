---
'@vttforge/core': minor
---

Let `BaseTypeDataModel` learn your schema.

Hand it the function that returns your fields and it implements `static defineSchema()` for you. The schema is written once, and `this` inside `prepareDerivedData()` knows its own fields:

```ts
class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {
  declare armorClass: number;
  prepareDerivedData() {
    this.armorClass = 10 + this.level; // this.level is number
  }
}

type CharacterSystem = CharacterData['$inferData'];
```

Derived values are not in the schema, so declare them on the subclass.

Calling `BaseTypeDataModel()` with no arguments works exactly as before.
