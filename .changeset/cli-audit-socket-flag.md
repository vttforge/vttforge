---
'@vttforge/cli': minor
---

`vttforge audit` gains VTTF-AUDIT-022: source that talks on the package socket
channel while the manifest has no `"socket": true`.

Foundry opens the `module.<id>` / `system.<id>` channel only for a package that
declares the flag. Without it `emit` returns without throwing, the message
never leaves the client, and nothing is logged. The listener on the other
machine is bound and correct and never fires, so the search goes to the
handler, the payload and the user permissions, and the manifest is the last
place anyone looks.

The rule wants the package channel. Core events ride the same socket under
their own names and need no flag, so `game.socket.on('userActivity', ...)` on
its own is not a finding. A file that names `module.<id>` or `system.<id>`, or
that calls `registerSocket`, is. Calls quoted in comments are skipped.
