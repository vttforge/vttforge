# Sheets

## Document sheets

```ts
import { BaseActorSheet } from '@vttforge/core';

export class CharacterSheet extends BaseActorSheet() {
  static PARTS = { sheet: { template: 'systems/my-system/templates/character.hbs' } };

  static TABS = {
    primary: {
      tabs: [{ id: 'abilities', group: 'primary', label: 'MY.Abilities' }],
      initial: 'abilities',
    },
  };

  static DRAG_DROP = [{ dragSelector: '.item[draggable=true]', dropSelector: '.body' }];

  override async onDropItem(item, event) {
    if (item.type !== 'gear') {
      ui.notifications?.warn('Only gear goes here.');
      return false;
    }
  }
}
```

`static TABS` fills in `context.tabs` for you, and `static DRAG_DROP` binds the
drag-drop wiring on render. The typed drop hooks (`onDropItem`, `onDropActor`,
`onDropFolder`, `onDropActiveEffect`) receive the resolved document, so you are
not parsing a UUID out of a payload. Return `undefined` to hand the drop back
to Foundry.

`BaseItemSheet` is the same without the drop dispatch.

### A sheet that is not a template

`BaseActorSheet` and `BaseItemSheet` mix in Handlebars, which is right when the
sheet is `static PARTS` and templates. It is wrong when the content is a canvas,
an embedded PDF, or a Svelte or Lit mount. Those build an element and hand it
over.

Using the Handlebars baseline for one of those does not fail loudly. The mixin
expects a map of part id to markup, gets an element, and renders nothing: the
window opens empty and no error names the mismatch. `BaseDocumentSheet` is the
same document-sheet plumbing without the mixin.

```ts
import { BaseDocumentSheet } from '@vttforge/core';

export class PdfActorSheet extends BaseDocumentSheet('Actor') {
  async _renderHTML() {
    const container = document.createElement('div');
    // …draw the page…
    return container;
  }
}
```

It takes `'Actor'` or `'Item'`, and gives you the same `_renderHTML` /
`_replaceHTML` contract as `BaseApplication`.

### `this.document` is `unknown`

The base does not know which document a sheet is for; that is yours to say.
Narrow it once, in a getter, and read the typed value everywhere else:

```ts
interface CharacterActor {
  readonly name: string;
  readonly system: CharacterData;
  readonly items: { get(id: string): GearItem | undefined };
}

export class CharacterSheet extends BaseActorSheet() {
  get actor(): CharacterActor {
    return this.document as CharacterActor;
  }

  override async _prepareContext(options: unknown) {
    const context = await super._prepareContext(options);
    context.system = this.actor.system; // typed from the schema
    return context;
  }
}
```

The interface names what the sheet reads. Grow it as the sheet grows; it is
the one place to change when a real Foundry type package lands.

### `override` is not optional

The base declares these members, so TypeScript requires the keyword. That is
deliberate: it means the compiler can tell you when you misspell a hook name,
which it could not do while these returned `any`.

## Everything else

A config dialog, a picker, a reader window, anything that is not a document
sheet, is a plain `ApplicationV2`:

```ts
import { BaseApplication } from '@vttforge/core';

export class PdfConfig extends BaseApplication() {
  async _renderHTML() {
    const form = document.createElement('form');
    // …
    return form;
  }
}
```

`BaseApplication` exists because raw `ApplicationV2` has two traps.

**It splits rendering in two.** `_renderHTML` builds the content, `_replaceHTML`
puts it in the window. Implement only the first and the class is silently
unrenderable. Foundry reports it when something tries to open the window, as an
error about abstract methods, which points at Foundry rather than at your class.
`_replaceHTML` is provided; override it for a window that updates in place.

**A missing `_renderHTML` fails late** for the same reason. This checks at
construction and names the class.

### Actor sheets are not plain applications

If you are registering a sheet for an actor, it must extend `ActorSheetV2`, and
`BaseActorSheet()` does. A plain `ApplicationV2` leaves `actor.sheet` as `null`
and reports nothing anywhere.

## Registering a sheet

Register through `registerSystem` or `registerModule`, and give each sheet an
`id`:

```ts
registerModule({
  id: MODULE_ID,
  itemDataModels: { pdf: PdfData },
  sheets: [
    { id: 'fillable', document: 'Actor', sheet: FillablePdfSheet, label: 'MY.Fillable' },
    { id: 'pdf', document: 'Item', sheet: PdfSheet, types: [PDF_TYPE], makeDefault: true },
  ],
});
```

### Why the id is not optional

Foundry keys a sheet by `${package id}.${class name}` and writes that key onto
every document whose owner picked the sheet. The key is saved data derived from
a JavaScript class name.

That is fine unbundled and broken once you ship a build. A minifier renames
classes and does not promise the same name twice, so the same sheet registers as
`mo` in one release and `vo` in the next. Every saved choice then names a sheet
that no longer exists, Foundry falls back to the default, and the reader's sheet
is gone with nothing in the console.

Passing an `id` fixes the class name to it before registering, so the key is
written down instead of inferred. Pick it once and keep it: renaming the `id`
later loses the sheet choice on every document already using it, the same way
renaming a database column would.
