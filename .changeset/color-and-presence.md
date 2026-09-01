---
'@vttforge/core': minor
---

Fix two things `InferSchema` got wrong about a field's runtime type.

`ColorField` inferred as `string`. It stores a CSS string but initializes
into a `Color` instance, so `system.tint` is an object with `.css`, `.rgb`
and friends — and the old typing made every property access on it a lie the
compiler accepted. It is also nullable by default, unlike the other
string-backed fields: the field's own defaults are `nullable: true,
initial: null`, so reading `.css` off a fresh document was a real crash the
types allowed. It now infers as `Color | null`, and drops the null when
`nullable: false` is set.

Presence was half-implemented. Only `nullable: true` widened the type;
`required: false` did not. A field that resolves to `undefined` when absent
was typed as always present. The rule now follows how a field actually
resolves a missing value: an explicit `initial` always fills, so it never
widens; otherwise `required: false` admits `undefined` and `nullable: true`
admits `null`, and the two compose.

`Color` is described structurally rather than imported, so the inference
surface still carries no dependency on a Foundry type package.
