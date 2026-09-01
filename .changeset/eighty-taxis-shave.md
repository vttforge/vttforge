---
'@vttforge/core': minor
---

Add `registerModule()` for modules that contribute document sub-types.

Foundry files a module's sub-type under `<module-id>.<type>`. Register the bare name and there is no error — the type just never appears. `registerModule()` adds the prefix, and `moduleSubType(id, type)` gives you the same string wherever else you need it (registering the sheet, checking `actor.type`, writing `documentTypes` in the manifest).

```ts
registerModule({
  id: 'pdf-character-sheet',
  itemDataModels: { pdf: PdfItemData }, // → CONFIG.Item.dataModels['pdf-character-sheet.pdf']
});
```

`registerSystem()` was the only option before, and it is the wrong shape for a module: it writes bare keys and also replaces the document classes, the initiative formula, and the status-effect array — all of which belong to the system. There is no option to replace them here, and `statusEffects` appends instead of assigning.
