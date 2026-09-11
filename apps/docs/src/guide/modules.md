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

Foundry files a module's subtype under `<module-id>.<type>`. Bare keys belong
to the system.

```ts
import { moduleSubType, registerModule } from '@vttforge/core';

const MODULE_ID = 'my-module';
export const PDF_TYPE = moduleSubType(MODULE_ID, 'pdf'); // 'my-module.pdf'

registerModule({
  id: MODULE_ID,
  itemDataModels: { pdf: PdfData }, // prefixed for you
});
```

A module must not set `CONFIG.Actor.documentClass` or the initiative formula,
and must not assign `CONFIG.statusEffects`. Those belong to the running
system, and a module that touches them breaks every world it is installed in.
A module may add a condition of its own, and `statusEffects` does that by id,
prefixed so it cannot collide with the system's.

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
bundler renames classes between builds; see
[Sheets](./sheets#why-the-id-is-not-optional).

## Keep the type key in its own module

The sheet, the API, the enricher, anything that looks documents up: they all
use the subtype key. Put it somewhere none of them has to import the entry
point for:

```ts
// constants.ts
export const MODULE_ID = 'my-module';
export const PDF_TYPE = moduleSubType(MODULE_ID, 'pdf');
```

Importing it from your entry point closes a cycle that works right up until
something reads the key while the modules are still evaluating.

## Text enrichers

An enricher turns a pattern in any rich text field (chat, journals, item
descriptions) into markup:

```ts
registerModule({
  id: MODULE_ID,
  enrichers: [
    {
      id: 'link',
      pattern: /@PDF\[(.+?)\]\{(.+?)\}/g,
      enricher: async (match) => {
        const anchor = document.createElement('a');
        anchor.textContent = match[2] ?? '';
        return anchor;
      },
      onRender: (element) => {
        // Bind listeners here. It runs every time enriched content lands in
        // the DOM.
      },
    },
  ],
});
```

`CONFIG.TextEditor.enrichers` is a plain array, so you could push to it
yourself. Register here instead: that array has four ways to take an entry and
then do nothing with it, none of them reported.

`onRender` without an `id` never fires. Foundry wraps enriched output in a
custom element only when both are present, and only the wrapper fires the
callback. The text still enriches, so the markup looks right and only the
behaviour is missing. Registering through VTTForge always supplies an id.

A duplicate `id` silently loses. The wrapper stores the id as an attribute and
finds the enricher back with `find`, and the first match wins. Two packages
both using `link` means the first one's `onRender` runs against the second
one's markup, and it only reproduces in a world with both installed. Ids are
namespaced to your package, and a repeat within your own package is refused.

A pattern without the `g` flag throws. Enrichment matches with `matchAll`,
which rejects a non-global regex, and that throw is outside the handler Foundry
wraps enrichers in. VTTForge checks the flag when you register.

`registerSystem` takes the same option.

## Before the module goes away

A module's sub-types travel with the module. Switch it off and every document
using one is marked invalid: visible in the world, not editable, holding data
nothing can read. Uninstall it and they are stranded for good.

So ship a way out. Two calls:

```js
import { subTypeDocuments, convertSubTypes } from '@vttforge/core';

// What a user would lose by removing this module.
const count = subTypeDocuments({ id: 'my-module', document: 'Item', type: 'note' }).length;

// Turn each one into a plain Item and lose nothing.
const { converted, failed } = await convertSubTypes({
  id: 'my-module',
  document: 'Item',
  type: 'note',
});
```

Put it behind a settings button or a macro, and run it as a Gamemaster: these
are world documents.

`to` defaults to `base`, which every document class has and no package owns,
so it survives anything else being uninstalled too. `system` decides what the
converted document keeps, and defaults to what it already had. A core type
stores that as a plain object, so the data is still there even where nothing
reads it. `changes` sets anything else in the same update, such as a name.

The conversion is one update per document, in place. The id survives, and so
do the flags, the folder, the ownership and the embedded documents. Nothing is
deleted and recreated.

### Why not do it by hand

`document.update({ type: 'base' })` is refused. Foundry answers that a type
may only change when `system` is replaced with a `ForcedReplacement` operator,
and it drops the whole update, so a call that also renamed the document loses
the rename as well.

Creating a replacement with `keepId` while the original is still there
overwrites it. No error, no second document, and no way back if the new data
was wrong.
