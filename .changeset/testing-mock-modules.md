---
'@vttforge/testing': minor
---

`withMockFoundry` hands out a module handle for any id, instead of an empty
collection.

A unit test has no module list, so whatever the code under test names is
treated as installed and switched on. The handle is remembered, so writing an
api on it and reading it back works the way it does in a world. Without this,
anything touching `game.modules.get(id)` saw nothing and reported a module
that is missing.
