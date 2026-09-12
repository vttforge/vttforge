---
'@vttforge/core': minor
---

`BaseHandlebarsApplication()` builds an `ApplicationV2` with the Handlebars
mixin already applied.

`BaseActorSheet` and `BaseItemSheet` carried the mixin; `BaseApplication` did
not. So a standalone templated window, a config screen, a picker, a report,
had no typed base and had to reach into the untyped `foundry.*` global for the
mixin or hand-roll `_renderHTML` around `renderTemplate`.

```ts
class ReportWindow extends BaseHandlebarsApplication() {
  static PARTS = { body: { template: 'modules/my-module/templates/report.hbs' } };
  override async _prepareContext() {
    return { rows: collectRows() };
  }
}
```

`override` is required, not merely allowed. The factory reports what it adds,
so TypeScript sees the member being replaced, and a scaffolded project sets
`noImplicitOverride`. The `BaseActorSheet` and `BaseItemSheet` examples were
missing the same word on `DEFAULT_OPTIONS`, and now carry it.

A subclass that declares no `static PARTS` throws `VTTF-0002` when it is
constructed. Without the check the window opens, renders nothing and says
nothing about why.

`BaseApplication` is unchanged. Use it when the markup comes from code.
