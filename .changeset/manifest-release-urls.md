---
'@vttforge/vite-plugin': minor
'@vttforge/cli': patch
---

The plugin writes the `manifest` and `download` URLs into the built manifest.

`vttforge build` emits `dist/` and zips it in one step, so a release workflow
that patched `dist/module.json` afterwards shipped a zip holding the unpatched
manifest. The templates worked around it by calling `vite build` directly,
patching the JSON with an inline `node -e`, and zipping by hand.

Two options, `manifestUrl` and `downloadUrl`, each falling back to
`VTTFORGE_MANIFEST_URL` and `VTTFORGE_DOWNLOAD_URL` so a workflow sets them
without editing the Vite config. `{version}` in the download URL is replaced
with the version being built. Neither given, the source manifest is left
alone.

The release workflow the templates ship now runs `pnpm build` with those two
variables set, and the three-step dance is gone.

`vttforge audit` rule 020 knows that `vttforge build` writes the zip itself,
from `dist/`, so a workflow naming that zip is not shipping the checkout. A
workflow that runs a plain `vite build` and then zips the source tree is still
a HIGH finding.
