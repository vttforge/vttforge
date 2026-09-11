# Migrating from Foundry v12

VTTForge targets v14+ and does not support v12. If you are porting a package
across that line, this is what breaks on the way to v13. Read
[Migrating to v14](/recipes/migrating-to-v14) for the rest.

## Removed, not deprecated

**TinyMCE is gone.** If your package registers an editor plugin or reaches for
`tinymce`, that code has no v13 equivalent. ProseMirror replaced it, with a
different extension model.

**`ui.windows` is gone.** Open applications live in
`foundry.applications.instances`, keyed by id:

```ts
for (const app of foundry.applications.instances.values()) {
  if (app instanceof MyViewer) app.doSomething();
}
```

Match with `instanceof`. A bundler minifies class names, so
`constructor.name` reads `za` where the source said `MyViewer`.

## Renamed

| v12 | v13 |
|---|---|
| `Application`, `FormApplication` | `foundry.applications.api.ApplicationV2` |
| `ActorSheet`, `ItemSheet` | `foundry.applications.sheets.ActorSheetV2` / `ItemSheetV2` |
| `Actors`, `Items` | `foundry.documents.collections.*` |
| `mergeObject`, `duplicate`, `flattenObject` | `foundry.utils.*` |
| `renderTemplate`, `loadTemplates` | `foundry.applications.handlebars.*` |
| `entity` | `document`, long since |

## ApplicationV2 has two halves

`_renderHTML` builds the content and `_replaceHTML` puts it in the window.
Implement only the first and the class is unrenderable, reported when something
tries to open it. `BaseApplication` from `@vttforge/core` ships the second.

## Enrichers gained `onRender`

The v12 pattern was to register a pattern, then separately bind click handlers
every time a chat message rendered. v13's enricher config takes an `onRender`
callback that fires when the enriched content enters the DOM, so you declare
the element and its behaviour together and the jQuery pass disappears.

```ts
CONFIG.TextEditor.enrichers.push({
  id: 'my-module.link',
  pattern: /@THING\[(.+?)\]\{(.+?)\}/g,
  enricher: async (match) => { /* return an element */ },
  onRender: (element) => { /* wire it up */ },
});
```

`id` is required if you use `onRender`.

## jQuery is deprecated

It still loads, but new code should use native DOM. One delegated listener on a
container beats one per element. If each render rebuilds the container,
per-element handlers leak the old ones.

## Check your work

```bash
vttforge audit
```

The audit scans the manifest and source for the v14 mistakes that fail
quietly.
