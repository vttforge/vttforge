---
'@vttforge/core': minor
---

Give each field its own defaults when inferring a schema.

Every field class picks its own defaults, and they disagree. The inference treated them as if they agreed, so three fields were typed as shapes they cannot hold:

- `NumberField` is optional and nullable out of the box. `new fields.NumberField()` is `number | null | undefined`, not `number`.
- `StringField` is optional. A bare one is `string | undefined`.
- `FilePathField` starts at `null`, the way `ColorField` does. A bare one is `string | null`.

The rest were already right, for reasons worth naming: booleans and HTML fields are required and supply their own initial; arrays, sets and schemas are required and build their own empty value; document references are required but nullable.

This will surface errors in schemas that leave the options off. The fix is to declare what you meant — `{ required: true, nullable: false, initial: 0 }` — which is what the field needed all along.
