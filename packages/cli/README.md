# @vttforge/cli

VTTForge CLI — scaffolding, dev loop, and release builds for Foundry VTT v13+ systems and modules.

## Commands

```bash
vttforge init <name> [--type system|module] [--lang ts|js] [--no-install] [--no-git]
vttforge dev  [--foundry-data <path>]
vttforge build
```

- `vttforge init` — interactive scaffolder. Asks for package id, title, author, license, Foundry compatibility version, and writes a runnable system/module starter into `<name>/`. Detects the calling package manager (`pnpm`, `npm`, `bun`, `yarn`) via `npm_config_user_agent` and offers to install deps + `git init`. Equivalent UX from `pnpm create vttforge <name>` via the `create-vttforge` package.
- `vttforge dev` — one-shot `vite build`, then symlink `dist/` into your Foundry user-data directory under `Data/<systems|modules>/<id>/`, then `vite build --watch` with inherited stdio. Cleans up the symlink on `Ctrl-C`. First run prompts for the Foundry data dir and saves the choice to `.vttforge/config.json`; subsequent runs skip the prompt. Override with `--foundry-data <path>` (alias: `--data-dir`) or set `FOUNDRY_DATA_DIR` in your environment.
- `vttforge build` — production `vite build` followed by `<id>-<version>.zip` emission at the project root. Pulls `LICENSE`, `README.md`, and `CHANGELOG.md` from the project root into the zip when present.

## Library exports

`@vttforge/cli` also exposes its internals for consumers building higher-level tooling:

```ts
import {
  runInit, runDev, runBuild,
  scaffold, substitute, templatesRoot,
  resolveFoundryDataDir, foundryPackagesDir,
  readManifest, emitZip,
  createLink, removeLink, readLinkTarget,
  resolveViteInvocation, runViteBuildOnce, spawnViteWatch,
  detectPackageManager, detectProjectPackageManager, execInvocation, installCommand,
} from '@vttforge/cli';
```

## Foundry-aware HMR

Run Foundry with `--hotReload` (e.g. `foundryvtt --hotReload`) and `vttforge dev` becomes a live-reload loop without further setup: Foundry's built-in chokidar watcher follows the symlink, and its dispatcher swaps CSS / Handlebars / JSON files in place when vite re-emits them.

## Stack

Citty (commands) + Clack (prompts) + Archiver (zip).
