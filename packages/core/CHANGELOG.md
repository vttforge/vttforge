# @vttforge/core

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
