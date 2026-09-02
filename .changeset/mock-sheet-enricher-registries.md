---
'@vttforge/testing': minor
---

`withMockFoundry` records sheets and enrichers.

Registering a sheet through `registerSystem({ sheets })` goes via `foundry.applications.apps.DocumentSheetConfig`, which the mock did not have — so a consumer's boot test got "Foundry is not available" rather than a result. Enrichers landed on `CONFIG.TextEditor.enrichers` with no way to read them back.

Both are now on the handle:

```ts
const foundry = withMockFoundry();
registerSystem({ id: 'my-system', sheets: [{ id: 'character', document: 'Actor', sheet: CharacterSheet }] });
foundry.callHook('init');

foundry.sheets.map((s) => s.key); // ['my-system.character']
```

`key` is the assertion worth writing. Foundry saves it on every document whose owner picked the sheet and builds it from the class name, which a bundler is free to rename between builds — so pinning the key is pinning that the reader's choice survives your next release.

`foundry.enrichers` reads back the namespaced id, pattern and `onRender`.
