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

## Adding UI to someone else's application

Most of what a module does is put something of its own inside an application
it does not own. There is no API for that: you bind the render hook, find a
node, and insert.

```js
import { inject } from '@vttforge/core';

const off = inject({
  id: 'my-module',
  name: 'generator',
  hook: 'renderActorDirectory',
  into: '.directory-header',
  position: 'after',
  when: () => game.user.isGM,
  render: () => {
    const button = document.createElement('button');
    button.textContent = 'Generate';
    button.addEventListener('click', () => generate());
    return button;
  },
});
```

Foundry re-renders an application whenever its document changes, so that code
runs again and again. The insert repeats, and every module solves it by hand.
`inject` marks what it inserted with `data-vttforge-injection="<id>.<name>"`
and removes the previous one first, so ten renders leave one node. Two
packages using the same `name` do not collide, because the marker carries the
package id.

`render` returning `null` inserts nothing and still clears what the last
render left, which is how a feature turns itself off.

`before`, `after` and `replace` need `into`. Without it the anchor is the
application's own element, so the node would land outside the window, where
the next render cannot find it again and inserts a second one. `replace` there
would take the whole application away. VTTForge refuses the combination with
VTTF-0016 rather than letting it run.

The returned function unbinds the hook. Call it when the feature is switched
off; leaving it bound means the injection comes back on the next render.

| Option | What it does |
| --- | --- |
| `hook` | The render hook. Render hooks fire once per class in the chain, so a base class name catches every sheet and an exact class name catches one |
| `into` | Selector for the node to insert around, searched inside the rendered element. Left out, the rendered element itself |
| `position` | `append` (default), `prepend`, `before`, `after` or `replace`. The last three need `into` |
| `when` | Skip the injection. The previous one is still cleared |

Most render hooks hand over an `HTMLElement`. The deprecated
`renderChatMessage` hands over jQuery, and `inject` takes the node out of
either, so the same code works on both.

### What this is not

It does not patch anything. Adding to an application that offers no seam at
all means wrapping a method somebody else wrote, which is a different problem
with a different answer:

```js
// Requires libWrapper, declared under relationships.recommends.
Hooks.once('setup', () => {
  if (!game.modules.get('lib-wrapper')?.active) return;
  libWrapper.register('my-module', 'ChatLog.prototype._getEntryContextOptions', function (wrapped, ...args) {
    const options = wrapped(...args);
    options.push({ name: 'MY_MODULE.copy', icon: '<i class="fa-solid fa-copy"></i>', callback: copy });
    return options;
  }, 'WRAPPER');
});
```

Use `WRAPPER` and call `wrapped`, so other modules patching the same method
still run. A wrapper that throws breaks the application for the whole world,
not just your feature, so guard for the library being absent and keep the body
short. VTTForge does not wrap this: a shim that hides whether libWrapper is
installed would decide for you what happens when it is not.
