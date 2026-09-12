# @vttforge/testing

Helpers for testing Foundry VTT packages.

Three entry points, one for each place a test can run.

## `@vttforge/testing/vitest`

Runs in CI against mocked globals. Covers everything up to the moment a window
renders: data models, settings, hook registration, migrations, document
updates.

```ts
import { createMockActor, withMockFoundry } from '@vttforge/testing/vitest';

const foundry = withMockFoundry();
registerMyModule();

foundry.callHook('init');
expect(foundry.settings[0].key).toBe('cacheSize');

foundry.restore();
```

`withMockFoundry` installs `foundry`, `game`, `CONFIG`, `Hooks`, `ui` and
`CONST`, and hands back a handle that records what your code registered (hooks,
settings, notifications) so a test can assert on what happened. `restore()`
puts every global back, including deleting the ones that never existed.

Anything else your code reads goes in `globals`. Foundry puts every document
class on the global scope, and the fixed set above does not include them:

```ts
const foundry = withMockFoundry({
  globals: { JournalEntry: { create: vi.fn() } },
});
```

`restore()` clears those too.

The mock documents behave like real ones where it counts: `update` merges rather
than replacing, and dotted paths expand. A mock that replaces lets a test pass
while the real thing drops every sibling key.

### Naming the globals

A test that reads `game.settings` would otherwise get "Cannot find name
'game'". Importing from this entry declares them, so there is nothing to
configure.

## `@vttforge/testing/quench`

Runs inside a live world, for what a mock cannot answer: a sheet that really
draws, a socket with two clients, a document that round-trips through the
database.

```ts
import { registerBatch } from '@vttforge/testing/quench';

registerBatch('my-module.sheets', ({ describe, it, assert }) => {
  describe('character sheet', () => {
    it('renders', async () => {
      const actor = await Actor.create({ name: 'T', type: 'character' });
      await actor.sheet.render(true);
      assert.ok(actor.sheet.rendered);
      await actor.delete();
    });
  });
});
```

Safe to call at module scope: it waits for `quenchReady`. Code that assumes
Quench has already loaded registers a batch that never appears. Outside
Foundry it is a no-op, so a file holding both kinds of test can still be
imported by the vitest run.

## `@vttforge/testing/container`

Boots a real Foundry in Docker, installs your build into it, and leaves it on
the join screen. For the questions a mock cannot answer and Quench cannot
reach: whether the manifest you ship is the one Foundry reads, what a migration
does to stored documents, whether the package loads at all.

```ts
import { startFoundryContainer } from '@vttforge/testing/container';

const foundry = await startFoundryContainer({
  acceptLicense: true,
  name: 'my-module-e2e',
  packages: [
    { kind: 'system', id: 'some-system', from: 'test/fixtures/system' },
    { kind: 'module', id: 'my-module', from: 'dist' },
  ],
});

try {
  // drive foundry.baseUrl with Playwright, or fetch it directly
} finally {
  foundry.stop();
}
```

Needs `docker` on the PATH, and `FOUNDRY_LICENSE_KEY`, `FOUNDRY_USERNAME` and
`FOUNDRY_PASSWORD` in the environment. They are handed to Docker by name, so no
credential is written into an argument list. The first run downloads Foundry
and takes a couple of minutes; later runs reuse the data volume.

### You accept the licence

Booting Foundry records an answer to its licence agreement. This code will not
answer it for you: `startFoundryContainer` throws unless you pass
`acceptLicense: true` or set `FOUNDRY_ACCEPT_LICENSE=1`. Read the agreement
first.

### Two things the API makes you notice

Foundry scans its packages directory once, at startup. `install()` copies a
package in; it becomes visible after `restart()`. That is why `packages` is an
option on `startFoundryContainer`, which installs before the world launches.

The container name, the volume and the world id all default, and two runs
sharing a name collide. Name them when a project runs more than one, or runs
alongside another project's.

`stopFoundryContainer(name)` and `foundryContainerLogs(name)` do the same as
the handle's `stop()` and `logs()`, for a teardown script in its own process
and for a boot that failed before there was a handle.

## What to test where

Anything before `_renderHTML` is testable in Vitest. Real rendering belongs to
Quench. What only a whole Foundry can answer belongs to the container. There is no helper that mounts a sheet against a mock actor and
returns its HTML, and none is planned: a copy of the Application framework
inside a mock renders something like Foundry, so a test that passes against the
copy says nothing about the real one.
