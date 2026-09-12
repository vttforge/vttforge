# @vttforge/types

## 0.3.0

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

## 0.2.1

### Patch Changes

- f8ecf14: Plainer wording in the READMEs, the scaffolded project READMEs and the default messages of the `VTTF-NNNN` errors. No code change.

## 0.2.0

### Minor Changes

- e0941e2: `@vttforge/types` now holds the Foundry surface the base factories stand on: `ApplicationV2Members`, `DocumentSheetV2Members` and `VttforgeClass`. `@vttforge/core` depends on it and re-exports the same names, so nothing changes for a system that imports from core.

## 0.1.3

### Patch Changes

- 7eeeb20: Rewrite the npm package descriptions to say what each package does today. `types` claimed full schema inference it does not have, `vite-plugin` claimed Handlebars HMR that lives in the dev loop, and `cli` did not mention `audit`.

## 0.1.2

### Patch Changes

- 578ba31: Bring the package READMEs in line with what shipped. `core`, `styles`, `types` and `vite-plugin` still described themselves as v0.0.1 placeholders with "planned" features; `cli` did not mention `audit`.
- ae724e3: Read the exported `VTTFORGE_*_VERSION` constants from `package.json` at build time. They were hardcoded and had fallen behind — `vttforge --version` printed `0.1.0` on the 0.5 line.

## 0.1.1

### Patch Changes

- d015aee: Stop requiring Node 26 to install a browser package.
  
  Every package declared `engines.node: ">=26.0.0"`. Four of them — `core`, `styles`, `types` and `dev-module` — compile to ES2022 and run in the browser inside Foundry. They never touch Node, and the floor did nothing except stop anyone on Node 22 LTS from installing the SDK at all.
  
  Those four declare no engine now. `@vttforge/testing` drops to `>=22` — its Quench half runs in the browser too. `@vttforge/cli` and `@vttforge/vite-plugin` keep `>=26`, which is what they actually build against.

## 0.1.0

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

## 0.0.1

Initial placeholder release — package name reserved on npm. Real type surface lands in v1.0.0.
