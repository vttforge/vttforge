---
'@vttforge/types': minor
---

Building a `FoundryConfig` or `DocumentConfig` object literal now needs a document class that carries `create` and `createDocuments`. A bare `class {}` no longer satisfies it. Assignment is unchanged: `CONFIG.Actor.documentClass = MyActor` still takes any class, because a system subclass rarely redeclares those statics.

The reason is a defect. `documentClass` was typed `AnyClass`, so `CONFIG.Item.documentClass.create(...)` did not compile. Both scaffolded templates make that call. Nobody saw it because the template typecheck read a built copy of the types, not the source.

`ChatMessage.getSpeaker({ actor })` now takes an actor with any schema. It took `ActorLike`, whose `system` defaults to an open record, so it rejected an actor whose `system` came from a data model class. `Combat#getCombatantsByActor` takes the same widened type. `AnyActorLike` names it, and `DocumentConstructor` names the other.
