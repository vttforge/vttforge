---
'@vttforge/types': minor
---

`ContextMenuEntry` described the v13 shape only, so a package following it
wrote the three names Foundry removes in v16. `DocumentMembers` gained
`testUserPermission`. Both break a hand-written stand-in for those interfaces.

v14 renamed three fields on a context menu entry: `name` is `label`,
`condition` is `visible`, `callback` is `onClick`. The old names still work and
log a deprecation warning. Every field is optional now and both shapes compile,
with the v13 three marked `@deprecated` so an editor says which to write.

```ts
Hooks.on('getActorContextOptions', (_app, entries) => {
  entries.push({ label: 'MY_MODULE.Menu.open', visible: () => true, onClick: () => open() });
});
```

`testUserPermission(user, permission, options?)` asks whether a user has at
least that level of access. `isOwner` answers the same question for the current
user at the highest level; this answers it for any user and any level, which is
what a package asks before it shows someone another person's document.
