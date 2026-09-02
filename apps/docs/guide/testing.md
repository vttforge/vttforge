# Testing

Two kinds of test, and the line between them is where a window renders.

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
`CONST`, and hands back a handle that **records** what your code registered —
hooks, settings, notifications, sheets, enrichers. You assert on what happened,
not merely on what did not throw.

`restore()` puts every global back, including deleting the ones that never
existed.

Importing from this entry also declares the globals, so `game.settings` in a
test does not produce "Cannot find name 'game'". There is nothing to configure.

### Assert the sheet key, not the call

```ts
const foundry = withMockFoundry();
registerSystem({
  id: 'my-system',
  sheets: [{ id: 'character', document: 'Actor', sheet: CharacterSheet, makeDefault: true }],
});
foundry.callHook('init');

foundry.sheets.map((s) => s.key); // ['my-system.character']
```

`key` is the thing worth pinning. Foundry saves it on every document whose
owner picked the sheet, and it is built from the class name — which a bundler
is free to rename between builds. A test that asserts the key is a test that
the reader's choice survives your next release.

`foundry.enrichers` reads back the same way, with the namespaced id.

### Mock documents behave like documents

```ts
const actor = createMockActor({ system: { hp: { value: 10, max: 10 } } });
await actor.update({ 'system.hp.value': 4 });

actor.system.hp; // { value: 4, max: 10 }
actor.updates;   // every delta, in order
```

Updates **merge**, and dotted paths expand — both because that is what Foundry
does. A mock that replaces instead of merging lets a test pass while the real
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

Safe at module scope: it waits for `quenchReady` rather than assuming Quench
has loaded, which is the mistake that makes a batch silently never appear.
Outside Foundry it does nothing, so a file holding both kinds of test still
imports under Vitest.

## Where to draw the line

Anything before `_renderHTML` is testable with a mock. Real rendering, sockets
with two clients, documents round-tripping through the database — those need
the real thing.

Reaching for a mock past that line produces tests that pass and tell you
nothing. Several bugs in this SDK were found only by opening a real Foundry: a
sheet registered but unreachable, a class extending the wrong base, an
annotation layer whose CSS class name did not match what the library styles.
