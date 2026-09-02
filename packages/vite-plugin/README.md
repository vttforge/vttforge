# @vttforge/vite-plugin

The build contract for a Foundry VTT v13+ system or module, as a Vite plugin.

```bash
pnpm add -D @vttforge/vite-plugin vite
```

```js
// vite.config.mjs
import vttforge from '@vttforge/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vttforge({ id: 'my-system', kind: 'system', entry: 'scripts/main.ts' })],
});
```

## What it does

- Emits browser ES modules into `dist/` with **no hashed filenames** — Foundry loads files by the fixed paths in the manifest.
- Keeps class names through minification, so a sheet registered by class name keeps its key between builds. Prefer `registerSystem({ sheets })` with an `id`; this is the safety net.
- Bundles CSS into one stylesheet and rewrites the manifest's `styles` and `esmodules` to the emitted paths.
- Copies the manifest under Foundry's filename (`system.json` / `module.json`) with `version` synced from `package.json`.
- Copies `template.json`, `lang/` and `templates/` verbatim. Override the list with `staticAssets`.
- Emits external source maps with the sources embedded.

## Options

| Option | Default | Meaning |
|---|---|---|
| `id` | — | The package id. Must match the manifest and the folder Foundry serves it from |
| `kind` | `'system'` | `'system'` or `'module'`. Sets the base path (`/systems/<id>/` vs `/modules/<id>/`) and the manifest filename |
| `entry` | `'scripts/main.mjs'` | Entry script, relative to the project root |
| `manifest` | `system.json` / `module.json` | Manifest path, relative to the project root |
| `staticAssets` | `['template.json', 'lang', 'templates']` | Files and directories copied into `dist/` before each build |

Peer: `vite ^8`. Node 26+.

`vttforge dev` and `vttforge build` from [`@vttforge/cli`](https://www.npmjs.com/package/@vttforge/cli) run this plugin for you.
