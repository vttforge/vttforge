---
"@vttforge/types": minor
"@vttforge/core": minor
---

Type the documents the bases hand you.

`@vttforge/types` now describes the document surface: `DocumentMembers`,
`ActorLike`, `ItemLike`, `ActiveEffectLike`, `FolderLike`, `EmbeddedCollection`
and `TypeDataModelMembers`. Core re-exports all of them.

Three places that returned `unknown` now return a document:

- `this.document` on an actor or item sheet. Reading `name`, `system` or
  calling `update()` no longer needs a cast.
- The drop hooks. `onDropItem`, `onDropActor`, `onDropFolder` and
  `onDropActiveEffect` hand over the document that was dropped.
- `this.parent` inside a `BaseTypeDataModel`. It did not compile before.

Both sheet factories take the document type, so the schema follows through:

```ts
class CharacterSheet extends BaseActorSheet<ActorLike<CharacterSystem>>() {
  async _prepareContext(options: unknown) {
    const level = this.document.system.level; // number
    return { ...(await super._prepareContext(options)), level };
  }
}
```

The member list came from the systems and modules already ported to the SDK:
each one is a member their sheets and drop handlers read. Reaching past it is
still a cast.
