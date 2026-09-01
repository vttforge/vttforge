---
'@vttforge/vite-plugin': minor
'@vttforge/cli': minor
---

Move to Vite 8.

The plugin's `vite` peer range now reads `^8.2.2`, so a project still on
Vite 6 or 7 will not satisfy it. The four `vttforge init` templates move
with it, which keeps a freshly scaffolded project free of a peer conflict.

The plugin itself needed no code change — it uses only the `config` hook
and the `Plugin` and `UserConfig` types, all unchanged across the two
majors.
