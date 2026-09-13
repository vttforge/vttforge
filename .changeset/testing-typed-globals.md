---
'@vttforge/testing': minor
---

The globals this package declares are typed. They were `any`, and that broke
every scaffolded project that added the test helpers.

Two `declare global` blocks naming one global have to agree on two things. This
block got the first right and the second wrong. `var` rather than `const`, yes.
The same type, no: this said `any` and the scaffolded templates say `Game`,
`FoundryConfig` and the rest. `any` is not a free pass, and `tsc` stopped with
six errors at once:

```
error TS2403: Subsequent variable declarations must have the same type.
  Variable 'game' must be of type 'any', but here has type 'Game'.
```

That fired the moment a reader added these helpers to a project scaffolded by
`vttforge init`, which is the moment they most want them.

Both sides now name the types `@vttforge/types` describes: `Game`,
`FoundryConfig`, `FoundryConstants`, `HooksApi`, `UiApi` and the new
`FoundryNamespace`.

**Breaking:** a test that reads a member outside those types no longer
compiles. `any` allowed anything. The two that turned up in this package's own
tests are the kind you will see: `game.user` is `UserLike | null`, so reading
`game.user.isGM` needs `game.user?.isGM`, and `scope` is required on a setting
passed to `game.settings.register`. Narrow with a cast where the mock holds
something the types do not describe.
