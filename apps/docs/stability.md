---
title: Stability and versioning
---

What you can build on, and what may move.

## Before 1.0

Every package is below `1.0.0`. Under semver that means a **minor may break
you**. In this project it regularly does, because the API is still meeting
real systems and modules for the first time.

Pin exactly, or accept that `pnpm update` can require code changes:

```jsonc
{ "dependencies": { "@vttforge/core": "0.8.0" } }
```

A caret on a `0.x` version pins the minor (`^0.8.0` means `>=0.8.0 <0.9.0`),
so it is narrower than people expect.

## After 1.0

- No breaking change in a minor.
- A breaking change means a major, and a major comes with a migration note
  saying what to change, not only what changed.
- Anything marked `@experimental` is exempt. It says so in its own doc comment,
  and the changelog says so when it moves.

## Deprecation

A stable export that is going away:

1. Gains an `@deprecated` tag naming its replacement, in a minor.
2. Keeps working for **two more minors**, at least 90 days.
3. Goes in the next major.

If there is no replacement, the tag says that too, and why nothing replaces it.

## What each package promises

| Package | Runs in | Stability |
|---|---|---|
| `@vttforge/core` | Browser, inside Foundry | Shaping. The base factories and `InferSchema` have moved several times. |
| `@vttforge/cli` | Node | The command surface is settling; the scaffolded output still changes. |
| `@vttforge/vite-plugin` | Node | The build contract is the most settled thing here. |
| `@vttforge/styles` | Browser | Token names are stable; component CSS is not. |
| `@vttforge/testing` | Node and browser | New. Expect it to move. |
| `@vttforge/dev-module` | Browser, inside Foundry | Internal to the dev loop; not an API. |
| `@vttforge/types` | Types only | Small and deliberate. The Foundry members the base factories declare; grows as consumers need more. |

## What is in the public surface

The check on every export is **reachability**. An export is in the public
surface if the documented API leads you to it. If the only way to reach it is
importing it by name, it is not.

A type reached through a signature is part of the contract even if you never
write its name. `SystemRegistration` is the argument to `registerSystem`, and
`InferSchema` resolves through the field-type triples. Those follow the policy
above.

| Package | Exports | In the contract | Reachable only by direct import |
|---|---|---|---|
| `@vttforge/core` | 105 | 105 | 0 |
| `@vttforge/testing` | 14 | 14 | 0 |
| `@vttforge/vite-plugin` | 2 | 2 | 0 |
| `@vttforge/types` | 4 | 4 | 0 |
| `@vttforge/cli` | 60 | 27 | 33 |

`core`, `testing`, `vite-plugin` and `types` are clean: they export nothing
that the documented API does not already lead you to.

`@vttforge/cli` is not. Its product is a binary, and its index grew to
re-export the pieces the commands are built from. Each of those carries a tag
in place, and your editor shows it:

- **Supported**: `runInit`, and the audit surface (`runAudit`,
  `runManifestRules`, `runSourceRules`, `formatReport`, and the `RuleFn` /
  `RuleResult` / `Severity` types). `create-vttforge` calls `runInit`, and the
  audit rules are a deliberate extension point: write your own `RuleFn` and
  hand it to the same reporter the CLI uses.
- **`@experimental`**: plausibly useful to a tool author, but nobody has asked,
  so the shape is a guess. Can change in a minor.
- **`@internal`**: implementation detail that reached the index by accident
  (`substitute`, `templatesRoot`, `configPath`, the symlink and Vite-spawning
  helpers, and the rest). Nothing outside the package imports them. They keep
  working until the next major, and importing one is not supported today.

If you are importing something tagged `@internal` and it is the only way to do
what you need, open an issue. That is the signal that turns one into a
supported export.

## Node

Only the packages that run in Node declare an engine floor. `@vttforge/core`,
`@vttforge/styles`, `@vttforge/types` and `@vttforge/dev-module` run in the
browser inside Foundry and never touch Node, so they declare none.

| Package | Node |
|---|---|
| `@vttforge/cli` | >= 26 |
| `@vttforge/vite-plugin` | >= 26 |
| `@vttforge/testing` | >= 22; its Quench half runs in the browser |
| everything else | not applicable |

## Foundry

Every package targets **Foundry v14+**. v13 and v12 are explicit non-goals: v14
removed the flag that governed Active Effect transferral and keys
`CONFIG.statusEffects` by id, and the SDK follows the new shape rather than
carrying both.

## How this is checked

The [transparency page](/transparency) lists what every change passes before
it ships, and what the SDK does and does not do on your machine.

## Peer dependencies

`@vttforge/vite-plugin` peers on `vite`. Nothing else declares a peer, and
nothing else should. A package that needs something should depend on it.
