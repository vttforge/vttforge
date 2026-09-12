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
  async _prepareContext() {
    return { rows: collectRows() };
  }
}
```

A subclass that declares no `static PARTS` throws `VTTF-0002` when it is
constructed. Without the check the window opens, renders nothing and says
nothing about why.

`BaseApplication` is unchanged. Use it when the markup comes from code.
