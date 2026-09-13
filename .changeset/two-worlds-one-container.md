---
'@vttforge/testing': minor
---

`FoundryContainer` gained four members, so a hand-written stand-in for that
interface no longer satisfies it. Add them, or type the stand-in as a partial.

The container harness can now run more than one world. `createWorld({ id, title })`
declares a world on a system already installed, and `switchWorld(id)` launches
it and waits until it is joinable. `worldId` says which world is running and
`system` says which system it runs on; both follow a switch.

Before this, the world was written once during boot by a private helper, so a
test that had to compare two worlds had to run `docker` commands of its own.
That is the case for any package that moves data between worlds.

A switch restarts Foundry. A browser session on the old world is gone, and
world-scoped state does not carry over: a module enabled in the first world
starts disabled in the second.
