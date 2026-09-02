---
'@vttforge/core': minor
---

Register text enrichers through `registerSystem` / `registerModule`.

`CONFIG.TextEditor.enrichers` is a plain array, so registering by hand is one `push`. The reason this exists is that the array has four ways to accept an entry and then do nothing with it, and Foundry names none of them.

`onRender` without an `id` never fires — Foundry wraps enriched output in a custom element only when both are present, and only the wrapper fires the callback, so the markup looks right and only the behaviour is missing. A duplicate `id` silently loses, because the wrapper finds the enricher back with `find` and takes the first match: two packages both using `link` means the first one's `onRender` runs against the second one's markup, which only reproduces in a world with both installed. A pattern without the `g` flag throws, because enrichment matches with `matchAll`, and that throw is outside the handler Foundry wraps enrichers in. And the id lives in one namespace shared with the system and every other module.

```ts
registerModule({
  id: 'my-module',
  enrichers: [{ id: 'link', pattern: /@PDF\[(.+?)\]/g, enricher, onRender }],
});
```

Ids are namespaced to the package, an id is always supplied so `onRender` fires, and the rest is checked when you register rather than when someone opens a chat message.

New error VTTF-0007 for an id that is empty, dotted, or repeated, and for a non-global pattern.
