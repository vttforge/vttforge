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

You write the schema once. There is no second type declaration to keep in
sync, and `this.level` inside `prepareDerivedData` is a `number`.

It has to be a function: `fields()` reads a Foundry global that does not exist
when your module is first evaluated.

### Declare your derived values

`armorClass` is not in the schema, so it is not on the type. Declaring it
puts it on the type as a value that exists once `prepareDerivedData` has run.

In JavaScript there is no `declare`, and a plain class field would emit and
reset the property to `undefined` after every data preparation. Put derived
values in the schema instead, as a `NumberField` with `initial: 0`, and
assign them in `prepareDerivedData`. The scaffold's JavaScript template does
this for the ability modifiers.

## Resources and token bars

A resource is `{ value, max }`: hit points, power, ammunition, the shape a
token bar reads. `resourceField()` builds that `SchemaField` with both
children required, non-nullable numbers, so `system.health.value` is a
`number` everywhere:

```ts twoslash
import { fields, resourceField } from '@vttforge/core';

const defineCharacterSchema = () => {
  const f = fields();
  return {
    health: resourceField({ initial: 10 }),
    power: resourceField({ initial: 5, max: 5, label: 'MY_SYSTEM.Power' }),
    level: new f.NumberField({ required: true, nullable: false, initial: 1 }),
  };
};
```

| Option | Default | What it sets |
| --- | --- | --- |
| `initial` | `0` | starting `value` |
| `max` | `initial` | starting `max` |
| `min` | `0` | lowest allowed for both |
| `integer` | `true` | whole numbers only |
| `label`, `hint` | none | the SchemaField's own |

Point `primaryTokenAttribute` and `secondaryTokenAttribute` in the manifest at
the field key, `health` and `power` here, or a dotted path such as
`attributes.hp`. Foundry draws no bar for a path without both keys and says
nothing about it, so `registerSystem` checks the two manifest paths against
the Actor data models it registers and throws
[VTTF-0010](../errors/VTTF-0010) at `init` when no model has a resource
there. `vttforge audit` runs the same check on the source (rule 007) and reads
`resourceField()` as a resource.

## Nullability defaults

Every field class picks its own defaults, and they disagree.

| Field | With no options | Why |
|---|---|---|
| `NumberField` | `number \| null \| undefined` | optional and nullable by default |
| `StringField` | `string \| undefined` | optional |
| `BooleanField` | `boolean` | required, starts at `false` |
| `HTMLField` | `string` | required, blank-friendly |
| `ColorField` | `Color \| null` | starts at `null` |
| `FilePathField` | `string \| null` | starts at `null` |
| `ArrayField` / `SetField` | never absent | required, builds its own empty value |

So `new f.NumberField()` is not a `number`. Pass the options explicitly:

```ts
new f.NumberField({ required: true, nullable: false, initial: 0 })
```

The inference reads the literal types of what you pass. An options object
held in a variable widens `nullable: false` to `boolean`, and the field's own
default applies again. Pin it with `as const`, or build the field in a small
factory so the literals stay inline.

## Fields that are not what they look like

| Field | Holds |
|---|---|
| `ColorField` | a `Color` instance, not a string |
| `SetField` | a `Set`, not an array |
| `ForeignDocumentField` | the document; the model installs it as a getter |
| `EmbeddedDataField` | the model instance, with its derived data |
| `TypedSchemaField` | a union you can narrow on `type` |
