---
'@vttforge/dev-module': minor
'@vttforge/cli': minor
---

Redraw only the sheets a template change actually affects.

A sheet declares its templates in `static PARTS`, so the mapping is on the
open window itself — no build-time graph needed. Each part names a primary
`template` and may list further `templates`, which is where a partial it
pulls in appears. Only the affected parts re-render, so scroll position and
focus survive everywhere else. When nothing claims the file the whole screen
still redraws, because a partial can be reached without any part naming it.

The watcher now also skips a file whose content did not change. Vite rewrites
its entire output on every build, so a filesystem event alone means "the
bundler ran", not "the developer edited this" — and without this the language
file gets resent untouched on every save, and the JSON path redraws every open
window, undoing the scoping on the file that did change.

Measured in a running world with 21 applications open: editing one sheet
template went from 35 renders to 1.
