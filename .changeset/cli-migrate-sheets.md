---
"@vttforge/cli": minor
---

`vttforge migrate --sheets`: next to each Application v1 sheet class (`ActorSheet`, `ItemSheet`), write a file with the same class on `BaseActorSheet` / `BaseItemSheet`. `defaultOptions`, `tabs`, `dragDrop` and `template` become the V2 statics, `getData` becomes `_prepareContext`, each `html.find(sel).click(handler)` becomes an `actions` entry with the handler on the `(event, target)` signature, other events move to `_onRender`, the drop handlers take the resolved document, and the jQuery idioms with a DOM equivalent are rewritten. What cannot be decided is a `// TODO(migrate)` line, listed in the report. The templates the class names get the `data-action` and tab attributes the new class reads. Preview by default; `--write` writes the new files and the template edits and never touches the original class.
