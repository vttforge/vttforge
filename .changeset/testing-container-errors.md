---
'@vttforge/testing': patch
---

A refused `docker` command now says what Docker said.

`execFileSync` throws an Error whose message is the command line and whose
reason sits in `stderr`. Printed raw that is forty lines of object dump with a
stack through the helper and the reason buried in the middle. The reason is now
the message.

The port collision gets its own sentence, because it has an obvious fix and the
raw wording hides it:

```
Port 30001 is already taken, so Foundry could not start. A distinct `name` does
not help, because every run publishes on the same default port. Pass `port` to
give this one its own.
```

Naming the container and the volume is not enough, and the first project built
on this entry point hit exactly that against the SDK's own end-to-end
container.
