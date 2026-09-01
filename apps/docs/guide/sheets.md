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
drag-drop wiring on render. The typed drop hooks — `onDropItem`, `onDropActor`,
`onDropFolder`, `onDropActiveEffect` — receive the resolved document, so you are
not parsing a UUID out of a payload. Return `undefined` to hand the drop back
to Foundry.

`BaseItemSheet` is the same without the drop dispatch.

### `override` is not optional

The base declares these members, so TypeScript requires the keyword. That is
deliberate: it means the compiler can tell you when you misspell a hook name,
which it could not do while these returned `any`.

## Everything else

A config dialog, a picker, a reader window — anything that is not a document
sheet — is a plain `ApplicationV2`:

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
unrenderable — Foundry reports it when something tries to open the window, as an
error about abstract methods, which points at Foundry rather than at your class.
`_replaceHTML` is provided; override it for a window that updates in place.

**A missing `_renderHTML` fails late** for the same reason. This checks at
construction and names the class.

### Actor sheets are not plain applications

If you are registering a sheet for an actor, it must extend `ActorSheetV2` —
`BaseActorSheet()` does. A plain `ApplicationV2` leaves `actor.sheet` as `null`
and reports nothing anywhere.
