# @vttforge/core

Core runtime utilities for VTTForge — the modern SDK for building [FoundryVTT](https://foundryvtt.com) v13+ systems and modules.

> **Status:** v0.0.1 placeholder. Real APIs land in v0.1.0.

## Planned API surface (v0.1.0)

- `BaseTypeDataModel` — eliminates stub `migrateData()` and centralises `InferSchema<T>` inference.
- `BaseActorSheet` / `BaseItemSheet` — declarative replacements for `_getTabs`, DragDrop wiring, `_onEditImage`, `_onDrop`.
- `SystemConfig` — typed wrapper around `game.settings`, eliminates hardcoded system-ID strings.
- `registerSystem()` — one-call init that replaces the manual `Hooks.once("init", …)` block.
- `createMigrationRunner` — declarative data migrations with version gates.
- Error registry — `VttfError` + central `VTTF-NNNN` codes with `docsUrl` pointing at `vttforge.dev/errors/`.

See [PRD §7](../../plans/PRD.md) for the full design (planning doc, not shipped publicly).
