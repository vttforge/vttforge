# @vttforge-examples/simple-system

Minimal reference Foundry VTT **system** built against `@vttforge/core` + `@vttforge/styles`. Doubles as the smoke-test consumer for the SDK's APIs.

> **Status:** v0.0.0 placeholder. Real Foundry manifest, data models, and sheets land in v0.1.0.

## What this proves (once filled in)

- `@vttforge/core` can be imported from a real Foundry system manifest.
- `BaseTypeDataModel` declares a working Actor/Item schema with `InferSchema<T>` typing.
- `SystemConfig` replaces hardcoded settings IDs.
- `registerSystem()` replaces the `Hooks.once("init")` registration block.
- `@vttforge/styles/index.css` composes correctly with Foundry v13's cascade layers.
