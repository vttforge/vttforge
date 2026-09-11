# Adopting the SDK in an existing system

You have a system that runs on v12, v13 or v14, with sheets on
Application v1 and types in `template.json`. This is how to move it onto the SDK, in the
order that worked on a real one: a small system with two actor types, two
item types, jQuery sheets and a `template.json`. The whole run took an
afternoon. The CLI does most of the typing; the hand edits are listed at
each step, and they are few.

What you keep: your Actor and Item classes, your rules, macros, packs,
CSS and templates. What changes: the types become data models, the sheets
become ApplicationV2, one `registerSystem` call replaces the `init` hook,
and a build writes `dist/`.

Work on a branch. Every step below is a commit you can read.

## Before you start

You need Node 26 or later, a package manager, and a Foundry v14 to test
on. Run the audit first and read the report:

```bash
npx @vttforge/cli@latest audit
```

Every finding names a file and a line. Most of them go away in the next
two steps.

The oldest code the commands read is v12. A v13 system goes straight
through the steps below. A v12 system goes through
[Migrating from v12](/recipes/migrating-from-v12) first, for the breaks
between v12 and v13 that no command rewrites. Anything older needs the
`data.data` to `system` rename by hand before any of this helps, since
every rewrite below looks for `system`.

## 1. v14 first

```bash
npx @vttforge/cli@latest migrate
npx @vttforge/cli@latest migrate --write
```

The first run prints every edit it would make; the second makes them:
bare `mergeObject` to `foundry.utils.mergeObject`, the v13 aliases to
their namespaced paths, `rollMode` to `messageMode`, the manifest `type`
and `compatibility`, the `-=` deletion keys. What it will not decide it
lists as "needs a decision". On the system this was written against, two
were left:

- `gridDistance` and `gridUnits` at the manifest root became a `grid`
  object.
- A `renderChatMessage` hook became `renderChatMessageHTML`, with `html`
  an element, so `html.find(x).addClass(y)` became a loop over
  `html.querySelectorAll(x)` and `classList.add(y)`.

Run `audit` again. What remains is the Application v1 classes and the
`template.json`.

## 2. Types become data models

```bash
npx @vttforge/cli@latest migrate --data-models --style sdk --write
```

This reads `template.json` and writes one class per type under
`scripts/data/`, plus a `templates.mjs` per document with one function per
shared template, which the types that listed it spread. Each field is
typed from its default: a number is a `NumberField`, a string an
`HTMLField` when the key reads like rich text, an object a `SchemaField`.
The report ends with the `documentTypes` block for the manifest and the
imports for the registration.

Hand edits:

- **Derived numbers move onto the model.** A v1 system computes them in
  `Actor#prepareDerivedData`. On the model the same code runs with `this`
  as the system data and `this.parent` as the actor:

  ```js
  export class CharacterData extends BaseTypeDataModel(defineCharacterDataSchema) {
    prepareDerivedData() {
      const actor = this.parent;
      this.hp.max = 10 + this.level * 2 + Math.floor((this.abilities.str - 10) / 2);
      this.encumbrance = actor.items.reduce((sum, i) => sum + i.system.weight * i.system.quantity, 0);
    }
  }
  ```

  The Actor class keeps `getRollData` and whatever else is not a derived
  value.

- **Declare the types in the manifest.** Paste the `documentTypes` block
  and add `htmlFields` for every `HTMLField`:

  ```json
  "documentTypes": {
    "Actor": { "character": { "htmlFields": ["biography"] }, "npc": { "htmlFields": ["biography"] } },
    "Item": { "gear": { "htmlFields": ["description"] }, "spell": { "htmlFields": ["description"] } }
  }
  ```

- **Delete `template.json`.** While it exists Foundry resets the
  `documentTypes` entry of every type it lists on each start, so the
  manifest block does nothing until the file is gone. Stored actors keep
  their data: the model declares the same paths the template did.

## 3. Sheets become ApplicationV2

```bash
npx @vttforge/cli@latest migrate --sheets --write
```

For each `ActorSheet` or `ItemSheet` this writes a file with `.v2` before
the extension: `defaultOptions` as `DEFAULT_OPTIONS`, the `tabs` entry as
`TABS` with the ids read from the template, `dragDrop` as `DRAG_DROP`,
`getData` as `_prepareContext`, every `html.find(sel).click(handler)` as
an `actions` entry with the handler on `(event, target)`, the other
events as listeners in `_onRender`, `Dialog.confirm` and `new Dialog` as
`DialogV2`, `_onDropItem` as `onDropItem`. It also edits the templates:
`data-action` on the elements the selectors matched, and the tab links
and panes marked for the SDK's tab action.

Hand edits, each marked `TODO(migrate)` in the file:

- **One template per type.** A v1 `get template()` that picks a file by
  type has no static equivalent. Name the first one in `PARTS` and pick
  the real one when the parts are configured:

  ```js
  static PARTS = { sheet: { template: 'systems/my-system/templates/actor/character-sheet.html' } };

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    parts.sheet = { ...parts.sheet, template: `systems/my-system/templates/actor/${this.document.type}-sheet.html` };
    return parts;
  }
  ```

  Then delete the `get template()` the codemod carried over.

- **Drops.** The base resolves the dropped document before calling you,
  so `onDropItem(droppedItem, event)` receives an Item, not a payload.
  Read `droppedItem.type` where the old code called `fromDropData`, and
  return `true` when you handled the drop:

  ```js
  async onDropItem(droppedItem, event) {
    if (!this.actor.isOwner) return false;
    if (droppedItem.type === 'spell' && this.actor.type === 'npc') {
      ui.notifications.warn('NPCs cannot learn spells');
      return true;
    }
    await this.document.createEmbeddedDocuments('Item', [droppedItem.toObject()]);
    return true;
  }
  ```

- **The root `<form>`.** The SDK sheet already is a form, so a template
  that opens with one nests a form inside it and every edit is lost when
  the window closes. Make the root a `<div>`. Do not delete it: a part
  has to render one element, and a template that leaves `<header>`,
  `<nav>` and `<section>` at the top level fails to render.

When the `.v2` file reads right, delete the old class and drop the `.v2`
from the name.

## 4. One registration

The `init` hook becomes a `registerSystem` call. Data models, document
classes, initiative and sheets go in as options; what has no option goes
in `onBeforeInit` or `onAfterInit`, which run inside `init` around the
registrations:

```js
import { registerSystem } from '@vttforge/core';
import { MySystemActor } from './actor.mjs';
import { MyActorSheet } from './actor-sheet.mjs';
import { MyItemSheet } from './item-sheet.mjs';
import { CharacterData } from './data/actor/character-data.mjs';
import { NpcData } from './data/actor/npc-data.mjs';
import { GearData } from './data/item/gear-data.mjs';
import { SpellData } from './data/item/spell-data.mjs';

registerSystem({
  id: 'my-system',
  actorDataModels: { character: CharacterData, npc: NpcData },
  itemDataModels: { gear: GearData, spell: SpellData },
  actorDocumentClass: MySystemActor,
  combat: { initiative: { formula: '1d20 + @abilities.dex', decimals: 0 } },
  sheets: [
    { id: 'actor', document: 'Actor', sheet: MyActorSheet, makeDefault: true },
    { id: 'item', document: 'Item', sheet: MyItemSheet, makeDefault: true },
  ],
  onBeforeInit: () => {
    game.mySystem = { MySystemActor };
  },
  onAfterInit: () => {
    game.settings.register('my-system', 'hardMode', { scope: 'world', config: true, type: Boolean, default: false });
    foundry.applications.handlebars.loadTemplates(['systems/my-system/templates/actor/parts/items.html']);
  },
});
```

The sheet `id` is the half of the key Foundry stores on every document
whose owner picked the sheet. It is written down here so a bundler that
renames the class cannot move it. Pick it once. The `unregisterSheet`
calls a v1 system made for the core sheets are gone: core registers no
default Actor or Item sheet on v14, and `migrate` already removed them.

## 5. A build

Three files and one install:

```json
{
  "name": "my-system",
  "private": true,
  "type": "module",
  "scripts": { "build": "vttforge build", "dev": "vttforge dev", "audit": "vttforge audit" },
  "dependencies": { "@vttforge/core": "^0.15.0" },
  "devDependencies": { "@vttforge/cli": "^0.15.0", "@vttforge/vite-plugin": "^0.5.0", "vite": "^8.0.0" }
}
```

```js
// vite.config.mjs
import vttforge from '@vttforge/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [vttforge({ id: 'my-system' })] });
```

Add `node_modules`, `dist` and `*.zip` to `.gitignore`. The entry is
`scripts/main.mjs`, so if your code lived in `module/`, move it; the data
models are already under `scripts/`. Point the manifest at the bundle:
`"esmodules": ["main.mjs"]`.

```bash
pnpm install
pnpm build
```

`dist/` holds `main.mjs`, the manifest with the version synced from
`package.json`, and `lang/`, `templates/`, `styles/` copied over, plus the
release zip. That directory is what ships. A release workflow that zips
the checkout instead of `dist/` ships a system with no `main.mjs`; `audit`
rule 020 catches that, so run it once more on the finished branch.

## 6. Check

```bash
npx @vttforge/cli@latest audit
```

Zero findings is the target, and it was the result on the system this
was written against. Then load a world on v14, open every sheet type, and
search the console for `Deprecated since Version 14`. Each warning names
its replacement. Go through the `TODO(migrate)` lines you have not yet
touched; each one is a place the codemod could read but not decide.

## For a module

The same steps, with two gone. A module has no `template.json`, so skip
step 2: a sub-type a module adds is a data model from the start, under a
key prefixed with the module id, and [Modules](/guide/modules) shows the
declaration. In step 4 the call is `registerModule`, which takes
`actorDataModels`, `itemDataModels`, `sheets`, `enrichers`, `onBeforeInit`
and `onAfterInit`, and prefixes the type keys for you. It has no
`actorDocumentClass` and no `combat`: those belong to the running system.
Everything else, `audit`, `migrate`, `migrate --sheets`, the build and the
check, reads a module the way it reads a system.

What this run left untouched: the Actor class beyond its derived data,
the macros, the compendium packs, the CSS, and the templates beyond the
attributes the codemod added and the root element.
