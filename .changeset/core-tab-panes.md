---
'@vttforge/core': patch
---

The `vttforgeTab` action activates any element with the `tab` class, not only a `<section>`. A sheet whose panes are `<div class="tab">`, which is what most systems write, never switched tabs.
