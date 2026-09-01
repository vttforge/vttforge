---
'@vttforge/testing': minor
---

First real release. It was a three-line placeholder.

Two entry points, because the two kinds of test run in different places.

`@vttforge/testing/vitest` installs the Foundry globals a package reaches for and hands back a handle that records what your code registered — hooks, settings, notifications — so a test can assert on what happened rather than only on what did not throw. Every `@vttforge/core` test built this by hand, differently each time; that is the problem it solves.

`@vttforge/testing/quench` registers a batch inside a live world, for what a mock cannot answer: a sheet that really draws, a socket with two clients, a document that round-trips through the database.

Also ships ambient declarations for the globals, since a test that mocks Foundry then reads `game.settings` otherwise gets "Cannot find name 'game'".
