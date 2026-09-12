# @vttforge/core

## 0.19.2

### Patch Changes

- Updated dependencies [594195c]
  - @vttforge/types@0.4.0

## 0.19.1

### Patch Changes

- d35cba1: `schemaHasResource` declared its first parameter as `Record<string, FieldInstance> | unknown`. A union with `unknown` is `unknown`, so the typed half did nothing and a caller got no checking from it. The parameter now says `unknown`, which is what it always was. No call changes.

## 0.19.0

### Minor Changes

- 7ce6a38: Type dice, chat, combat, scenes, tokens, the canvas and the ApplicationV2
  render surface.
  
  **What breaks.** `_prepareContext`, `_onRender` and `_getHeaderControls` on the
  sheet bases carry real types now. An override that declared `options: unknown`
  stops compiling at the `super` call, because `unknown` cannot be passed to a
  typed parameter. Name the type instead:
  
  ```diff
  -  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
  +  override async _prepareContext(
  +    options: ApplicationRenderOptions,
  +  ): Promise<ApplicationRenderContext> {
  ```
  
  Both types come from `@vttforge/core`. `postRoll` returns a `ChatMessageLike`
  rather than `unknown`.
  
  New in `@vttforge/types`:
  
  - `RollLike`, `RollConstructor`, `DieTermLike`, `DiceTermResult`. `total` is
    `number | undefined`, because a roll has none before `evaluate()` resolves.
    `toMessage` takes `messageMode`; `rollMode` is there and tagged deprecated,
    which is what Foundry did in v14.
  - `ChatMessageLike`, `ChatSpeakerData`, `ChatMessageConstructor`.
  - `CombatLike`, `CombatantLike`, `CombatHistoryData`.
    `getCombatantsByActor` and `getCombatantsByToken` return arrays, as they do
    since v14.
  - `SceneLike`, `LevelLike`, `TokenDocumentLike`, `TokenObjectLike`, `CanvasApi`.
    A scene's background lives on a Level in v14, and the types say so. A token
    carries `level` and `depth`.
  - `JournalEntryLike`, `MacroLike`, `FolderLikeDocument`.
  - The render surface: `ApplicationConfiguration`, `ApplicationRenderOptions`,
    `ApplicationRenderContext`, `ApplicationPosition`, `ApplicationTab`,
    `ApplicationTabsConfiguration`, `HandlebarsTemplatePart`,
    `ApplicationHeaderControlsEntry`, `ApplicationClickAction`.
  
  `game.messages`, `game.scenes`, `game.combats`, `game.combat`, `game.journal`,
  `game.macros` and `game.folders` now hand back the document they hold.
  
  `unknown` left on the public surface of `@vttforge/core`: 7, down from 37. Each
  one is a generic of ours, not a Foundry type: a field's `initial` and
  `validate`, the `FieldInstance` brand, the `OnHook` target, and the socket
  payload the consumer defines.
- 7ce6a38: Type the hooks by name.
  
  ```ts
  Hooks.on("createActor", (actor, options, userId) => {
    actor.name;        // string
    options.render;    // boolean | undefined
    userId;            // string
  });
  ```
  
  No annotation on any parameter. The name supplies them.
  
  **What breaks.** `HooksApi` used to take a type argument for the listener's
  arguments (`Hooks.on<[Actor]>(...)`). It no longer does: the name decides. Drop
  the type argument and the callback infers.
  
  `HookMap` holds every hook name Foundry ships. Three families are generated
  rather than listed, because Foundry builds their names:
  
  - `create<Document>`, `update<Document>`, `delete<Document>` and the `pre`
    forms, for all 30 document types. A `pre` hook may return `false` to cancel.
  - `get<Document>ContextOptions` and `get<Document>PlaceableContextOptions`.
  - `render<Class>`, `preRender<Class>` and `close<Class>`, which fall to the
    application shape, since a package names those after its own classes.
  
  A name nobody declared stays open, so `Hooks.callAll("my-module.thing", ...)`
  still compiles.
  
  `DocumentTypeMap` is the lookup from a document name to its type, exported so a
  package can reuse it.
- 770b51e: Type the Foundry globals: `game`, `ui`, `CONFIG`, `CONST` and `foundry.utils`.
  
  **What breaks.** `GameApi` is now `Game`, and `ActorConfig`, `ItemConfig` and
  `ConfigCollection` are now the one `DocumentConfig`. The old names still work
  and carry an `@deprecated` tag naming the replacement. `CONFIG.Combat` is a
  full `CombatConfig`, so code that assigned a bare `{ initiative }` object to it
  no longer compiles; assign to `CONFIG.Combat.initiative` instead.
  
  `@vttforge/types` now describes:
  
  - `Game`, with the settings API, `i18n`, `time`, the world collections, the
    compendium packs and the module handles.
  - `UiApi`, including `ui.notifications` and the sidebar.
  - `FoundryConfig`, with every document entry plus the ones a package writes in
    `init`: `statusEffects`, `TextEditor.enrichers`, `Dice`, `queries`.
  - `FoundryConstants`, with the real keys on the enumerations a package reads.
    `ACTIVE_EFFECT_CHANGE_PHASES`, `ACTIVE_EFFECT_EXPIRY_EVENTS` and
    `ACTIVE_EFFECT_DURATION_UNITS` are arrays, not records.
  - `FoundryUtils`: every member of `foundry.utils`, the geometry helpers
    included. The bare globals these replaced are gone in v14.
  
  Three options on `registerSystem` stopped being `unknown`:
  `actorDocumentClass`, `itemDocumentClass` and the two data model maps now take
  a class.
  
  `@vttforge/testing` gains `createMockConfig()`. A live Foundry has every
  `CONFIG` entry, so the type asks for all of them; a test that cares about one
  gets the rest from the factory.
  
  ```ts
  import { createMockConfig } from "@vttforge/testing/vitest";
  
  const CONFIG = createMockConfig({ statusEffects: { prone: { id: "prone" } } });
  CONFIG.Combat.initiative = { formula: "1d20" };
  ```
- 712edb3: Type the documents the bases hand you.
  
  `@vttforge/types` now describes the document surface: `DocumentMembers`,
  `ActorLike`, `ItemLike`, `ActiveEffectLike`, `FolderLike`, `EmbeddedCollection`
  and `TypeDataModelMembers`. Core re-exports all of them.
  
  Three places that returned `unknown` now return a document:
  
  - `this.document` on an actor or item sheet. Reading `name`, `system` or
    calling `update()` no longer needs a cast.
  - The drop hooks. `onDropItem`, `onDropActor`, `onDropFolder` and
    `onDropActiveEffect` hand over the document that was dropped.
  - `this.parent` inside a `BaseTypeDataModel`. It did not compile before.
  
  Both sheet factories take the document type, so the schema follows through.
  `ActorLike` takes the item type too, which keeps `actor.items` typed:
  
  ```ts
  type CharacterActor = ActorLike<CharacterSystem, ItemLike<GearSystem>>;
  
  class CharacterSheet extends BaseActorSheet<CharacterActor>() {
    async _prepareContext(options: unknown) {
      const level = this.document.system.level; // number
      return { ...(await super._prepareContext(options)), level };
    }
  }
  ```
  
  The member list came from the systems and modules already ported to the SDK:
  each one is a member their sheets and drop handlers read. Reaching past it is
  still a cast.

### Patch Changes

- Updated dependencies [7ce6a38]
- Updated dependencies [7ce6a38]
- Updated dependencies [770b51e]
- Updated dependencies [712edb3]
  - @vttforge/types@0.3.0

## 0.18.1

### Patch Changes

- 11bf7b5: Document what a module gets. The package READMEs list `registerSocket`,
  `moduleApi`, `convertSubTypes` and `inject`, which shipped without reaching
  any of the places a reader looks first. The core README still named
  `SystemConfig`, renamed two releases ago. The CLI README's audit list was
  missing the rule for socket use with no `"socket": true` in the manifest.

## 0.18.0

### Minor Changes

- 14b29cc: `inject()`: put a package's own UI inside an application it does not own.
  
  Most of what a module does, and there is no API for it. Foundry re-renders an
  application whenever its document changes, so the insert repeats, and every
  module writes the same guard by hand.
  
  `inject` marks what it inserted with `data-vttforge-injection="<id>.<name>"`
  and removes the previous one before inserting again, so ten renders leave one
  node. Two packages using the same name do not collide. It normalises the
  element, because most render hooks pass an `HTMLElement` and the deprecated
  `renderChatMessage` passes jQuery. It returns a function that unbinds, which
  nothing else does.
  
  New error code VTTF-0016.
- 86b64fa: An `api` option on `registerModule()`, and helpers for reading another
  package's.
  
  `api` is written to `game.modules.get(id).api` at the top of `init`, before
  your own `onBeforeInit` and before any CONFIG mutation. That hook is the part
  people get wrong: publish it later and anything that looked during its own
  `init` found nothing.
  
  `moduleApi(id)` hands back another module's api or `undefined`.
  `requireModuleApi(id)` throws VTTF-0014 and says which of four things is
  wrong: Foundry has no module list yet, the module is not installed, it is
  installed and switched off, or it is on and has not published. The bare read
  collapses all four into `undefined`, which is how a module ends up telling its
  user to install something they already have. `isModuleActive(id)` answers the
  narrower question.
  
  Read another package's api from `onSetup` or later. Nothing orders one
  package's `init` against another's.
  
  New error code VTTF-0014.
- ac59e0a: `SystemConfig` is now `PackageConfig`, and `createMigrationRunner` takes
  `packageId`.
  
  One thing changes behaviour. `createMigrationRunner` now throws VTTF-0017 when
  the call carries neither id. Before, it registered the world's `schemaVersion`
  under the string `undefined` and read it back from there for the life of the
  world. TypeScript callers see it at build time: the options type is a union,
  and a call with no id matches no branch. A JavaScript caller gets the throw on
  world load, and its stored version is under `undefined`.
  
  VTTF-0017 is its own code rather than the migration-failure one. A mistake in
  the call is not a migration that failed, and a catch that reads the code has
  to be able to tell them apart.
  
  The rest is names. A module stores settings the same way a system does, and
  runs migrations over its own stored data the same way. The old names said
  otherwise, and a module author reading the reference had to work out that the
  class was meant for them too.
  
  `SystemConfig` is the same class under the old name, so `instanceof` holds
  both ways and existing code keeps working. The instance property `systemId`
  still answers, and `createMigrationRunner` still reads a `systemId` option
  when `packageId` is absent. All three are deprecated and go away at 1.0.
- a5623a0: `registerSocket()`: the two ways a package talks to the other clients.
  
  `emit` sends a one-way message. `askGm` asks the Gamemaster's client to do
  something a player has no permission to do, and waits for the answer.
  
  It covers the four things that are silent when you get them wrong. The
  channel is `module.<id>` or `system.<id>`, not the package id. `"socket": true`
  is a manifest field, and without it Foundry accepts the emit and delivers
  nothing. The sender id comes from the server, not the payload, so a permission
  check that reads the payload is not a check. And Foundry never delivers a
  message back to whoever sent it, so `emit` runs the handler locally too and
  drops the sender's own id from `recipients`.
  
  Handlers fail closed: `from` defaults to `'gm'`, and a message from anyone else
  is dropped. New error codes VTTF-0012 and VTTF-0013.
- 7e77931: `subTypeDocuments()` and `convertSubTypes()`: a way out for a module's
  documents before the module goes away.
  
  A module's sub-types travel with the module. Switch it off and every document
  using one is invalid; uninstall it and they are stranded. Foundry says to ship
  a conversion path, and every module that ships one writes it from scratch.
  
  `subTypeDocuments()` answers what a user would lose. `convertSubTypes()` turns
  each one into another type, one update each, in place: the id survives, and so
  do the flags, the folder, the ownership and the embedded documents.
  
  The shape of that update is the part worth having written down.
  `update({ type })` on its own is refused, and Foundry drops the whole update
  with it, so a call that also renamed the document loses the rename. Creating a
  replacement with `keepId` while the original still exists overwrites it, with
  no error and no second document.
  
  New error code VTTF-0015.

## 0.17.0

### Minor Changes

- 59cef49: Table dice helpers: `dicePool(spec)` writes a pool formula from a description (`keep`, `drop`, `successAt`, `failAt`, `explode`, `rerollAt`, `min`, `max`) with the modifiers Foundry's `Roll` parses; `stepDie(faces, steps, ladder?)` moves a die along a ladder and stays on its ends; `countSuccesses(roll, target, { failAt })` counts on any evaluated roll from the active results. Bad input is refused with VTTF-0011.
- e5567cb: `promptFields(fields, options)` shows a dialog built from a list of fields (`text`, `textarea`, `number`, `checkbox`, `select`) through Foundry's own input helpers and `DialogV2.input`, and resolves to an object typed from the fields, or `null` when dismissed. `promptFieldGroup(field)` returns one form group for a dialog you configure yourself.
- 6ad9da6: `resourceField(options)` builds the `{ value, max }` SchemaField a token bar reads, with both children required, non-nullable numbers, typed as `{ value: number; max: number }`. `registerSystem` now checks the manifest's `primaryTokenAttribute` and `secondaryTokenAttribute` against the Actor data models it registers and throws VTTF-0010 at `init` when no model declares a resource at that path; Foundry would draw no bar and say nothing. `schemaHasResource(schema, path)` is the check on its own.

## 0.16.0

### Minor Changes

- c0bd31e: `keywords` on `registerSystem` and `registerModule`: a list of rules terms, each an id, a label and a description. `@Keyword[id]` in any rich text becomes the label with the description as tooltip, and on `ready` the GM's client writes all of them to a journal entry (named by `keywordsJournal`, or skipped with `false`) and rewrites it when the list changes. A bad or repeated id is refused with VTTF-0009.
- 1b42a83: `postRoll(roll, options)` posts a roll to chat as a card. It evaluates the roll if needed, decides a critical or a fumble from the first die by the `crit` and `fumble` thresholds you give (`true`, a number, or a function), tags the card with `vttf-roll--crit` or `vttf-roll--fumble` and a label, and stores the outcome in the message flags as `vttforge.roll` under your package's scope. `rollOutcome()` and `naturalResult()` expose the decision without posting.
- 12aae87: Play and edit modes for the sheet bases. Opt in with `static MODES = { initial: 'play' }` on a `BaseActorSheet()` or `BaseItemSheet()`: a header control switches between the two, `sheet.mode`, `sheet.toggleMode()` and `context.mode` report it, the sheet element carries `vttforge-mode-play` or `vttforge-mode-edit`, and in play every form field in the window content is disabled except those inside an element with `data-vttforge-edit-in-play`. A sheet without `MODES` behaves as before.

### Patch Changes

- d21b217: `BaseActorSheet` and `BaseItemSheet` now declare `_onRender` as `async` and await the parent's render before binding the `DRAG_DROP` entries; a subclass that overrides it should `await super._onRender(context, options)`. The instances come from `foundry.applications.ux.DragDrop.implementation` when the runtime provides it. The JSDoc examples pass `{ inplace: false }` to `mergeObject`, which the parent's static options need.
- da45c42: The keywords journal finds its page by flag and rewrites only that page, so pages the GM adds to the journal survive a sync, and a deleted page comes back without touching the others. `postRoll` merges `vttforge.roll` into the scope's existing `vttforge` flags instead of replacing them.

## 0.15.2

### Patch Changes

- f8ecf14: Plainer wording in the READMEs, the scaffolded project READMEs and the default messages of the `VTTF-NNNN` errors. No code change.
- Updated dependencies [f8ecf14]
  - @vttforge/types@0.2.1

## 0.15.1

### Patch Changes

- 4c5bb6c: The `vttforgeTab` action activates any element with the `tab` class, not only a `<section>`. A sheet whose panes are `<div class="tab">`, which is what most systems write, never switched tabs.

## 0.15.0

### Minor Changes

- c7a9920: `@SystemSetting`, the last of the planned decorators. Put it on a static accessor and the setting is registered at `init`; reading the accessor calls `game.settings.get`, assigning to it calls `game.settings.set`, and the accessor's initializer is the default. Experimental, like the other four.

## 0.14.0

### Minor Changes

- 2224420: Target Foundry v14.
  
  - `registerSystem` no longer takes `activeEffect.legacyTransferral`. v14 removed the flag; Item effects with `transfer: true` apply to the Actor in place.
  - `statusEffects` on `registerSystem` and `registerModule` adds each entry to `CONFIG.statusEffects` by its `id` instead of assigning or pushing an array. v14 keys the collection by id, and a whole-array assignment empties it first. An entry without a string `id` throws the new `VTTF-0008`.
  - The `ActiveEffectConfig` type is gone; `StatusEffectConfig` is new.

## 0.13.0

### Minor Changes

- 0034209: Add four decorators, marked `@experimental`, for the registrations every package writes by hand: `@ActorDataModel`, `@ItemDataModel`, `@DocumentSheet` and `@OnHook`.
  
  ```ts
  @ActorDataModel('character')
  class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {}
  
  @DocumentSheet({ id: 'character', document: 'Actor', namespace: 'my-system', types: ['character'], makeDefault: true })
  class CharacterSheet extends BaseActorSheet() {}
  
  class Chat {
    @OnHook('renderChatMessageHTML')
    static onRender(message: unknown, html: HTMLElement) {}
  }
  ```
  
  The timing is the whole point. `CONFIG` may only be touched inside the `init` hook, but a class is defined the moment its module is imported, long before `init`. The obvious version, assigning to `CONFIG` from the decorator body, works in a test and silently does nothing in Foundry. These subscribe a listener at definition time and do the assignment when `init` fires.
  
  `@DocumentSheet` takes a required `id` and goes through `registerSheets`, the same path `registerSystem({ sheets })` takes. Foundry saves the sheet key on every document using it and builds that key from the class name, which a bundler renames between builds. The `id` is what keeps the saved key pointing at a sheet that still exists.
  
  `@OnHook` accepts static methods only. An instance method has no instance to run against when the listener is registered, and inventing one would be a guess; it throws `VTTF-0002` and says so.
  
  These are standard TC39 decorators, not the legacy `experimentalDecorators` kind. Oxc, which Vite 8 uses, does not lower them yet, so a build that applies them needs the Babel decorator plugin ahead of Oxc. `@vttforge/vite-plugin` adds it for you, filtered to files that contain an `@`, so a project that never uses a decorator pays nothing.
  
  All four are `@experimental`: they are new and no consumer has used them yet, so the shape can change in a minor. `registerSystem` and `registerModule` remain the supported path and are what the scaffolds use.

## 0.12.0

### Minor Changes

- 4f81bfd: Add `onI18nInit` and `onSetup` to `registerSystem` and `registerModule`.
  
  Foundry starts a world in four stages and only two of them were reachable. The missing two are the ones that are hard to work around.
  
  `i18nInit` is the first moment `game.i18n` works. A label localized during `init` comes back as the key you passed in, because the language files have not loaded, and that raw key is what players read on screen. Translate CONFIG labels in `onI18nInit` instead, once, rather than calling `localize` on every render.
  
  `setup` runs after every package has finished its own `init`. A setting registered during `init` can be read from here on, and a module can see what the system around it registered instead of racing it.
  
  ```ts
  registerSystem({
    id: 'my-system',
    onI18nInit: () => {
      for (const ability of Object.values(CONFIG.MY_SYSTEM.abilities)) {
        ability.label = game.i18n.localize(ability.label);
      }
    },
    onSetup: () => {
      if (settings.get('showTutorial')) openTutorial();
    },
  });
  ```
  
  Both are optional and neither is GM-gated. Omit one and no hook is staged for it.

## 0.11.3

### Patch Changes

- 9b8ca8c: Export the option and config interfaces that public functions already took: `MockDocumentOptions` and `MockFoundryOptions` from `@vttforge/testing`, `ActorConfig` and `ItemConfig` from `@vttforge/core`. They were reachable through the functions but could not be named.
- 9b8ca8c: Plain punctuation in error messages, prompts and doc comments: em dashes replaced with sentence breaks, colons or parentheses. The generated API reference reads these comments, so they are public text.
- e0941e2: `@vttforge/types` now holds the Foundry surface the base factories stand on: `ApplicationV2Members`, `DocumentSheetV2Members` and `VttforgeClass`. `@vttforge/core` depends on it and re-exports the same names, so nothing changes for a system that imports from core.
- Updated dependencies [e0941e2]
  - @vttforge/types@0.2.0

## 0.11.2

### Patch Changes

- 7eeeb20: Rewrite the npm package descriptions to say what each package does today. `types` claimed full schema inference it does not have, `vite-plugin` claimed Handlebars HMR that lives in the dev loop, and `cli` did not mention `audit`.

## 0.11.1

### Patch Changes

- 578ba31: Bring the package READMEs in line with what shipped. `core`, `styles`, `types` and `vite-plugin` still described themselves as v0.0.1 placeholders with "planned" features; `cli` did not mention `audit`.
- ae724e3: Read the exported `VTTFORGE_*_VERSION` constants from `package.json` at build time. They were hardcoded and had fallen behind — `vttforge --version` printed `0.1.0` on the 0.5 line.

## 0.11.0

### Minor Changes

- e55a6dc: Replace the index signature on the base classes with the Foundry members they stand on.
  
  The base factories returned an instance typed `Added & { [member: string]: any }`. The index signature was meant as a middle ground — our half typed, Foundry's half reachable. Measured against two real consumers, it turned out to be the worse of the two failures.
  
  It made every property access legal:
  
  ```ts
  const viewer = new PdfViewer();
  viewer.goToPage(3);      // no such method — accepted
  viewer.tpyoDeVerdade();  // not even a real name — accepted
  ```
  
  A module shipped a release calling `url` and `goToPage` on a viewer that had neither, and nothing reported it.
  
  And it did not buy the thing it looked like it bought. An index signature is not a declaration, so `override` on a Foundry member was rejected anyway — `error TS4113`. It permitted what should have failed and forbade what should have worked.
  
  `ApplicationV2Members` and `DocumentSheetV2Members` now describe the Foundry surface these bases rely on: `element`, `title`, `rendered`, `options`, `render`, `close`, `_prepareContext`, `_onRender`, `_onFirstRender`, plus `document` and `isEditable` for sheets. It is not the whole ApplicationV2 API and does not claim to be.
  
  **This will surface errors in existing code, and that is the point.** Two shapes:
  
  - **A member you call that nobody declared.** Either a typo, or a Foundry member outside the set above. The second needs a cast — one line, written on purpose, instead of an index signature writing it for you on every line.
  - **`this.document` is `unknown`.** Which document a sheet is for is yours to know. A getter says it once:
  
    ```ts
    get actor(): MyActor {
      return this.document as MyActor;
    }
    ```
  
  `UntypedFoundryMembers` is gone. Nothing exported it usefully — it only ever widened.
  
  `BaseTypeDataModel()` with no schema now gives the hooks and nothing invented. Pass your schema function to get the fields typed too, which is what the example system does.

## 0.10.0

### Minor Changes

- d17c99c: Register text enrichers through `registerSystem` / `registerModule`.
  
  `CONFIG.TextEditor.enrichers` is a plain array, so registering by hand is one `push`. The reason this exists is that the array has four ways to accept an entry and then do nothing with it, and Foundry names none of them.
  
  `onRender` without an `id` never fires — Foundry wraps enriched output in a custom element only when both are present, and only the wrapper fires the callback, so the markup looks right and only the behaviour is missing. A duplicate `id` silently loses, because the wrapper finds the enricher back with `find` and takes the first match: two packages both using `link` means the first one's `onRender` runs against the second one's markup, which only reproduces in a world with both installed. A pattern without the `g` flag throws, because enrichment matches with `matchAll`, and that throw is outside the handler Foundry wraps enrichers in. And the id lives in one namespace shared with the system and every other module.
  
  ```ts
  registerModule({
    id: 'my-module',
    enrichers: [{ id: 'link', pattern: /@PDF\[(.+?)\]/g, enricher, onRender }],
  });
  ```
  
  Ids are namespaced to the package, an id is always supplied so `onRender` fires, and the rest is checked when you register rather than when someone opens a chat message.
  
  New error VTTF-0007 for an id that is empty, dotted, or repeated, and for a non-global pattern.

## 0.9.0

### Minor Changes

- e320282: `BaseDocumentSheet` — a document sheet that builds its own DOM.
  
  `BaseActorSheet` and `BaseItemSheet` are `HandlebarsApplicationMixin` baselines, which is right for the common case: declare `static PARTS`, write templates, let the mixin render them.
  
  It is wrong for a sheet whose content is not a template — a canvas, an embedded PDF, a Svelte or Lit mount. Extending the Handlebars baseline for one of those does not fail loudly: the mixin's `_replaceHTML` expects a map of part id to markup, receives an element instead, and quietly renders nothing. The window opens empty, or does not open, and no error names the mismatch.
  
  Found porting a PDF-backed actor sheet onto the SDK, where the symptom was a sheet that had rendered a moment earlier going blank with a clean console.
- e320282: Register sheets through `registerSystem` / `registerModule`, under an id that survives a rebuild.
  
  Foundry keys a registered sheet by `${package id}.${class name}` and writes that key onto every document whose owner picked the sheet. The key is saved data derived from a JavaScript class name.
  
  That works unbundled and breaks once you ship a build. A minifier renames classes and does not promise the same name twice, so one sheet registered as `mo` in one build and `vo` in the next. Every saved choice then named a sheet that no longer existed: Foundry fell back to the default and said nothing. It hits released upgrades, not just a dev loop — a reader picks the sheet in 1.0, you ship 1.1, the choice is gone.
  
  Both registration functions now take `sheets`, and each entry carries an `id`. VTTForge fixes the class name to that id before registering, so the key is written down instead of inferred.
  
  ```ts
  registerModule({
    id: 'my-module',
    sheets: [{ id: 'fillable', document: 'Actor', sheet: FillablePdfSheet }],
  });
  ```
  
  Because the key is persisted, the way it is derived is now a compatibility promise. Pick an `id` once and keep it — renaming it loses the sheet choice on every document already using it.
  
  New error VTTF-0006 for an id that is empty, contains a dot, or repeats another sheet in the same package.

## 0.8.0

### Minor Changes

- 2227957: `BaseApplication` — a plain `ApplicationV2` window without the two traps.
  
  The document sheets already had a baseline. Everything else a package puts on screen — a config dialog, a picker, a reader — is a bare `ApplicationV2`, and writing one by hand means meeting both of these:
  
  - **`_replaceHTML` is easy to forget.** ApplicationV2 splits rendering in two, and implementing only `_renderHTML` leaves the class silently unrenderable. Foundry reports it at the moment something tries to open the window, as an error about abstract methods. Nearly every implementation of the second half is the same line, so this ships it.
  - **A missing `_renderHTML` fails late.** This checks at construction and names the class, so it fails where the class is used rather than deep inside a render.
  
  Both were met while porting a real module onto the SDK.
- 6483344: The base factories now report what they add.
  
  Every `Base*` factory returned `any`, which gave up on two things at once: a subclass could not write `override` on a member it really was overriding, and a call to a method that does not exist passed silently. Both happened while porting a real module onto the SDK — the second one shipped a broken call into a release.
  
  They now return the members they contribute, with the rest of the Foundry surface reachable through an index signature. A property the SDK knows about carries its real type; anything else behaves as before.
  
  This will surface `override` errors in subclasses that were previously allowed to omit the keyword. That is the point: TypeScript can see the member now.
  
  The index signature is what `@vttforge/types` replaces when it lands.

### Patch Changes

- 257614b: Error code pages are generated for the docs site as well as the repo.
  
  `codegen-errors.mjs` wrote one Markdown stub per code into `docs/errors/`. It now writes the same stubs into `apps/docs/errors/` too — one source, two destinations, so the page a reader lands on from GitHub and the page the site publishes cannot drift.
- d015aee: Stop requiring Node 26 to install a browser package.
  
  Every package declared `engines.node: ">=26.0.0"`. Four of them — `core`, `styles`, `types` and `dev-module` — compile to ES2022 and run in the browser inside Foundry. They never touch Node, and the floor did nothing except stop anyone on Node 22 LTS from installing the SDK at all.
  
  Those four declare no engine now. `@vttforge/testing` drops to `>=22` — its Quench half runs in the browser too. `@vttforge/cli` and `@vttforge/vite-plugin` keep `>=26`, which is what they actually build against.

## 0.7.0

### Minor Changes

- dcd07d5: Type the three embedded fields, and turn `checkJs` back on for the example.
  
  - `EmbeddedDataField` is the model instance, not a plain object — the field builds a schema from the model's own `defineSchema()`, but initializing constructs the model, so derived data and methods come with it.
  - `EmbeddedDocumentField` is the same for a Document class, and nullable out of the box.
  - `TypedSchemaField` is a discriminated union. The field supplies a `type` string validated to equal each entry's key when the entry does not declare one, which is what makes narrowing on `type` work.
  
  The example system now compiles with `checkJs: true`, which is what proves any of this against real JavaScript rather than only against type tests.

## 0.6.0

### Minor Changes

- c24b2e9: Fix two things `InferSchema` got wrong about a field's runtime type.
  
  `ColorField` inferred as `string`. It stores a CSS string but initializes
  into a `Color` instance, so `system.tint` is an object with `.css`, `.rgb`
  and friends — and the old typing made every property access on it a lie the
  compiler accepted. It is also nullable by default, unlike the other
  string-backed fields: the field's own defaults are `nullable: true,
  initial: null`, so reading `.css` off a fresh document was a real crash the
  types allowed. It now infers as `Color | null`, and drops the null when
  `nullable: false` is set.
  
  Presence was half-implemented. Only `nullable: true` widened the type;
  `required: false` did not. A field that resolves to `undefined` when absent
  was typed as always present. The rule now follows how a field actually
  resolves a missing value: an explicit `initial` always fills, so it never
  widens; otherwise `required: false` admits `undefined` and `nullable: true`
  admits `null`, and the two compose.
  
  `Color` is described structurally rather than imported, so the inference
  surface still carries no dependency on a Foundry type package.
- 3f09683: Add `registerModule()` for modules that contribute document sub-types.
  
  Foundry files a module's sub-type under `<module-id>.<type>`. Register the bare name and there is no error — the type just never appears. `registerModule()` adds the prefix, and `moduleSubType(id, type)` gives you the same string wherever else you need it (registering the sheet, checking `actor.type`, writing `documentTypes` in the manifest).
  
  ```ts
  registerModule({
    id: 'pdf-character-sheet',
    itemDataModels: { pdf: PdfItemData }, // → CONFIG.Item.dataModels['pdf-character-sheet.pdf']
  });
  ```
  
  `registerSystem()` was the only option before, and it is the wrong shape for a module: it writes bare keys and also replaces the document classes, the initiative formula, and the status-effect array — all of which belong to the system. There is no option to replace them here, and `statusEffects` appends instead of assigning.
- 98b742c: Give each field its own defaults when inferring a schema.
  
  Every field class picks its own defaults, and they disagree. The inference treated them as if they agreed, so three fields were typed as shapes they cannot hold:
  
  - `NumberField` is optional and nullable out of the box. `new fields.NumberField()` is `number | null | undefined`, not `number`.
  - `StringField` is optional. A bare one is `string | undefined`.
  - `FilePathField` starts at `null`, the way `ColorField` does. A bare one is `string | null`.
  
  The rest were already right, for reasons worth naming: booleans and HTML fields are required and supply their own initial; arrays, sets and schemas are required and build their own empty value; document references are required but nullable.
  
  This will surface errors in schemas that leave the options off. The fix is to declare what you meant — `{ required: true, nullable: false, initial: 0 }` — which is what the field needed all along.
- 8657721: Let `BaseTypeDataModel` learn your schema.
  
  Hand it the function that returns your fields and it implements `static defineSchema()` for you. The schema is written once, and `this` inside `prepareDerivedData()` knows its own fields:
  
  ```ts
  class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {
    declare armorClass: number;
    prepareDerivedData() {
      this.armorClass = 10 + this.level; // this.level is number
    }
  }
  
  type CharacterSystem = CharacterData['$inferData'];
  ```
  
  Derived values are not in the schema, so declare them on the subclass.
  
  Calling `BaseTypeDataModel()` with no arguments works exactly as before.
- f11b1f4: Type `SetField` and `ForeignDocumentField` in `InferSchema`.
  
  A `SetField` holds a `Set`, not an array. Inferring it as an array handed you `push` and index access on a value that has neither, and the compiler agreed.
  
  A `ForeignDocumentField` reads back as the document itself — the data model installs the field as a getter, so the property gives you the instance, not the function that fetched it. Under `idOnly` it stays the id string. Both admit `null` unless the schema sets `nullable: false`.
  
  Also exported: `SetFieldInstance`, `SetFieldCtor`, `SetFieldOptions`, `ForeignDocumentFieldInstance`, `ForeignDocumentFieldCtor`, `ForeignDocumentFieldOptions`, and `DocumentClass`.
- 74c4126: Type the statics on `BaseActorSheet()` and `BaseItemSheet()`.
  
  Both returned a bare constructor, so a subclass writing `super.DEFAULT_OPTIONS` — the pattern the docs show and every sheet needs — failed to compile. TypeScript cannot see a static through an untyped constructor. The example system is JavaScript, so nothing caught it.
  
  They now return `SheetBaseCtor`, which carries `DEFAULT_OPTIONS` and `DRAG_DROP`. A subclass declaring either needs the `override` modifier, which is TypeScript correctly seeing the inherited static.

## 0.5.0

### Minor Changes

- 9462144: Require Node 26.

  The floor moves from `>=22.14.0` to `>=26.0.0` across every package and the
  four scaffolding templates, and the bundler target for the Node-side
  packages moves from `node22` to `node26`.

  Node 22 entered maintenance in October 2025 and receives security fixes
  only. Node 26 becomes the active LTS line on 2026-10-28.

  This is breaking for anyone on Node 22 or 24. It is marked `minor` rather
  than `major` on purpose: these packages are still on 0.x, where a minor
  signals the break, and a major would push every package to 1.0.0 — a claim
  of API stability that has not been audited, on packages two of which are
  still stubs.

  The templates move to the versions this release publishes. On 0.x a caret
  pins the minor, so their old ranges would not have matched.

  CI now pins Node through `actions/setup-node` instead of inheriting whatever
  the runner image ships, so the version the packages declare is the version
  they are tested on. It was not before: the workflow took the image's Node,
  and nothing enforced the declared floor because `engine-strict` is not set.

## 0.4.0

### Minor Changes

- 50721f9: fix: align with Foundry v13 manifest schema and add `prepareBaseData` hook

  Three coordinated changes:

  **`@vttforge/core`** — `BaseTypeDataModel()` now ships a `prepareBaseData()`
  no-op stub alongside `prepareDerivedData()`. Use `prepareBaseData()` to
  initialize fields that Active Effects need to mutate (base max HP, base AC),
  since AEs apply between `prepareBaseData()` and `prepareDerivedData()`.
  `prepareDerivedData()` stays the place for values that depend on the
  AE-mutated state.

  The misleading `_addDataFieldMigrations()` static stub is removed. The real
  field-rename API is `_addDataFieldMigration(source, oldKey, newKey, apply?)`
  called inside a `static migrateData(source)` override — consumers who need
  it can call it directly on the Foundry-provided base via `super`.

  **`@vttforge/vite-plugin`** — emits the canonical v13 `styles` form
  (`[{ src: "styles/foo.css" }]`) in the built manifest. Still accepts the
  legacy string form (`["styles/foo.css"]`) and the v13 object form as input,
  so existing consumers don't need to change their source manifest. Additional
  metadata declared on object entries (e.g. `layer` for cascade layer
  placement) is preserved through the rewrite — only `src` is rewritten to
  point at the bundled output.

  **`@vttforge-examples/simple-system`** — manifest aligned with v13 schema:
  `gridDistance` / `gridUnits` collapsed into the `grid` object; `styles`
  declared in object form; `flags.hotReload` declared at the root of `flags`
  (not under the package namespace) and switched to the object form
  (`{ extensions, paths }`) that Foundry's runtime hot-reload watcher
  actually reads. The previous shape was a double no-op — wrong location AND
  wrong form, so the watcher silently exited without registering any
  extensions.

  Hot-reload enablement on the Foundry server side is deferred — runtime
  configuration changes interact with felddy's `CONTAINER_PRESERVE_CONFIG`
  flag in ways that require a dedicated design pass. That work is tracked
  separately and will land alongside the developer-facing hot-reload bridge.

## 0.3.0

### Minor Changes

- 234a4b2: Extend `BaseActorSheet` and add `BaseItemSheet` — the boilerplate every shipping
  system copy-pastes is now hoisted into the SDK.
  - `static DRAG_DROP` — declare drag sources / drop targets as data; the base
    wires real `foundry.applications.ux.DragDrop` instances in `_onRender` with
    `isEditable`-gated permissions and a default `_onDragStart` that serialises
    `data-item-id` elements as `{ type: "Item", uuid }`.
  - `_prepareContext` auto-fills `context.tabs[group]` for every group declared
    in ApplicationV2's `static TABS`, eliminating manual `_prepareTabs(group)`
    calls in subclass `_prepareContext`.
  - Typed drop dispatch: override `onDropItem(item, event)` / `onDropActor(...)` /
    `onDropFolder(...)` / `onDropActiveEffect(...)` and skip the `fromUuid()`
    ceremony. Returning `undefined` falls through to Foundry's default
    `_onDropX`; return anything else to take ownership.
  - New `BaseItemSheet()` mirror with the same `static DRAG_DROP` + tab
    auto-population, minus the drop dispatch (items rarely receive drops).
  - Exports new `DragDropConfig` type for typed `static DRAG_DROP` declarations.

  `editImage` is intentionally not reinvented — it already ships on
  `DocumentSheetV2` (inherited by both `ActorSheetV2` and `ItemSheetV2`).
  Templates wire `<img data-edit="img">` and Foundry's built-in action handles
  the `FilePicker` flow.

- 4fd5a07: Error registry codegen — `docsUrl` now resolves to a real page.

  `postbuild` hook (`packages/core/scripts/codegen-errors.mjs`) reads the
  just-built `dist/index.mjs`, calls `listErrorEntries()`, and emits:
  - `dist/errors-manifest.json` — versioned JSON catalogue shipped in the
    tarball alongside the bundled JS/types. Stable shape (`version`,
    `package`, `packageVersion`, `entries[]`) so external tooling (the v0.3
    docs site, IDE extensions, lint rules) has a single source of truth.
  - `docs/errors/VTTF-NNNN.md` at the repo root — one Markdown stub per code,
    committed so the `docsUrl` already resolves while the full VitePress site
    is being built in v0.3.

  New runtime helper: `getErrorManifest()` returns the same data as
  `listErrorEntries()`, wrapped in a typed `ErrorManifest` envelope with a
  stable `version: 1` field for future format migrations.

  Plan deviation: the codegen runs as `postbuild` (not `prebuild`) so the
  script imports the just-built ESM directly instead of needing
  `tsx`/`unrun` to load the TS source. Documented inline in the codegen
  script.

- 0896bb0: Add `createMigrationRunner()` for declarative schema migrations, plus
  `onReady` lifecycle on `registerSystem()`.

  `createMigrationRunner({ systemId, migrations, ... })` returns `{ register(),
run(), targetVersion }`. Call `register()` from `init` to register the
  `schemaVersion` setting; call `run()` from `ready` (gated by
  `game.user.isGM`) to execute every pending migration in order. Migrations use
  semver versions and `foundry.utils.isNewerVersion` for comparison, the same
  contract `system.json`'s `flags.<systemId>.needsMigrationVersion` /
  `compatibleMigrationVersion` use.

  Failure semantics: `schemaVersion` is committed per-migration, so a
  mid-sequence throw leaves the world at the last successful version and the
  retry on the next world load picks up exactly where it failed. Migration
  errors are wrapped in `VttfError VTTF-0004` with the original error on
  `.cause`; calling `run()` against a world older than `compatibleVersion`
  throws `VttfError VTTF-0005`.

  `registerSystem()` gains `onReady?: () => void | Promise<void>` — the natural
  place to wire `migrationRunner.run()`. Not GM-gated; consumer guards inside
  their callback.

  New error codes (append-only): `VTTF-0004 MigrationFailed`,
  `VTTF-0005 WorldTooOldForMigration`.

- 49a8718: Fix `BaseActorSheet` / `BaseItemSheet` tab handling so sheets work without
  per-consumer workarounds.

  Two issues surfaced when running the example sheet inside a live Foundry v13:
  - **`context.tabs` double-wrap on single-group sheets.** The previous
    `_prepareContext` override unconditionally set `context.tabs[group]`,
    even when ApplicationV2 already populated a flat
    `context.tabs[tabId]` for single-group sheets. The collision forced
    consumers to either unwrap manually or write `context.tabs.<group>.<tabId>`
    in every template. Fixed: BaseActorSheet/BaseItemSheet now only fill
    `context.tabs[group]` for **multi-group** sheets (single-group sheets
    see ApplicationV2's flat shape untouched).

  - **No default `tab`-style action handler.** ApplicationV2 doesn't ship a
    built-in handler for `data-action="…"` tab navigation buttons, and the
    bare name `tab` is reserved by the framework (custom handlers under that
    name never fire). Fixed: both base sheets now ship a `vttforgeTab`
    action that toggles `.active` on the matching nav button
    (`[data-action="vttforgeTab"][data-group=…][data-tab=…]`) and content
    section (`section.tab[data-group=…][data-tab=…]`) and updates
    `sheet.tabGroups[group]`. Templates that already used the old per-sheet
    workaround need to rename `data-action="tab"` → `data-action="vttforgeTab"`.

  Discovered during development testing — not derived from any external
  source.

  Patch bump for the example: drops the `_prepareContext` unwrap workaround
  and the per-sheet `_onTab` static handlers added in the previous PR,
  since both now live in the SDK.

## 0.2.0

### Minor Changes

- 5dd98c1: Add `fields()` factory and `InferSchema<T>` for typed `defineSchema()` outputs.

  Covers the v0.1 partial scope from PRD §7: `NumberField`, `StringField`,
  `BooleanField`, `HTMLField`, `ArrayField`, `SchemaField`, `ColorField`,
  `FilePathField`. Calling `fields()` lazy-resolves `globalThis.foundry.data.fields`
  and throws `VttfError VTTF-0002` outside the Foundry runtime — same pattern as
  `BaseTypeDataModel()` / `BaseActorSheet()`.

  `InferSchema<S>` derives the `system` shape from a `defineSchema()` return value,
  recursing through `ArrayField` and `SchemaField` and honouring the single
  nullability rule `nullable: true` → `T | null`. Full class-level inference
  (`BaseTypeDataModel<typeof Schema>`), `$inferData`, `EmbeddedDataField`,
  `EmbeddedDocumentField`, `TypedSchemaField`, and the full required×initial
  nullability matrix remain v1.0 scope and will ship from `@vttforge/types`.

## 0.1.0

### Minor Changes

- 4900e83: Foundation MVP (PR 4 of 4) — `@vttforge/core` ships its first runtime surface (registerSystem, SystemConfig, BaseTypeDataModel, BaseActorSheet, VttfError + VTTF-NNNN registry) and `@vttforge/styles` ships its first `--vttf-*` token set wrapped in the `vttforge.tokens` cascade layer.

  Both packages have working consumer entrypoints (verified by an external smoke test loading the built `.mjs` from a throwaway dir) and the SDK contracts match the canonical Foundry v13 patterns (TypeDataModel migration, ActorSheetV2 + HandlebarsApplicationMixin, staged init hooks, marker classes).

  Status remains pre-1.0 and APIs are explicitly unstable — these are the first releases that have real code instead of placeholder `export {}`.

## 0.0.1

Initial functional release (v0.1 MVP slice). Foundry v13+ system runtime helpers.

### Added

- `registerSystem({ id, actorDataModels, itemDataModels, actorDocumentClass, itemDocumentClass, combat, statusEffects, onBeforeInit, onAfterInit })` — one-call boot that schedules CONFIG mutations via `Hooks.once("init", ...)`. Idempotent per `id` (throws `VTTF-0001` on duplicate). Sets `CONFIG.ActiveEffect.legacyTransferral = false` by default.
- `SystemConfig` — typed wrapper around `game.settings.register/get/set`. Tracks registered keys locally; reads/writes against an unregistered key throw `VTTF-0003` instead of returning `undefined`.
- `BaseTypeDataModel()` — mixin over `foundry.abstract.TypeDataModel` providing a safe default `migrateData` that delegates to `super` (chained-migration guard), a stub `_addDataFieldMigrations`, and a no-op `prepareDerivedData`.
- `BaseActorSheet()` — mixin over `HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)` with `DEFAULT_OPTIONS` that ship the `vttforge` marker class so consumers can scope CSS without specificity wars.
- `VttfError` + `VTTF-NNNN` registry — central, append-only error codes (`VTTF-0001` SystemAlreadyRegistered, `VTTF-0002` MissingFoundryGlobals, `VTTF-0003` UnknownSetting), each with a `name`, `summary`, and `docsUrl` pointing at `https://vttforge.dev/errors/VTTF-NNNN`. Supports native ES2022 `cause` and `AggregateError`.

### Verified

- 32 Vitest unit tests across 5 files, all passing on Node 22.14 and Node 24.
- External consumer smoke test (importing the published `.mjs` from a throwaway dir) confirms every exported symbol behaves as designed when Foundry globals are present or absent.
