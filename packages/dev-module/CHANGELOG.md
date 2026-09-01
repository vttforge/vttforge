# @vttforge/dev-module

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
