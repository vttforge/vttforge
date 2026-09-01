# Data models

## The schema types itself

```ts
import { BaseTypeDataModel, fields } from '@vttforge/core';

const defineCharacterSchema = () => {
  const f = fields();
  return {
    level: new f.NumberField({ required: true, nullable: false, initial: 1 }),
    health: new f.SchemaField({
      value: new f.NumberField({ required: true, nullable: false, initial: 10 }),
      max: new f.NumberField({ required: true, nullable: false, initial: 10 }),
    }),
  };
};

export class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {
  declare armorClass: number;

  prepareDerivedData() {
    this.armorClass = 10 + this.level; // this.level is number
  }
}

type CharacterSystem = CharacterData['$inferData'];
```

The schema is written once. There is no second type declaration to keep in
sync, and `this.level` inside `prepareDerivedData` is a `number` because the
schema said so.

It has to be a function, not an object: `fields()` reads a Foundry global that
does not exist when your module is first evaluated.

### Declare your derived values

`armorClass` is not in the schema, so it is not on the type. Declaring it is
how you say "this exists after `prepareDerivedData` runs", and it reads as
documentation of the derived surface rather than a workaround.

## Say what you mean about null

This is the part that surprises people, so it is worth being blunt about it.

**Every field class picks its own defaults, and they disagree.**

| Field | With no options | Why |
|---|---|---|
| `NumberField` | `number \| null \| undefined` | optional and nullable out of the box |
| `StringField` | `string \| undefined` | optional |
| `BooleanField` | `boolean` | required, starts at `false` |
| `HTMLField` | `string` | required, blank-friendly |
| `ColorField` | `Color \| null` | starts at `null` |
| `FilePathField` | `string \| null` | starts at `null` |
| `ArrayField` / `SetField` | never absent | required, builds its own empty value |

So `new f.NumberField()` is not a `number`. Declare what you meant:

```ts
new f.NumberField({ required: true, nullable: false, initial: 0 })
```

The inference reads the **literal** types of what you pass. An options object
held in a variable widens `nullable: false` to `boolean`, which says nothing,
and the field's own default applies again. Pin it with `as const`, or build the
field in a small factory so the literals stay inline.

## Fields that are not what they look like

| Field | Holds |
|---|---|
| `ColorField` | a `Color` instance, not a string |
| `SetField` | a `Set`, not an array |
| `ForeignDocumentField` | the document — the model installs it as a getter |
| `EmbeddedDataField` | the model instance, with its derived data |
| `TypedSchemaField` | a union you can narrow on `type` |
