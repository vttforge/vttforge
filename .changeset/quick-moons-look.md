---
'@vttforge/core': minor
---

`BaseDocumentSheet` — a document sheet that builds its own DOM.

`BaseActorSheet` and `BaseItemSheet` are `HandlebarsApplicationMixin` baselines, which is right for the common case: declare `static PARTS`, write templates, let the mixin render them.

It is wrong for a sheet whose content is not a template — a canvas, an embedded PDF, a Svelte or Lit mount. Extending the Handlebars baseline for one of those does not fail loudly: the mixin's `_replaceHTML` expects a map of part id to markup, receives an element instead, and quietly renders nothing. The window opens empty, or does not open, and no error names the mismatch.

Found porting a PDF-backed actor sheet onto the SDK, where the symptom was a sheet that had rendered a moment earlier going blank with a clean console.
