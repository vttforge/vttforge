# {{TITLE}}

{{DESCRIPTION}}

A Foundry VTT module built on [VTTForge](https://github.com/vttforge/vttforge) — uses `SystemConfig` from `@vttforge/core` for typed settings, ships an example hook listener, and exposes a small public API on `game.modules.get("{{ID}}").api`.

> **Note** — VTTForge is currently in pre-release and not yet published to npm. Dependencies in `package.json` will resolve once VTTForge ships its first public release.

## Quick start

```bash
pnpm install
pnpm build         # bundles dist/ — the deployable artefact
pnpm dev           # vite build --watch
```

Symlink `dist/` into your Foundry data directory:

```bash
# macOS
ln -s "$(pwd)/dist" "$HOME/Library/Application Support/FoundryVTT/Data/modules/{{ID}}"

# Linux
ln -s "$(pwd)/dist" "$HOME/.local/share/FoundryVTT/Data/modules/{{ID}}"

# Windows (PowerShell, as admin)
New-Item -ItemType SymbolicLink -Path "$env:APPDATA\FoundryVTT\Data\modules\{{ID}}" -Target "$(pwd)\dist"
```

Enable the module in any world.

## What's inside

| Path | Purpose |
|---|---|
| `module.json` | Manifest |
| `scripts/main.ts` | Entry point — settings registration, hook listeners, public API |
| `styles/main.css` | Stylesheet, scoped under `.{{ID}}` |
| `lang/en.json` | Localization strings |

## Public API

The module exposes its API on `game.modules.get("{{ID}}").api`:

```ts
const api = game.modules.get("{{ID}}").api;
api.greet("world");                   // returns "Hello, world!"
api.getSetting("showWelcome");        // returns the current value
```

Extend `scripts/main.ts` to add real methods — the example exists to show the registration pattern.

## Releasing to Foundry

Tag-push triggers `.github/workflows/release.yml` to build, zip, and attach `{{ID}}-<version>.zip` + `dist/module.json` to a GitHub Release. Point Foundry at the `latest/download/module.json` URL.

```bash
git tag v0.1.0
git push --tags
```

## License

{{LICENSE}} © {{YEAR}} {{AUTHOR}}
