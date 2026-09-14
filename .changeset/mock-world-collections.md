---
'@vttforge/testing': minor
---

`game.actors`, `game.items` and `game.journal` are collections now, not empty
arrays. A test that called `push` on one has to pass the documents up front
instead, through the new options.

An array answers `filter` and iteration. Code that reads a world calls `get`,
`getName`, `find` and `size` as well, so a test had to hand it a collection
built by hand, which is the thing this mock exists to remove. They answer all
of it now, and `game.journal` exists at all for the first time.

```ts
withMockFoundry({
  items: [createMockItem({ id: 'sword', name: 'Sword', type: 'weapon' })],
  actors: [createMockActor({ id: 'hero' })],
  journal: [{ name: 'PDFs' }],
});

game.items.get('sword');
game.items.getName('Sword');
[...game.items].filter((item) => item.type === 'weapon');
```

Unlike `game.modules`, nothing is invented: a world holds the documents it
holds, and `get` on an id that is not there answers `undefined`, the same as
Foundry. A document that names no id gets one, so `get` and `has` work either
way.
