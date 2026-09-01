# Migrating from Foundry v12

VTTForge targets v13+ and does not support v12. If you are porting a package
across that line, this is what actually bites.

## Removed, not deprecated

**TinyMCE is gone.** If your package registers an editor plugin or reaches for
`tinymce`, that code has no v13 equivalent — ProseMirror replaced it, with a
different extension model.

**`ui.windows` is gone.** Open applications live in
`foundry.applications.instances`, keyed by id:

```ts
for (const app of foundry.applications.instances.values()) {
  if (app instanceof MyViewer) app.doSomething();
}
```

Match with `instanceof`, not `constructor.name` — a bundler minifies class
names, and `MyViewer` becomes `za` in the built file.

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
callback that fires when the enriched content enters the DOM, so the element
and its behaviour are declared together and the jQuery pass disappears.

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
container beats one per element — and if the container is rebuilt on each
render, per-element handlers leak the old ones.

## Check your work

```bash
vttforge audit
```

Scans the manifest and source for the v13 footguns that fail quietly.
