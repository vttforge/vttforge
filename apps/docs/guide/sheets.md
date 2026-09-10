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
`onDropFolder`, `onDropActiveEffect`) receive the resolved document. Return
`undefined` to hand the drop back to Foundry.

`BaseItemSheet` is the same without the drop dispatch.

### A sheet that is not a template

`BaseActorSheet` and `BaseItemSheet` mix in Handlebars, which suits a sheet
built from `static PARTS` and templates. Content that is a canvas, an embedded
PDF, or a Svelte or Lit mount builds an element and hands it over.

The mixin expects a map of part id to markup; given an element it renders
nothing, so the window opens empty and no error names the mismatch.
`BaseDocumentSheet` is the same document-sheet plumbing without the mixin.

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

The interface names what the sheet reads, and it is the one place to change
when a real Foundry type package lands.

### `override` is not optional

The base declares these members, so TypeScript requires the keyword and the
compiler catches a misspelled hook name.

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

Raw `ApplicationV2` splits rendering in two: `_renderHTML` builds the content
and `_replaceHTML` puts it in the window. Implement only the first and the
class is silently unrenderable. Foundry reports it when something tries to open
the window, as an error about abstract methods that points at Foundry rather
than at your class. `BaseApplication` provides `_replaceHTML`; override it for
a window that updates in place. A missing `_renderHTML` fails just as late, so
`BaseApplication` checks for it at construction and names the class.

### Actor sheets need `ActorSheetV2`

If you are registering a sheet for an actor, it must extend `ActorSheetV2`, and
`BaseActorSheet()` does. A plain `ApplicationV2` leaves `actor.sheet` as `null`
and reports nothing anywhere.

## Play and edit modes

A sheet in play is read: the numbers, the buttons that roll, the tabs. A
sheet in edit is written. Opt in on any sheet built on `BaseActorSheet()`,
`BaseItemSheet()` or `BaseDocumentSheet()`:

```ts
class CharacterSheet extends BaseActorSheet() {
  static MODES = {
    initial: 'play',
    labels: { play: 'MY_SYSTEM.Mode.play', edit: 'MY_SYSTEM.Mode.edit' },
  };
}
```

What that gives, and nothing of it happens without the opt-in:

- A header control that reads "Edit mode" in play and "Play mode" in edit,
  shown to users who can edit the document. Its action is `vttforgeToggleMode`.
- `sheet.mode`, `sheet.isEditMode`, `sheet.isPlayMode` and
  `sheet.toggleMode(mode?)`, which re-renders.
- `context.mode`, `context.isEditMode` and `context.isPlayMode` for the
  templates.
- The class `vttforge-mode-play` or `vttforge-mode-edit` on the sheet element
  after every render, for the CSS.
- In play, every form field inside the window content is `disabled`: inputs,
  selects, textareas and Foundry's own elements such as `<prose-mirror>`. A
  `<button>` is an action, not a field, so rolls keep working. A field that
  must stay open in play, hit points say, sits inside an element with
  `data-vttforge-edit-in-play`.

The mode lives on the sheet instance. It resets when the window is closed
and opened again, and it is never written to a setting.

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

That holds unbundled. Once you ship a build, a minifier renames classes and
does not promise the same name twice, so the same sheet registers as `mo` in
one release and `vo` in the next. Every saved choice then names a sheet that no
longer exists, Foundry falls back to the default, and the reader's sheet is
gone with nothing in the console.

Passing an `id` fixes the class name to it before registering, so the key is
written down instead of inferred. Renaming the `id` later loses the sheet
choice on every document already using it.
