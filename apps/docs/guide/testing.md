# Testing

Tests split at the point where a window renders. Everything before it runs
against a mock in CI, and the rest needs a running world.

## In CI

```ts
import { createMockActor, withMockFoundry } from '@vttforge/testing/vitest';

const foundry = withMockFoundry();
registerMyModule();

foundry.callHook('init');
expect(foundry.settings[0].key).toBe('cacheSize');

foundry.restore();
```

`withMockFoundry` installs `foundry`, `game`, `CONFIG`, `Hooks`, `ui` and
`CONST`, and hands back a handle that records what your code registered:
hooks, settings, notifications, sheets, enrichers.

`restore()` puts every global back, including deleting the ones that never
existed.

Anything else your code reads goes in `globals`. Foundry puts every document
class on the global scope, and the fixed set above does not include them:

```ts
const foundry = withMockFoundry({
  globals: { JournalEntry: { create: vi.fn() } },
});
```

`restore()` clears those too, and puts back whatever was there before.

Importing from this entry also declares the globals, so `game.settings` in a
test does not produce "Cannot find name 'game'".

### Assert the sheet key

```ts
const foundry = withMockFoundry();
registerSystem({
  id: 'my-system',
  sheets: [{ id: 'character', document: 'Actor', sheet: CharacterSheet, makeDefault: true }],
});
foundry.callHook('init');

foundry.sheets.map((s) => s.key); // ['my-system.character']
```

Pin the `key`. Foundry saves it on every document whose owner picked the
sheet, and it is built from the class name, which a bundler is free to rename
between builds.

`foundry.enrichers` reads back the same way, with the namespaced id.

### Mock documents behave like documents

```ts
const actor = createMockActor({ system: { hp: { value: 10, max: 10 } } });
await actor.update({ 'system.hp.value': 4 });

actor.system.hp; // { value: 4, max: 10 }
actor.updates;   // every delta, in order
```

Updates merge and dotted paths expand, because that is what Foundry does. A
mock that replaced instead of merging would let a test pass while the real
thing drops every sibling key.

## In a real world

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

`registerBatch` is safe at module scope, because it waits for `quenchReady`
before registering. Outside Foundry it does nothing, so a file holding both
kinds of test still imports under Vitest.

## Where to draw the line

Anything before `_renderHTML` is testable with a mock. Real rendering, sockets
with two clients and documents round-tripping through the database need a
running Foundry, and only a running Foundry caught several bugs in this SDK: a
sheet registered but unreachable, a class extending the wrong base, an
annotation layer whose CSS class name did not match what the library styles.

There is no helper that mounts a sheet against a mock actor and hands back its
HTML, and there will not be one. Rendering a sheet is the Application
framework: the Handlebars mixin, `PARTS`, template loading, Foundry's own
helpers, tabs, form handling. A copy of that inside a mock would render
something like what Foundry renders, and a test that passes against the copy
and fails in the real thing is worse than no test. Test the context with
`_prepareContext` under Vitest, and test the render under Quench or the
end-to-end run.
