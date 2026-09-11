---
'@vttforge/core': minor
---

`registerSocket()`: the two ways a package talks to the other clients.

`emit` sends a one-way message. `askGm` asks the Gamemaster's client to do
something a player has no permission to do, and waits for the answer.

It covers the four things that are silent when you get them wrong. The
channel is `module.<id>` or `system.<id>`, not the package id. `"socket": true`
is a manifest field, and without it Foundry accepts the emit and delivers
nothing. The sender id comes from the server, not the payload, so a permission
check that reads the payload is not a check. And Foundry never delivers a
message back to whoever sent it, so `emit` runs the handler locally too and
drops the sender's own id from `recipients`.

Handlers fail closed: `from` defaults to `'gm'`, and a message from anyone else
is dropped. New error codes VTTF-0012 and VTTF-0013.
