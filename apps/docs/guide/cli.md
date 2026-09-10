# CLI reference

```bash
pnpm create vttforge my-system        # or: npx @vttforge/cli init my-system
```

## `vttforge init`

```bash
vttforge init <name> [--type system|module] [--lang ts|js]
                     [--id <id>] [--title <t>] [--description <d>]
                     [--author <a>] [--license <spdx>]
                     [--yes] [--no-install] [--no-git]
```

Writes a runnable project into `<name>/` from one of four templates. It asks
for anything not passed; `--yes` takes the defaults instead, so the command
works in CI. It installs with the package manager that invoked it: `pnpm`, `npm`, `bun`
or `yarn`.

| Template | What you get |
|---|---|
| `system-ts` / `system-js` | One Actor type and one Item type on typed data models, a tabbed character sheet with drag-drop, a migration runner, a setting |
| `module-ts` / `module-js` | A `note` Item sub-type on `registerModule`, its sheet, an `@Note[id]` enricher, a setting, a public API |

The TypeScript templates typecheck against the published `@vttforge/core`
out of the box.

## `vttforge dev`

```bash
vttforge dev [--foundry-data <path>] [--port <n>]
```

Builds once, links `dist/` into Foundry's data directory, installs the
`@vttforge/dev-module` companion, and watches. See [the dev
loop](/guide/dev-loop) for what reloads in place.

The first run asks where Foundry keeps its data and saves the answer to
`.vttforge/config.json`. `--foundry-data` (alias `--data-dir`) or the
`FOUNDRY_DATA_DIR` variable overrides it. `--port` moves the hot-reload
bridge off `31313`.

## `vttforge build`

Runs the production build and writes `<id>-<version>.zip` at the project
root, manifest at the top level, which is what foundryvtt.com expects.
`LICENSE`, `README.md` and `CHANGELOG.md` go in when present.

The scaffold's release workflow runs this on every tag and attaches the zip
and the manifest to a GitHub Release.

## `vttforge lint`

```bash
vttforge lint [dir] [--fix] [--no-audit] [--strict]
```

Biome over the project, then `vttforge audit`. Biome ships as a dependency
of the CLI, so a scaffolded project lints and formats without installing or
configuring anything: the templates' `lint` and `format` scripts call this.

The config Biome runs with is `lint/vttforge-biome.json` in the CLI
package (the recommended rules, the house formatting, and the Foundry
globals such as `game`, `canvas`, `CONFIG`, `Hooks` declared). A
`biome.json` or `biome.jsonc` at the project root replaces it outright, so a
project that wants to change a rule copies the shipped file to `biome.json`
and edits it.

`--fix` writes the safe fixes and formats the files; without it the run only
reports. `--no-audit` skips the audit; `--strict` passes through to it. The
exit code is non-zero when either half fails.

## `vttforge audit`

```bash
vttforge audit [dir] [--json] [--strict]
```

Checks the manifest and the source against the v14 breakages that fail
quietly: nothing in the console, a feature that just does not work, or a
deprecation warning that turns into a removal two versions from now.

| Code | Severity | What it catches |
|---|---|---|
| `VTTF-AUDIT-001` | HIGH | `flags.hotReload` in the wrong shape, so hot reload is silently off |
| `VTTF-AUDIT-002` | HIGH | Top-level `gridDistance` / `gridUnits`; v14 dropped the shim, so the system falls back to the default grid with no warning |
| `VTTF-AUDIT-003` | LOW | `styles` as an array of strings, the v12 shape |
| `VTTF-AUDIT-004` | MEDIUM | An `HTMLField` or `FilePathField` not listed in `documentTypes`; the server only sanitises declared paths |
| `VTTF-AUDIT-005` | MEDIUM | A `TypeDataModel` without `prepareBaseData`; Active Effects apply between it and `prepareDerivedData` |
| `VTTF-AUDIT-006` | LOW | An `_addDataFieldMigrations` override; the signature is not what it looks like |
| `VTTF-AUDIT-007` | MEDIUM | `primaryTokenAttribute` / `secondaryTokenAttribute` not pointing at a `{ value, max }` field, in a data model or in `template.json`; the token bar degrades with no error |
| `VTTF-AUDIT-008` | HIGH | A sheet template that opens its own `<form>` when the sheet base already is one; the fields belong to the inner form and every edit is dropped on close |
| `VTTF-AUDIT-009` | MEDIUM | A subtype declared in `documentTypes` with no `TYPES` label; Foundry prints the raw key as the type's name |
| `VTTF-AUDIT-010` | HIGH | A `template.json` listing a type whose `documentTypes` entry declares `htmlFields`, `filePathFields` or `gmOnlyFields`; Foundry replaces the entry and drops them |
| `VTTF-AUDIT-011` | HIGH | A bare `mergeObject`, `getProperty`, `deepClone` and friends, `Math.clamped`, or `game.template`; v14 removed the shims, so the call throws the first time it runs |
| `VTTF-AUDIT-012` | MEDIUM | A `-=key` or `==key` update key; replaced by `_del` and `_replace`, removed in v16 |
| `VTTF-AUDIT-013` | MEDIUM | `rollMode`, `CONFIG.Dice.rollModes` or `DICE_ROLL_MODES`; replaced by `messageMode` and `CONFIG.ChatMessage.modes`, removed in v16 |
| `VTTF-AUDIT-014` | MEDIUM | `CONFIG.statusEffects = [...]`; the setter empties the collection first and drops what other packages added |
| `VTTF-AUDIT-015` | MEDIUM | `legacyTransferral`; v14 removed the flag and applies Item effects in place |
| `VTTF-AUDIT-016` | MEDIUM | `CONST.ACTIVE_EFFECT_MODES`; changes now live in `system.changes` with a string `type`, removed in v16 |
| `VTTF-AUDIT-017` | MEDIUM | The jQuery `renderChatMessage` hook; removed in v15, `renderChatMessageHTML` hands the element |
| `VTTF-AUDIT-018` | LOW | A class extending an Application v1 base (`Application`, `FormApplication`, `Dialog`, `ActorSheet`, `ItemSheet`); removed in v16 |
| `VTTF-AUDIT-019` | MEDIUM | A bare v13 global alias (`renderTemplate`, `ActorSheet`, `Actors`, `TextEditor`, `ChatLog`, ...); it warns on v14 and throws on v15, and the namespaced path is the same object |
| `VTTF-AUDIT-020` | HIGH | A release workflow that zips the checkout of a project that builds to `dist/`, or builds and then zips the source tree; the published package has no entry file and no world starts on it |
| `VTTF-AUDIT-021` | HIGH | A template that calls `{{#select}}` or `{{colorPicker}}`; v14 removed both, so the template throws "Missing helper" and whatever renders it never opens |

Rule 020 only fires for a project on the vite plugin (or a `build` script that
runs vite), and only for a workflow that publishes a zip or a manifest. Rules
011 to 019 blank out comments before they match, so a call quoted in a
JSDoc block is not a finding. Rules 004 and 007 read the schema whether it is a `static defineSchema()` or
a function handed to `BaseTypeDataModel`, and scope it to the class
registered for that document. Rule 008 only looks at templates a
`BaseActorSheet` or `BaseItemSheet` names in its `PARTS`, since those are the
bases that set `tag: 'form'`. Rule 009 accepts a label written either nested
or flattened, because Foundry reads both.

The exit code is non-zero on a HIGH finding. `--strict` makes any finding
fail, for CI. `--json` prints the report as data.

## `vttforge migrate`

```bash
vttforge migrate [dir] [--write] [--json]
```

Rewrites a v13 project for v14. Without `--write` it only reports what it
would change, one line per edit, so a rewrite that landed inside a string or a
comment is seen before it is written. Run it, read the report, run it again
with `--write`, then run `vttforge audit`.

| Rewrite | Before | After |
|---|---|---|
| Removed globals | `mergeObject(a, b)`, `Math.clamped(x, 0, 1)` | `foundry.utils.mergeObject(a, b)`, `Math.clamp(x, 0, 1)` |
| v13 aliases | `renderTemplate(p, d)`, `extends ActorSheet`, `Actors.registerSheet(...)` | `foundry.applications.handlebars.renderTemplate(p, d)`, `extends foundry.appv1.sheets.ActorSheet`, `foundry.documents.collections.Actors.registerSheet(...)` |
| Data operators | `'-=system.bio': null`, `` [`flags.${id}.-=old`]: null ``, `"==system.stats": {...}` | `'system.bio': _del`, `` [`flags.${id}.old`]: _del ``, `"system.stats": _replace({...})` |
| | `performDeletions: true`, `foundry.utils.objectsEqual` | `applyOperators: true`, `foundry.utils.equals` |
| Roll modes | `rollMode: 'gmroll'`, `game.settings.get('core', 'rollMode')` | `messageMode: 'gm'`, `game.settings.get('core', 'messageMode')` |
| | `rollMode: chosen` | `messageMode: Roll._mapLegacyRollMode(chosen)` |
| | `CONFIG.Dice.rollModes`, `CONST.DICE_ROLL_MODES.PRIVATE` | `CONFIG.ChatMessage.modes`, `"gm"` |
| Context menus and header controls | `name`, `condition`, `callback` | `label`, `visible`, `onClick` |
| Active Effects | `mode: CONST.ACTIVE_EFFECT_MODES.ADD` | `type: "add"` |
| Status effects | `CONFIG.statusEffects = list;` | `for (const effect of list) CONFIG.statusEffects[effect.id] = effect;` |
| Gone in v14 | `CONFIG.ActiveEffect.legacyTransferral = ...`, `activeEffect: { legacyTransferral }`, `Actors.unregisterSheet('core', ...)` | removed |
| Manifest | no `type`, `compatibility` below 14 | `"type": "system"` or `"module"`, `minimum` and `verified` at `"14"` |

What it will not decide, it reports as "needs a decision": a `game.template`
read (which becomes `game.model` or a `documentTypes` lookup depending on what
was read), the parameter list of a renamed `callback` (`onClick` receives
`(event, target)`), a `renderChatMessage` handler (the hook is removed in v15
and its replacement hands an element, not a jQuery object), a root-level
`changes` array on an effect (now `system.changes`), a `compatibility.maximum`
below 14, and the flat `gridDistance` / `gridUnits` keys. Minified bundles
(`*.min.js`) are vendored libraries and are skipped, by the audit too.

The rewrites are text-based, like the audit rules they mirror. Comments are
left alone. A match inside a string literal is rewritten too; the preview is
where that is caught.

### `--data-models`

```bash
vttforge migrate --data-models [--style plain|sdk] [--lang js|ts] [--write]
```

`template.json` is deprecated since v14 and removed in v16. Its replacement
is a data model per type, registered on `CONFIG.<Document>.dataModels`, with
the type names declared under `documentTypes` in the manifest. The template
already says what each field is, so this reads it and writes the classes:
one `scripts/data/<document>/<type>-data.mjs` per type, and a
`templates.mjs` beside them with one function per shared template, which the
types that listed it spread. A number becomes a `NumberField` (`integer`
when the default is one), a boolean a `BooleanField`, a string a
`StringField` (an `HTMLField` when the key reads like rich text), an object a
`SchemaField`, an array an `ArrayField`. What it had to guess, it says: an
empty array, a `null`, a template a type lists that the file does not
define.

`--style plain` writes classes on `foundry.abstract.TypeDataModel` and
needs nothing installed; `--style sdk` writes them on `BaseTypeDataModel`
from `@vttforge/core`, which types `this` inside `prepareDerivedData`. The
report ends with the `documentTypes` block to paste into the manifest and
the registration to add at `init`. An existing file is never overwritten.
Delete `template.json` once every type has a model: while it exists, Foundry
resets each listed type's `documentTypes` entry on every start.

### `--sheets`

```bash
vttforge migrate --sheets [--lang js|ts] [--write]
```

Application v1 classes still run on v14 and are removed in v16. `--sheets`
writes, next to each such class, a file with the same name and `.v2` before
the extension: an `ActorSheet` / `ItemSheet` lands on `BaseActorSheet` /
`BaseItemSheet` from `@vttforge/core`; a `FormApplication` / `Application`
lands on `HandlebarsApplicationMixin(ApplicationV2)` with no SDK import. The
original is not touched; the report says where to point `registerSheet`, or
whatever constructs the app, once you have read the result.

What is carried over mechanically: `defaultOptions` (classes, size,
`resizable`, `submitOnChange`) as `DEFAULT_OPTIONS`; `tabs` as `TABS` with
the ids read from the template; `dragDrop` as `DRAG_DROP`; `template` as
`PARTS`; `getData` as `_prepareContext` with `actor`/`item`, `system` and
`items` set on the context; every `html.find(sel).click(handler)` as an
`actions` entry named after the selector, with the handler's signature
changed to `(event, target)`; other events (`dblclick`, `change`, ...) as
listeners in `_onRender`; `_onDropItem` / `_onDropActor` as `onDropItem` /
`onDropActor`, with the old payload argument read as `item.toDragData()` and
the old `super._onDropItem` call as the `createEmbeddedDocuments` it used to
make; `event.currentTarget`, `$(...)`, `.data(...)`, `.parents(...)` and `html.find`
as their DOM equivalents (`html.find` becomes `this.element.querySelectorAll`, so
`.length` and `[0]` keep working); `Dialog.confirm` as `DialogV2.confirm`;
`new Dialog({...}).render(true)` as `DialogV2.wait({...})` with the `buttons`
object as a list (`default` marks the button, the `<i>` icon becomes its
class) and each `(html) => ...` callback on the `(event, button, dialog)`
signature with `html[0]` and `html.find` read from `dialog.element`;
`Dialog.prompt` as `DialogV2.prompt`. On a `FormApplication`, `id`, `title`
and `closeOnSubmit` move into `DEFAULT_OPTIONS` (`tag: 'form'`, `window`,
`form.handler`) and `_updateObject(event, data)` becomes the static
`formHandler(event, form, formData)` with `data` read from
`formData.object`.

What is left as a `// TODO(migrate)` line, and listed in the report with its
line number: a `new Dialog` whose options are not a plain literal, a
`_updateObject` on a document sheet, jQuery calls with no plain DOM
equivalent, `this.object` on a FormApplication, a `get template()` that picks the template at runtime, tab
ids that were not found in the template, and the v1 lifecycle overrides
(`setPosition`, `_getHeaderButtons`, `_render`, ...) that ApplicationV2
replaces with its own hooks.

The generated file is a draft to read, not code to trust: run
`vttforge lint --fix` on it, then work through the `TODO(migrate)` lines. On
a real v1 system the hand edits were the per-type template choice, the root
`<form>` in each sheet template, and one `setPosition` override; everything
else ran as generated.

The templates the class names get `data-action="<name>"` on the elements
that matched each selector, `data-action="vttforgeTab"` and `data-group` on
the tab links, and `data-group` on the panes. A root `<form>` is reported and
left in place: the old class still renders that template.
