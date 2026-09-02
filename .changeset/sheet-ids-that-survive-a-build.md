---
'@vttforge/core': minor
---

Register sheets through `registerSystem` / `registerModule`, under an id that survives a rebuild.

Foundry keys a registered sheet by `${package id}.${class name}` and writes that key onto every document whose owner picked the sheet. The key is saved data derived from a JavaScript class name.

That works unbundled and breaks once you ship a build. A minifier renames classes and does not promise the same name twice, so one sheet registered as `mo` in one build and `vo` in the next. Every saved choice then named a sheet that no longer existed: Foundry fell back to the default and said nothing. It hits released upgrades, not just a dev loop — a reader picks the sheet in 1.0, you ship 1.1, the choice is gone.

Both registration functions now take `sheets`, and each entry carries an `id`. VTTForge fixes the class name to that id before registering, so the key is written down instead of inferred.

```ts
registerModule({
  id: 'my-module',
  sheets: [{ id: 'fillable', document: 'Actor', sheet: FillablePdfSheet }],
});
```

Because the key is persisted, the way it is derived is now a compatibility promise. Pick an `id` once and keep it — renaming it loses the sheet choice on every document already using it.

New error VTTF-0006 for an id that is empty, contains a dot, or repeats another sheet in the same package.
