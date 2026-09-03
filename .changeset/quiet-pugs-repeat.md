---
'@vttforge/cli': minor
---

Stop scaffolding `template.json`, and add an audit rule for the damage it does.

Foundry reads `template.json` on load and, for every type it lists, replaces that type's entry in `documentTypes` with a fresh object. Into the new object it copies only `htmlFields`, `filePathFields` and `gmOnlyFields`, and it reads them from the document level of `template.json` rather than from the type. So a system that declares this:

```json
"documentTypes": { "Actor": { "character": { "htmlFields": ["biography"] } } }
```

loses it the moment `template.json` lists `character` under `Actor`. The scaffolds did both, so every system created from them shipped with its `htmlFields` quietly discarded, taking HTML sanitization, ProseMirror enrichment, asset path migration and search indexing with it. Nothing errors, and the field goes on saving and loading, so the loss shows up much later as a stripped value or a path that never migrated.

The types are declared in `system.json` under `documentTypes` and the shape comes from the `TypeDataModel`, so nothing needed the second file. New scaffolds do not ship one.

`vttforge audit` reports the collision as `VTTF-AUDIT-010` (HIGH), naming the keys that get dropped. Run it on an existing project:

```bash
npx vttforge audit
```

If you have a `template.json` and no type in it declares one of those three keys in `documentTypes`, nothing changes for you.
