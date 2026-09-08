---
'@vttforge/core': minor
---

Add four decorators, marked `@experimental`, for the registrations every package writes by hand: `@ActorDataModel`, `@ItemDataModel`, `@DocumentSheet` and `@OnHook`.

```ts
@ActorDataModel('character')
class CharacterData extends BaseTypeDataModel(defineCharacterSchema) {}

@DocumentSheet({ id: 'character', document: 'Actor', namespace: 'my-system', types: ['character'], makeDefault: true })
class CharacterSheet extends BaseActorSheet() {}

class Chat {
  @OnHook('renderChatMessageHTML')
  static onRender(message: unknown, html: HTMLElement) {}
}
```

The timing is the whole point. `CONFIG` may only be touched inside the `init` hook, but a class is defined the moment its module is imported, long before `init`. The obvious version, assigning to `CONFIG` from the decorator body, works in a test and silently does nothing in Foundry. These subscribe a listener at definition time and do the assignment when `init` fires.

`@DocumentSheet` takes a required `id` and goes through `registerSheets`, the same path `registerSystem({ sheets })` takes. Foundry saves the sheet key on every document using it and builds that key from the class name, which a bundler renames between builds. The `id` is what keeps the saved key pointing at a sheet that still exists.

`@OnHook` accepts static methods only. An instance method has no instance to run against when the listener is registered, and inventing one would be a guess; it throws `VTTF-0002` and says so.

These are standard TC39 decorators, not the legacy `experimentalDecorators` kind. Oxc, which Vite 8 uses, does not lower them yet, so a build that applies them needs the Babel decorator plugin ahead of Oxc. `@vttforge/vite-plugin` adds it for you, filtered to files that contain an `@`, so a project that never uses a decorator pays nothing.

All four are `@experimental`: they are new and no consumer has used them yet, so the shape can change in a minor. `registerSystem` and `registerModule` remain the supported path and are what the scaffolds use.
