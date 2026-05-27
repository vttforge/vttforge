---
'@vttforge/cli': minor
---

feat(cli): ship `vttforge audit` — scan for seven v13 footguns

Closes the third and final slice of Track 1. `vttforge audit [path]` scans
a system or module project root and reports findings against the
`VTTF-AUDIT-NNN` catalog of v13 manifest + code footguns.

**Rules implemented:**

| ID | Severity | Scope | What it catches |
|---|---|---|---|
| `VTTF-AUDIT-001` | HIGH | manifest | `flags.hotReload` as array (v12) or missing required `extensions` key. Silently disables HMR. |
| `VTTF-AUDIT-002` | MEDIUM | manifest | Top-level `gridDistance` / `gridUnits` (v12) instead of `grid: {type, distance, units, diagonals}` (v13). Auto-migrates today, removed in v14. |
| `VTTF-AUDIT-003` | LOW | manifest | `styles: ["foo.css"]` (string array) instead of `[{src, layer?}]` (v13). Auto-migrates but loses cascade-layer control. |
| `VTTF-AUDIT-004` | MEDIUM | manifest + source | `HTMLField` / `FilePathField` declared in TypeDataModel schema but missing from `documentTypes.<Doc>.<subtype>.htmlFields` / `.filePathFields`. Server only sanitises declared paths → XSS risk on undeclared. Subtype-aware via `CONFIG.*.dataModels` + `registerSystem({ actorDataModels })` parsing; full-path matching through SchemaField nesting. |
| `VTTF-AUDIT-005` | MEDIUM | source | `class X extends TypeDataModel` without a `prepareBaseData()` method. Active Effects apply between base and derived; consumers see uninitialised fields. Checked per class. |
| `VTTF-AUDIT-006` | LOW | source | `_addDataFieldMigrations()` override on a TypeDataModel subclass. Real API is `static migrateData(source)` calling singular `super._addDataFieldMigration(...)`. |
| `VTTF-AUDIT-007` | MEDIUM | manifest + source | `primaryTokenAttribute` / `secondaryTokenAttribute` doesn't resolve to a `SchemaField({ value, max })` at the exact dot-path. Nested paths like `attributes.hp` are traversed. |

**CLI surface:**

```bash
vttforge audit                  # scan cwd, print markdown
vttforge audit ./my-project     # scan a different path
vttforge audit --json           # machine-readable JSON for CI piping
vttforge audit --strict         # exit 1 on any finding (default: HIGH only)
```

**Exit codes:**
- `0` — clean, or only MEDIUM/LOW findings (advisory mode)
- `1` — at least one HIGH finding, or any finding in `--strict`

Uses `process.exitCode` (not `process.exit`) so piped JSON reports aren't
truncated on failing CI runs.

**Implementation notes:**

- Pure read-only — never modifies the source tree.
- Regex-based source scanning. The trade-off is occasional false negatives
  on heavily-formatted code; an AST dependency (TypeScript compiler) would
  add ~30MB to the CLI for seven pattern checks. Rule 007's
  `SchemaField({value, max})` detection uses a balanced-brace scan plus a
  depth-tracking top-level-key extractor to correctly distinguish
  SchemaField siblings from nested constructor options.
- Rule 005 distinguishes `extends TypeDataModel` (direct, flagged) from
  `extends BaseTypeDataModel()` (VTTForge factory, safe) via the `\b`
  word boundary, and is checked per class so a sibling subclass without
  the hook doesn't hide behind a sibling that has it.
- Rule 004 takes the FULL schema path through enclosing SchemaField
  wrappers and matches exactly against declared paths (with `system.`
  prefix stripped — Foundry convention).

**Tests:** 247 passing (+13 new test files, ~110 new test cases). Integration
suite scaffolds each of the four templates and runs the audit against the
output — they must report zero findings, otherwise either a template
regressed or the audit grew a false positive.
