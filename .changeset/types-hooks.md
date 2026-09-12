---
"@vttforge/types": minor
"@vttforge/core": minor
---

Type the hooks by name.

```ts
Hooks.on("createActor", (actor, options, userId) => {
  actor.name;        // string
  options.render;    // boolean | undefined
  userId;            // string
});
```

No annotation on any parameter. The name supplies them.

**What breaks.** `HooksApi` used to take a type argument for the listener's
arguments (`Hooks.on<[Actor]>(...)`). It no longer does: the name decides. Drop
the type argument and the callback infers.

`HookMap` holds every hook name Foundry ships. Three families are generated
rather than listed, because Foundry builds their names:

- `create<Document>`, `update<Document>`, `delete<Document>` and the `pre`
  forms, for all 30 document types. A `pre` hook may return `false` to cancel.
- `get<Document>ContextOptions` and `get<Document>PlaceableContextOptions`.
- `render<Class>`, `preRender<Class>` and `close<Class>`, which fall to the
  application shape, since a package names those after its own classes.

A name nobody declared stays open, so `Hooks.callAll("my-module.thing", ...)`
still compiles.

`DocumentTypeMap` is the lookup from a document name to its type, exported so a
package can reuse it.
