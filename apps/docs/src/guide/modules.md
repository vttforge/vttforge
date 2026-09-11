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

## The module api

`game.modules.get(id).api` is where a module publishes what other modules and
macros may call. Hand it to `registerModule` and it is written during `init`,
before any CONFIG mutation:

```js
registerModule({
  id: 'my-module',
  api: {
    createNote: (name) => Item.implementation.create({ name, type: NOTE_TYPE }),
  },
});
```

It is written at the top of `init`, before your own `onBeforeInit` and before
any CONFIG mutation. The hook is the part people get wrong: publish it later
and anything that looked during its own `init` found nothing, with no way to
tell why.

### Reading someone else's

```js
import { moduleApi, requireModuleApi, isModuleActive } from '@vttforge/core';

const optional = moduleApi('other-module');       // undefined when unavailable
const required = requireModuleApi('other-module'); // throws, and says which
```

`game.modules.get(id)?.api` collapses four situations into `undefined`: no
such module, installed but switched off, on but publishing nothing, or on and
publishing an older shape than you need. A module that guesses wrong tells its
user to install something they already have. `requireModuleApi` throws
[VTTF-0014](../errors/VTTF-0014) naming which of the three it was.

Read from `onSetup` or later, never from `init`. Nothing orders one package's
`init` against another's, so a read during `init` finds an api that is not
published yet and cannot tell that apart from a module that publishes none.
`onSetup` is the first point where every package has finished its `init`.

The type argument is your claim about the shape. Nothing checks it: the other
module's types are not yours to import. Write down what you use and treat the
result the way you would any other value crossing a boundary.
