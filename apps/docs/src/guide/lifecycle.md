# The startup lifecycle

Foundry starts a world in four stages. `registerSystem` and `registerModule`
take a callback for each.

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

Register only the ones you use. A callback you leave out registers no hook at
all.

## What each stage is for

**`init`** is where you write CONFIG: data models, document classes, sheets,
the initiative formula, settings. `registerSystem` does most of it for you from
the options you pass. `onBeforeInit` runs first, before anything changes, and
is the usual home for `globalThis.<systemId>`. `onAfterInit` runs last, and is
where you register settings.

There is no `game.user` yet, no `game.actors`, no canvas.

**`i18nInit`** is the first moment `game.i18n` works. A label you localize
during `init` comes back as the key you passed in, because the language files
have not loaded, and players read that raw key on screen. Translate CONFIG
labels here, once:

```ts
onI18nInit: () => {
  for (const ability of Object.values(CONFIG.MY_SYSTEM.abilities)) {
    ability.label = game.i18n.localize(ability.label);
  }
},
```

Doing it once here beats calling `localize` on every render.

**`setup`** runs after every package has finished its own `init`. A setting
you registered during `init` can now be read, and a module can see what the
system around it registered, so a module that extends a system does that work
here rather than racing it in `init`.

Compendium packs are available. World documents are not.

**`ready`** runs with the world open, so `game.actors`, `game.scenes`,
`game.user` and the canvas all exist. Migrations go here, guarded, because
they write to the world:

```ts
onReady: async () => {
  if (!game.user.isGM) return;
  await migrations.run();
},
```

None of the callbacks are gated for you: `onReady` fires on every client, so
the GM check is yours to write.

## The cost of doing everything in `ready`

Everything exists by then, but the user watches the work happen. CONFIG
written during `ready` lands after the sidebar has rendered against the old
values, and a sheet that opened first opened wrong. Each stage is the earliest
point its work can succeed.
