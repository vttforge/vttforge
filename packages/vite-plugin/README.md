# @vttforge/vite-plugin

Vite plugin for VTTForge — HMR for `.hbs` templates, manifest sync between `system.json` / `module.json` and `package.json`, and a vanilla CSS + PostCSS pipeline (Sass opt-in via consumer install).

> **Status:** v0.0.1 placeholder. Implementation lands in v0.2.0.

## Planned features (v0.2.0)

- HMR for Handlebars (`.hbs`) templates with sheet-template re-render
- Manifest sync: `package.json` → `system.json` / `module.json`
- CSS pipeline (PostCSS, opt-in Sass, Tailwind via documented recipe only)
- Sourcemap configuration aligned with `@vttforge/core`
