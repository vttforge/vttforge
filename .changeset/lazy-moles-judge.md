---
'@vttforge/testing': minor
---

`withMockFoundry` takes a `globals` option for anything outside the fixed set it installs.

Foundry puts every document class on the global scope, and code under test reaches for them by name. `JournalEntry.create`, `Actor.create`, `ChatMessage.getSpeaker`. None of those were covered, so testing code that touched one meant saving and restoring the global by hand in every file.

```ts
const foundry = withMockFoundry({
  globals: { JournalEntry: { create: vi.fn() } },
});
```

`restore()` clears them along with the rest, putting back whatever was there before, including nothing. Naming one of the built-ins overrides it rather than being overwritten by it.
