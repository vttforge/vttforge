# Decorators

Four decorators for the registrations every package writes by hand. They are
`@experimental`: new, and no consumer has used them yet, so the shape can
change in a minor. `registerSystem` and `registerModule` remain the supported
path, and are what the scaffolds use.

```ts
import { ActorDataModel, DocumentSheet, OnHook } from '@vttforge/core';

@ActorDataModel('character')
class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {}

@DocumentSheet({
  id: 'character',
  document: 'Actor',
  namespace: 'my-system',
  types: ['character'],
  makeDefault: true,
})
class CharacterSheet extends BaseActorSheet() {}

class Chat {
  @OnHook('renderChatMessageHTML')
  static onRender(message: unknown, html: HTMLElement) {}
}
```

## The timing is the whole point

`CONFIG` may only be touched inside the `init` hook. But a class is defined
the moment its module is imported, long before `init` fires. The obvious
decorator, one that assigns to `CONFIG` from its body, works in a unit test
and silently does nothing in Foundry.

These subscribe a listener when the class is defined and do the assignment
when `init` fires. `Hooks` exists as soon as Foundry's scripts load, so
subscribing at definition time is safe; the write waits for its moment.

## `@DocumentSheet` needs an `id`

Foundry saves a sheet's key on every document whose owner picks it, and builds
that key from the class name. A bundler renames classes between builds, and
the saved key then names a sheet that no longer exists. `@DocumentSheet` goes
through `registerSheets`, the same path `registerSystem({ sheets })` takes,
which pins the class name to the `id` you give it. Pick it once and keep it.

## `@OnHook` takes static methods only

An instance method has no instance to run against when the listener is
registered, and inventing one would be a guess. Decorating an instance method
throws `VTTF-0002` and says so.

## The build has to lower them

These are standard TC39 decorators, not the legacy `experimentalDecorators`
kind. Oxc, which Vite 8 uses, does not lower them yet, and a bundle that still
contains a raw `@` fails to load in every browser with no error at build time.

`@vttforge/vite-plugin` adds Babel's decorator plugin ahead of Oxc for you,
filtered to files that contain an `@`, so a project that never uses a decorator
pays nothing. If you build with something other than the plugin, add
`@babel/plugin-proposal-decorators` with `version: "2023-11"` yourself.
