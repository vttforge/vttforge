# Modules

A module contributing its own Actor or Item subtype is the supported extension
point, and it has three parts that must agree.

## 1. Declare it in the manifest

```jsonc
// module.json
{
  "id": "my-module",
  "documentTypes": {
    "Item": { "pdf": { "htmlFields": ["description"] } }
  }
}
```

## 2. Register it under the prefixed key

Foundry files a module's subtype under `<module-id>.<type>`, not `<type>`. A
system owns bare keys; a module does not.

```ts
import { moduleSubType, registerModule } from '@vttforge/core';

const MODULE_ID = 'my-module';
export const PDF_TYPE = moduleSubType(MODULE_ID, 'pdf'); // 'my-module.pdf'

registerModule({
  id: MODULE_ID,
  itemDataModels: { pdf: PdfData }, // prefixed for you
});
```

`registerModule` is not `registerSystem` with a different name. A module must
not set `CONFIG.Actor.documentClass`, the initiative formula, or replace
`CONFIG.statusEffects` — those belong to whatever system is running, and a
module that touches them breaks every world it is installed in.

## 3. Register the sheet for the prefixed type

```ts
registerModule({
  id: MODULE_ID,
  itemDataModels: { pdf: PdfData },
  sheets: [{ id: 'pdf', document: 'Item', sheet: PdfSheet, types: [PDF_TYPE], makeDefault: true }],
});
```

Register here rather than calling Foundry's `registerSheet` yourself. Foundry
derives the key it saves on each document from the sheet's class name, and a
bundler renames classes between builds — see
[Sheets](./sheets#why-the-id-is-not-optional).

## Keep the type key in its own module

The subtype key gets used by the sheet, the API, the enricher — anything that
looks documents up. Put it somewhere neither of those has to import the entry
point for:

```ts
// constants.ts
export const MODULE_ID = 'my-module';
export const PDF_TYPE = moduleSubType(MODULE_ID, 'pdf');
```

Importing it from your entry point closes a cycle that works right up until
something reads the key while the modules are still evaluating.
