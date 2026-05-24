# @vttforge-examples/simple-system

Minimal Foundry v13 system built on `@vttforge/core` + `@vttforge/styles`. Doubles as the smoke test that the SDK's v0.0.1 API surface (the `registerSystem` boilerplate-eliminator + `SystemConfig` settings wrapper) imports cleanly and resolves against the workspace package.

> **Status:** v0.0.0 — wires `registerSystem({ id, combat, onAfterInit })` and `SystemConfig.register()` against the v0.0.1 core. Real Actor/Item TypeDataModels and `HandlebarsApplicationMixin` sheets land in v0.1.0.

## What this proves today

- The `@vttforge/core` exports map resolves from a workspace consumer (`workspace:*`).
- `registerSystem` produces a runnable Foundry `init` callback wired via `Hooks.once`.
- `SystemConfig` registration runs inside `onAfterInit` (after the core CONFIG mutations).
- The published CSS layer (`@vttforge/styles`) layers correctly on top of Foundry v13's cascade order.

## Layout

```
scripts/main.mjs      ← registerSystem(...) entry
styles/example.css    ← @import '@vttforge/styles' + per-system layer
lang/en.json          ← localisation stub
system.json           ← Foundry v13 manifest (id: vttforge-example)
```
