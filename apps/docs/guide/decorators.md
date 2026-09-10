# Decorators

Five decorators for the registrations every package writes by hand. They are
`@experimental`: new, and no consumer has used them yet, so the shape can
change in a minor. `registerSystem` and `registerModule` remain the supported
path, and are what the scaffolds use.

```ts
import { ActorDataModel, DocumentSheet, OnHook, SystemSetting } from '@vttforge/core';

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

class Settings {
  @SystemSetting({ namespace: 'my-system', scope: 'world', config: true, type: Boolean })
  static accessor homebrew = false;
}

Settings.homebrew; // game.settings.get('my-system', 'homebrew')
Settings.homebrew = true; // game.settings.set('my-system', 'homebrew', true)
```

## Timing

`CONFIG` may only be touched inside the `init` hook, and a class is defined
the moment its module is imported, long before `init` fires. A decorator that
assigns to `CONFIG` from its body passes a unit test and then does nothing in
Foundry.

These subscribe a listener when the class is defined and do the assignment
when `init` fires. `Hooks` exists as soon as Foundry's scripts load, so
subscribing at definition time is safe; the write happens later.

## `@DocumentSheet` needs an `id`

Foundry saves a sheet's key on every document whose owner picks it, and builds
that key from the class name. A bundler renames classes between builds, and
the saved key then names a sheet that no longer exists. `@DocumentSheet` goes
through `registerSheets`, the same path `registerSystem({ sheets })` takes,
which pins the class name to the `id` you give it.

## `@OnHook` takes static methods only

An instance method has no instance to run against when the listener is
registered. Decorating one throws `VTTF-0002`.

## `@SystemSetting` sits on a static accessor

The accessor's initializer is the setting's default, and the key is the
accessor's name unless you pass `key`. Reads go to `game.settings.get` and
writes to `game.settings.set`, so the field itself holds nothing. The write
cannot be awaited, because an assignment has no result; when you need to know
it landed, call `game.settings.set` yourself. An instance accessor throws
`VTTF-0002`, since a setting holds one value for the world or the client.

## The build has to lower them

These are standard TC39 decorators, not the legacy `experimentalDecorators`
kind. Oxc, which Vite 8 uses, does not lower them yet, and a bundle that still
contains a raw `@` fails to load in every browser with no error at build time.

`@vttforge/vite-plugin` adds Babel's decorator plugin ahead of Oxc for you,
filtered to files that contain an `@`, so files without decorators skip Babel.
If you build with something other than the plugin, add
`@babel/plugin-proposal-decorators` with `version: "2023-11"` yourself.
