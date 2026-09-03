---
'@vttforge/core': minor
---

Add `onI18nInit` and `onSetup` to `registerSystem` and `registerModule`.

Foundry starts a world in four stages and only two of them were reachable. The missing two are the ones that are hard to work around.

`i18nInit` is the first moment `game.i18n` works. A label localized during `init` comes back as the key you passed in, because the language files have not loaded, and that raw key is what players read on screen. Translate CONFIG labels in `onI18nInit` instead, once, rather than calling `localize` on every render.

`setup` runs after every package has finished its own `init`. A setting registered during `init` can be read from here on, and a module can see what the system around it registered instead of racing it.

```ts
registerSystem({
  id: 'my-system',
  onI18nInit: () => {
    for (const ability of Object.values(CONFIG.MY_SYSTEM.abilities)) {
      ability.label = game.i18n.localize(ability.label);
    }
  },
  onSetup: () => {
    if (settings.get('showTutorial')) openTutorial();
  },
});
```

Both are optional and neither is GM-gated. Omit one and no hook is staged for it.
