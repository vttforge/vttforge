---
'@vttforge/cli': minor
---

`vttforge dev` now applies saves in place, without a page refresh.

It opens a small WebSocket, links `@vttforge/dev-module` into Foundry's
modules directory, and watches the build output — sending a payload per
changed CSS, template or language file.

The socket is hand-written rather than pulled from a package. The CLI ships
to every consumer, so each dependency is one they install too, and what is
needed here is a narrow slice of the protocol: accept the upgrade, send
unmasked text frames, notice when a client leaves.

Watching `dist/` rather than hooking into Vite keeps this correct across
bundler versions, and gives the served path directly — `dist/` is what
Foundry mounts.

Failing to start the bridge costs hot reload, not the dev loop. A busy port
or a missing companion package prints why and carries on watching.

New: `--hmr-port` to move the bridge off 31313.
