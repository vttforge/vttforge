---
'@vttforge/types': minor
---

`ContextMenuEntry.onClick` was typed `(target: HTMLElement) => void` and Foundry
calls it `(event, target)`. A handler written against the published type read
the click event as though it were the row, so `target.dataset.entryId` was
`undefined` and nothing was found.

It takes both arguments now and returns `unknown`, so an async handler fits.
`visible(target)` keeps the one argument it always had. Both receive the row the
menu was opened on, not a document: resolve the document from the element's
dataset.

```ts
entries.push({
  label: 'MY_MODULE.Menu.open',
  visible: (target) => target.dataset.entryId !== undefined,
  onClick: (_event, target) => open(game.actors.get(target.dataset.entryId ?? '')),
});
```

This corrects 0.10.0, which added the v14 names with the wrong signature on one
of them.
