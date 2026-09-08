# Migrating to Foundry v14

VTTForge targets v14+. If your package ran on v13 with an earlier release of
the SDK, this is what changes, in the SDK and in Foundry.

## In the SDK

**`activeEffect.legacyTransferral` is gone from `registerSystem`.** v14 removed
the flag. Effects on an owned Item with `transfer: true` apply to the Actor in
place; nothing is copied onto the Actor. Delete the option. If any code
iterated `actor.effects` expecting the copies, iterate
`actor.allApplicableEffects()` instead.

**`statusEffects` is added by id, on both `registerSystem` and
`registerModule`.** v14 keys `CONFIG.statusEffects` by id, and assigning a
whole array empties the collection first, which throws away every condition
another package added earlier in `init`. So the SDK never assigns. Every entry
needs a string `id`; an entry without one throws
[VTTF-0008](/errors/VTTF-0008). A system entry whose id matches a core
condition replaces it. A module prefixes its ids with its own id.

```ts
registerSystem({
  id: 'my-system',
  statusEffects: [
    { id: 'my-system.prone', name: 'MY_SYSTEM.Conditions.Prone', img: '...' },
    { id: 'dead', name: 'MY_SYSTEM.Conditions.Dead', img: '...', overlay: true },
  ],
});
```

**The scaffold no longer unregisters the core sheets.** v14 registers no
default Actor or Item sheet, so there is nothing to unregister. If your
`onBeforeInit` still calls `Actors.unregisterSheet('core', ...)`, delete it.

**Manifests carry `"type"` and `compatibility` at 14.** New scaffolds write
`"type": "system"` or `"type": "module"` and `{ "minimum": "14", "verified": "14" }`.

**`vttforge audit` grew six rules** (`VTTF-AUDIT-011` to `016`) for the v13
code v14 broke or deprecated, and `VTTF-AUDIT-002` is now HIGH: v14 dropped the
shim for the flat `gridDistance` / `gridUnits` keys, so a manifest that still
has them falls back to the default grid with no warning. Run the audit first;
it points at every line below.

## In Foundry

**Bare utility globals throw.** `mergeObject`, `getProperty`, `setProperty`,
`deepClone`, `expandObject`, `flattenObject`, `randomID`, `isNewerVersion` and
the rest were v12 shims that v13 kept and v14 removed. Write
`foundry.utils.<name>`. `Math.clamped` is `Math.clamp`; `game.template` is
gone, read `game.model`.

**Update keys use data operators.** The `-=key` and `==key` syntax warns until
v16:

```ts
// before
await actor.update({ 'system.biography': legacy, '-=system.bio': null });
// after
await actor.update({ 'system.biography': legacy, 'system.bio': _del });
await actor.update({ 'system.stats': _replace({ str: 10 }) });
```

`foundry.utils.mergeObject` takes `{ applyOperators: true }` where it took
`{ performDeletions: true }`.

**`rollMode` is `messageMode`.** Pass `{ messageMode: 'gm' }` (a key of
`CONFIG.ChatMessage.modes`: `public`, `gm`, `blind`, `self`, `ic`) to
`Roll#toMessage` and `ChatMessage.create`. The user default is
`game.settings.get('core', 'messageMode')`.

**Active Effects are typed documents.** `changes` moved to `system.changes`,
and the numeric `mode` became a string `type` (`add`, `multiply`, `override`,
`upgrade`, `downgrade`, `subtract`, `custom`). Stored v13 data migrates on
load; code that builds changes needs the new shape.

**`template.json` is deprecated.** It still loads, warns on every start, and
goes away in v16. Declare types in `documentTypes` and register a
`TypeDataModel` per type; the SDK's `registerSystem` already does the second
half.

**Header controls and context menus** use `label`, `visible` and `onClick` in
place of `name`, `condition` and `callback`. The old keys warn until v16.

**MeasuredTemplate is a Region.** Area effects are placed with
`canvas.regions.placeRegion`; the template document and layer are shims until
v16.

## Then

```bash
vttforge audit
```

Load a world with the package active and search the console for
`Deprecated since Version 14`. Each warning names its replacement.
