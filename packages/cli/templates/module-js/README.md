# {{TITLE}}

{{DESCRIPTION}}

A Foundry VTT module built on [VTTForge](https://github.com/vttforge/vttforge) — uses `SystemConfig` from `@vttforge/core` for typed settings, ships an example hook listener, and exposes a small public API on `game.modules.get("{{ID}}").api`.

> **Note** — VTTForge is currently in pre-release and not yet published to npm. Dependencies in `package.json` will resolve once VTTForge ships its first public release.

## Quick start

```bash
pnpm install
pnpm dev      # vite build --watch + auto-symlinks dist/ into Foundry's Data
pnpm build    # one-shot build + emits {{ID}}-<version>.zip for foundryvtt.com
```

`pnpm dev` (`vttforge dev` under the hood) auto-detects your Foundry user-data
directory on the first run, prompts you to confirm it, and saves the choice to
`.vttforge/config.json` for next time. Override with `--data-dir <path>` or set
`FOUNDRY_DATA_DIR` in your environment.

Run Foundry with `--hotReload` to pick up changes without refreshing the page.
Then enable **{{TITLE}}** in any world.

## What's inside

| Path | Purpose |
|---|---|
| `module.json` | Manifest |
| `scripts/main.mjs` | Entry point — settings registration, hook listeners, public API |
| `styles/main.css` | Stylesheet, scoped under `.{{ID}}` |
| `lang/en.json` | Localization strings |

## Public API

The module exposes its API on `game.modules.get("{{ID}}").api`:

```js
const api = game.modules.get("{{ID}}").api;
api.greet("world");                   // returns "Hello, world!"
api.getSetting("showWelcome");        // returns the current value
```

Extend `scripts/main.mjs` to add real methods — the example exists to show the registration pattern.

## Releasing to Foundry

Tag-push triggers `.github/workflows/release.yml` to build, zip, and attach `{{ID}}-<version>.zip` + `dist/module.json` to a GitHub Release. Point Foundry at the `latest/download/module.json` URL.

```bash
git tag v0.1.0
git push --tags
```

## License

{{LICENSE}} © {{YEAR}} {{AUTHOR}}
