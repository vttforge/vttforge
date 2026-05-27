---
'@vttforge/cli': minor
---

feat(cli): ship `vttforge dev` and `vttforge build`

`@vttforge/cli` graduates from "scaffold-only" to a full local dev loop.

**`vttforge dev`** — single-process dev experience for system/module work:

1. Runs `vite build` once to populate `dist/` and emit the manifest.
2. Reads the manifest, detects whether the project is a system or module.
3. Resolves the Foundry user-data directory via a four-step chain:
   `--data-dir` flag → `FOUNDRY_DATA_DIR` env → project's
   `.vttforge/config.json` → OS default with interactive first-run
   prompt that saves the choice. OS detection honors `XDG_DATA_HOME`
   on Linux and `%LOCALAPPDATA%` on Windows.
4. Drops a symlink at `<dataRoot>/Data/<systems|modules>/<id>` pointing
   at the project's `dist/`. Cross-platform — `junction` on Windows so
   the call succeeds without Developer Mode or admin elevation; safety
   rails refuse to overwrite real files/directories.
5. Spawns `vite build --watch` with inherited stdio, blocks until
   SIGINT/SIGTERM, then cleans up the symlink and kills vite.

When Foundry runs with `--hotReload`, file saves trigger live reload
without a browser refresh — chokidar follows the symlink and Foundry's
built-in dispatcher swaps CSS/HBS/JSON in place. No additional client
wiring needed in this release.

**`vttforge build`** — produces a foundryvtt.com-ready release zip:

1. Cleans `dist/`, runs `vite build` in production mode.
2. Reads the manifest for `id` + `version`.
3. Emits `<id>-<version>.zip` at the project root with contents at the
   zip root (no wrapper folder), pulling in `LICENSE`, `README.md`, and
   `CHANGELOG.md` from the project root when present and not already
   inside `dist/`.

**Templates updated** — all four (system-ts, system-js, module-ts,
module-js) now ship `pnpm dev` / `pnpm build` aliased to the new
commands, drop the manual `ln -s` instructions, and gain
`@vttforge/cli` as a devDependency. The release workflow continues to
invoke vite directly so URL injection happens after build but before
zipping; it now validates tag-derived version strings and passes every
GitHub-supplied value via `env:` instead of inline interpolation to
close a command-injection vector that a malicious tag push could
otherwise exploit.

**Internals exposed** — `runDev`, `runBuild`, `emitReleaseZip`,
`setupDevSymlink`, `resolveFoundryDataDir`, `createLink`/`removeLink`,
`readManifest`, and `emitZip` are all importable from `@vttforge/cli`
for consumers building higher-level tooling.

**Dependencies** — adds `archiver` (zip emission) pinned to `^7` since
archiver v8 went ESM-only with renamed exports that DefinitelyTyped
hasn't caught up to yet.
