---
'@vttforge/vite-plugin': patch
---

The build copies compendium packs. `packs` joins the default `staticAssets`, and the directory of every `packs[].path` the manifest declares is copied wherever the author put it. A system built without them shipped with empty compendia.
