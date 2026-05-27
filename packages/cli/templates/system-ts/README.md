# {{TITLE}}

{{DESCRIPTION}}

Built on [VTTForge](https://github.com/vttforge/vttforge) — typed data models, declarative sheet boilerplate, migration runner, error catalogue, and a Vite-based build pipeline.

> **Note** — VTTForge is currently in pre-release and not yet published to npm. The dependencies in `package.json` (`@vttforge/core`, `@vttforge/styles`, `@vttforge/vite-plugin`) will resolve once VTTForge ships its first public release. Until then, work from a local checkout: `pnpm link --global` from each VTTForge package, then `pnpm link --global @vttforge/core @vttforge/styles @vttforge/vite-plugin` here.

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

Run Foundry with `--hotReload` so saved files reload the world without a page
refresh — `dev` watches `dist/` for changes, and Foundry's built-in dispatcher
swaps CSS / Handlebars / JSON on the fly.

Then launch Foundry, create a world that uses **{{TITLE}}**, and open a character — the sheet is the `CharacterSheet` shipped in `scripts/sheets/`.

## What's inside

| Path | Purpose |
|---|---|
| `system.json` | Manifest (id, compatibility, document types, manifest-side sanitization paths) |
| `template.json` | Foundry document type declarations (Actor + Item subtypes) |
| `scripts/main.ts` | Entry point — one call to `registerSystem` from `@vttforge/core` |
| `scripts/data/*.ts` | Typed data models (`BaseTypeDataModel()` from `@vttforge/core`) |
| `scripts/sheets/*.ts` | Sheet boilerplate eliminators (`BaseActorSheet()` / `BaseItemSheet()`) |
| `scripts/migrations.ts` | `createMigrationRunner()` — versioned data migrations |
| `templates/` | Handlebars templates for sheets |
| `styles/main.css` | Stylesheet — imports `@vttforge/styles` as the design system base |
| `lang/en.json` | Localization strings |

## Releasing to Foundry

Tag-push triggers `.github/workflows/release.yml`, which builds the system, zips `dist/`, and attaches both `{{ID}}-<version>.zip` and `dist/system.json` to a GitHub Release.

```bash
git tag v0.1.0
git push --tags
```

Foundry installs from the `system.json` URL on the Release — point users at the `latest/download/system.json` URL in the release notes so they auto-update on every tag.

For foundryvtt.com submissions, submit the same manifest URL pattern.

## License

{{LICENSE}} © {{YEAR}} {{AUTHOR}}
