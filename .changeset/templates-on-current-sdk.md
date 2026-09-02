---
"@vttforge/cli": patch
---

Rewrite the four `init` templates against the current SDK.

The scaffolds still showed the patterns the SDK exists to replace: `as any` on the sheet bases, sheets registered by hand with `Actors.registerSheet`, untyped data models, and module templates that never called `registerModule`. A project created today contradicted the docs from its first file.

- `system-ts` / `system-js`: data models use the typed `BaseTypeDataModel(defineSchema)` factory; sheets are declared in `registerSystem({ sheets })` with stable ids; each sheet narrows `this.document` once in an `actor` / `item` getter; `tsconfig` turns on `noImplicitOverride`.
- `module-ts` / `module-js`: built on `registerModule`. The scaffold adds a `note` Item sub-type (declared under `documentTypes`, keyed with `moduleSubType`), a sheet on `BaseItemSheet`, an `@Note[id]` enricher, a setting and a public API.
- READMEs no longer say the packages are unpublished.
- `vttforge audit` rules VTTF-AUDIT-004 and VTTF-AUDIT-007 now attribute a schema declared in a named factory (`class X extends BaseTypeDataModel(defineSchema)`) to the class that uses it. Before, a system on the typed factory was flagged for token attributes its schema did declare.
- The template test now typechecks the TypeScript variants against the workspace `@vttforge/core`, so a template that drifts from the SDK fails in CI.
