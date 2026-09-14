---
'@vttforge/types': minor
---

Four members Foundry has and this package did not describe. Each was found by a
module built on the published packages, and each is checked against a running
Foundry v14 rather than taken from a document.

`foundry.applications.instances` is the map of open applications, keyed by id.
v13 removed `ui.windows` and this replaced it, and it is how a package finds
its own window again:

```ts
for (const app of foundry.applications.instances.values()) {
  if (app instanceof MyViewer) app.refresh();
}
```

The value is `object`, not a shape. A package narrows with `instanceof` and
then has the class it wrote; `unknown` on the left of `instanceof` does not
compile.

`DialogV2.input` renders a form and hands back every field, where `prompt` asks
one question and hands back one answer. `DialogV2.query` asks another client
and waits for that client's answer. Both are on the class in v14, and a package
using either had to cast.

`JournalEntryLike`, `SceneLike` and `CombatLike` now carry the embedded-document
writes. A journal owns its pages, a scene its tokens, a combat its combatants:
reading those collections was typed and writing to them was not, so every
`createEmbeddedDocuments` call went through a cast.
