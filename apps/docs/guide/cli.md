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
| `VTTF-AUDIT-007` | MEDIUM | `primaryTokenAttribute` / `secondaryTokenAttribute` not pointing at a `{ value, max }` field; the token bar degrades with no error |
| `VTTF-AUDIT-008` | HIGH | A sheet template that opens its own `<form>` when the sheet base already is one; the fields belong to the inner form and every edit is dropped on close |
| `VTTF-AUDIT-009` | MEDIUM | A subtype declared in `documentTypes` with no `TYPES` label; Foundry prints the raw key as the type's name |
| `VTTF-AUDIT-010` | HIGH | A `template.json` listing a type whose `documentTypes` entry declares `htmlFields`, `filePathFields` or `gmOnlyFields`; Foundry replaces the entry and drops them |
| `VTTF-AUDIT-011` | HIGH | A bare `mergeObject`, `getProperty`, `deepClone` and friends, `Math.clamped`, or `game.template`; v14 removed the shims, so the call throws the first time it runs |
| `VTTF-AUDIT-012` | MEDIUM | A `-=key` or `==key` update key; replaced by `_del` and `_replace`, removed in v16 |
| `VTTF-AUDIT-013` | MEDIUM | `rollMode`, `CONFIG.Dice.rollModes` or `DICE_ROLL_MODES`; replaced by `messageMode` and `CONFIG.ChatMessage.modes`, removed in v16 |
| `VTTF-AUDIT-014` | MEDIUM | `CONFIG.statusEffects = [...]`; the setter empties the collection first and drops what other packages added |
| `VTTF-AUDIT-015` | MEDIUM | `legacyTransferral`; v14 removed the flag and applies Item effects in place |
| `VTTF-AUDIT-016` | MEDIUM | `CONST.ACTIVE_EFFECT_MODES`; changes now live in `system.changes` with a string `type`, removed in v16 |

Rules 011 to 016 blank out comments before they match, so a call quoted in a
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
| Data operators | `'-=system.bio': null`, `"==system.stats": {...}` | `'system.bio': _del`, `"system.stats": _replace({...})` |
| | `performDeletions: true`, `foundry.utils.objectsEqual` | `applyOperators: true`, `foundry.utils.equals` |
| Roll modes | `rollMode: 'gmroll'`, `game.settings.get('core', 'rollMode')` | `messageMode: 'gm'`, `game.settings.get('core', 'messageMode')` |
| | `CONFIG.Dice.rollModes`, `CONST.DICE_ROLL_MODES.PRIVATE` | `CONFIG.ChatMessage.modes`, `"gm"` |
| Context menus and header controls | `name`, `condition`, `callback` | `label`, `visible`, `onClick` |
| Active Effects | `mode: CONST.ACTIVE_EFFECT_MODES.ADD` | `type: "add"` |
| Status effects | `CONFIG.statusEffects = list;` | `for (const effect of list) CONFIG.statusEffects[effect.id] = effect;` |
| Gone in v14 | `CONFIG.ActiveEffect.legacyTransferral = ...`, `activeEffect: { legacyTransferral }`, `Actors.unregisterSheet('core', ...)` | removed |
| Manifest | no `type`, `compatibility` below 14 | `"type": "system"` or `"module"`, `minimum` and `verified` at `"14"` |

What it will not decide, it reports as "needs a decision": a `game.template`
read (which becomes `game.model` or a `documentTypes` lookup depending on what
was read), a `rollMode` whose value is an expression, the parameter list of a
renamed `callback` (`onClick` receives `(event, target)`), a root-level
`changes` array on an effect (now `system.changes`), a `compatibility.maximum`
below 14, and the flat `gridDistance` / `gridUnits` keys.

The rewrites are text-based, like the audit rules they mirror. Comments are
left alone. A match inside a string literal is rewritten too; the preview is
where that is caught.
