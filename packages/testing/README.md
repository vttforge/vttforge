# @vttforge/testing

Helpers for testing Foundry VTT packages.

Two entry points, because the two kinds of test run in different places.

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
`CONST`, and hands back a handle that records what your code registered — hooks,
settings, notifications — so a test can assert on what happened rather than only
on what did not throw. `restore()` puts every global back, including deleting the
ones that never existed.

The mock documents behave like real ones where it counts: `update` merges rather
than replacing, and dotted paths expand. Both matter — a mock that replaces lets
a test pass while the real thing drops every sibling key.

### Naming the globals

A test that reads `game.settings` would otherwise get "Cannot find name
'game'". Importing from this entry declares them, so there is nothing to
configure — the import a test already writes is what brings them.

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

Safe to call at module scope: it waits for `quenchReady` rather than assuming
Quench has loaded, which is the mistake that makes a batch silently never
appear. Outside Foundry it is a no-op, so a file holding both kinds of test can
still be imported by the vitest run.

## Where the line sits

Anything before `_renderHTML` is testable in Vitest. Real rendering is Quench's
half. Reaching for a mock past that line produces tests that pass and tell you
nothing.
