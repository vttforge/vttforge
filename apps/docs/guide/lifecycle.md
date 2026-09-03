# The startup lifecycle

Foundry starts a world in four stages, and each one exists because the stage
before it cannot do the job. `registerSystem` and `registerModule` take a
callback for each.

```ts
registerSystem({
  id: 'my-system',
  onBeforeInit: () => {},   // before any CONFIG mutation
  onAfterInit: () => {},    // init, after the mutations
  onI18nInit: () => {},     // languages loaded
  onSetup: () => {},        // every package loaded
  onReady: async () => {},  // the world is open
});
```

Register only the ones you use. A callback you leave out stages no hook at all.

## What each stage is for

**`init`** is where CONFIG gets written: data models, document classes, sheets,
the initiative formula, settings. `registerSystem` does most of it for you from
the options you pass. `onBeforeInit` runs first, before anything is touched, and
is the usual home for `globalThis.<systemId>`. `onAfterInit` runs last, and is
where settings get registered.

There is no `game.user` yet, no `game.actors`, no canvas.

**`i18nInit`** is the first moment `game.i18n` works. This matters more than it
sounds. A label you localize during `init` comes back as the key you passed in,
because the language files have not loaded, and that raw key is what players
read on screen. So translate CONFIG labels here, once:

```ts
onI18nInit: () => {
  for (const ability of Object.values(CONFIG.MY_SYSTEM.abilities)) {
    ability.label = game.i18n.localize(ability.label);
  }
},
```

Doing it once here beats calling `localize` on every render, and it is the
difference between a config table that reads `MY.Abilities.str` and one that
reads Strength.

**`setup`** runs after every package has finished its own `init`. Two things
become possible. A setting you registered during `init` can now be read. And a
module can now see what the system around it registered, which is why a module
that extends a system does that work here rather than racing it in `init`.

Compendium packs are available. World documents are not.

**`ready`** is the world, open. `game.actors`, `game.scenes`, `game.user`, the
canvas. Migrations go here, guarded, because they write to the world:

```ts
onReady: async () => {
  if (!game.user.isGM) return;
  await migrations.run();
},
```

None of the callbacks are gated for you. `onReady` fires on every client, so a
GM check is yours to write.

## Why not do everything in `ready`

It is tempting, because everything exists by then. The cost is that the user
watches it happen. CONFIG written during `ready` lands after the sidebar has
rendered against the old values, and a sheet that opened first opened wrong.
Each stage is the earliest point its work can succeed, and earlier is what
keeps the load looking like one step instead of several.
