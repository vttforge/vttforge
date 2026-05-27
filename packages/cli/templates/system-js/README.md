# {{TITLE}}

{{DESCRIPTION}}

Built on [VTTForge](https://github.com/vttforge/vttforge) — typed data models, declarative sheet boilerplate, migration runner, error catalogue, and a Vite-based build pipeline.

> **Note** — VTTForge is currently in pre-release and not yet published to npm. The dependencies in `package.json` (`@vttforge/core`, `@vttforge/styles`, `@vttforge/vite-plugin`) will resolve once VTTForge ships its first public release. Until then, work from a local checkout: `pnpm link --global` from each VTTForge package, then `pnpm link --global @vttforge/core @vttforge/styles @vttforge/vite-plugin` here.

## Quick start

```bash
pnpm install
pnpm build         # bundles dist/ — the deployable artefact
pnpm dev           # vite build --watch — rebuilds dist/ on every edit
```

Symlink the built `dist/` into your Foundry data directory:

```bash
# macOS
ln -s "$(pwd)/dist" "$HOME/Library/Application Support/FoundryVTT/Data/systems/{{ID}}"

# Linux
ln -s "$(pwd)/dist" "$HOME/.local/share/FoundryVTT/Data/systems/{{ID}}"

# Windows (PowerShell, as admin)
New-Item -ItemType SymbolicLink -Path "$env:APPDATA\FoundryVTT\Data\systems\{{ID}}" -Target "$(pwd)\dist"
```

Then launch Foundry, create a world that uses **{{TITLE}}**, and open a character — the sheet is the `CharacterSheet` shipped in `scripts/sheets/`.

## What's inside

| Path | Purpose |
|---|---|
| `system.json` | Manifest (id, compatibility, document types, manifest-side sanitization paths) |
| `template.json` | Foundry document type declarations (Actor + Item subtypes) |
| `scripts/main.mjs` | Entry point — one call to `registerSystem` from `@vttforge/core` |
| `scripts/data/*.mjs` | Typed data models (`BaseTypeDataModel()` from `@vttforge/core`) |
| `scripts/sheets/*.mjs` | Sheet boilerplate eliminators (`BaseActorSheet()` / `BaseItemSheet()`) |
| `scripts/migrations.mjs` | `createMigrationRunner()` — versioned data migrations |
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
