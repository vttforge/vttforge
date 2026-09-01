# @vttforge/dev-module

## 0.2.1

### Patch Changes

- d015aee: Stop requiring Node 26 to install a browser package.
  
  Every package declared `engines.node: ">=26.0.0"`. Four of them — `core`, `styles`, `types` and `dev-module` — compile to ES2022 and run in the browser inside Foundry. They never touch Node, and the floor did nothing except stop anyone on Node 22 LTS from installing the SDK at all.
  
  Those four declare no engine now. `@vttforge/testing` drops to `>=22` — its Quench half runs in the browser too. `@vttforge/cli` and `@vttforge/vite-plugin` keep `>=26`, which is what they actually build against.

## 0.2.0

### Minor Changes

- 17a6b8c: Redraw only the sheets a template change actually affects.
  
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

## 0.1.0

### Minor Changes

- b8fb50e: Add `@vttforge/dev-module`, the Foundry side of `vttforge dev`.
  
  It applies stylesheet, template and language changes to a running world
  without a page reload, and fires the `hotReload` veto hook first so a module
  that suppresses Foundry's own hot reload suppresses this one too.
  
  Foundry's dispatcher could not be reused: its socket handler is a private
  method, and the `hotReload` hook fired inside it is a veto rather than an
  entry point — calling that hook from outside notifies listeners and does
  nothing else. The three handlers are reimplemented here against public API.
  
  One deliberate difference from Foundry's own behaviour: a stylesheet is
  matched on its resolved pathname, not on `link.href` compared against the
  payload's root-relative path. Those two never match, so that branch does not
  fire.
