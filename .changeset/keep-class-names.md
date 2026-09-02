---
'@vttforge/vite-plugin': minor
---

Keep class names through minification.

Foundry reads class names at runtime, and a minifier does not promise the same one twice. The clearest case is a registered sheet: Foundry keys it by `${package id}.${class name}` and saves that key on every document using it, so a rename between builds orphans the reader's choice. `registerSheets` fixes the name for that case.

Everything else stayed minified. A stack trace named `mo`. An `instanceof` error message named `t`. Someone debugging a sheet that renders nothing read a prototype chain of `go → r → HandlebarsApplication` and had to work out which of those was theirs.

Builds now pass `keepNames` to rolldown, so a class reports the name it was written with.

## Upgrading moves your sheet keys, once

This matters if you register sheets by hand — `Actors.registerSheet(id, MySheet, …)` rather than the `sheets` option on `registerSystem` / `registerModule`.

Foundry derives the key from the class name, so this release changes it: a sheet that registered as `my-system.e` under 0.3.x registers as `my-system.CharacterSheet` under 0.4.0. Every `flags.core.sheetClass` already saved against the old key names a sheet that no longer exists, and Foundry falls back to the default without saying anything.

That is the same failure the explicit sheet id exists to prevent, so **migrate before you upgrade**:

```ts
registerSystem({
  id: 'my-system',
  sheets: [{ id: 'character', document: 'Actor', sheet: CharacterSheet, types: ['character'], makeDefault: true }],
});
```

With an explicit `id`, the key is written down rather than derived, and neither this release nor any later rename moves it. Ship that first, then take the plugin bump — otherwise the key jumps from one derived value to another and your readers lose their sheet in between.

This complements the explicit sheet id rather than replacing it: a rename in your own source would still move a key that was inferred from a class name.
