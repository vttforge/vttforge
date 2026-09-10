---
layout: home
hero:
  name: VTTForge
  text: Build Foundry systems without the boilerplate
  tagline: An SDK and CLI for Foundry VTT v14+. Typed data models, sheets built on them, and a dev loop that reloads in place.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/vttforge/vttforge
features:
  - title: Schemas that type themselves
    details: Write defineSchema once and this.level is a number inside prepareDerivedData. There is no second declaration to keep in sync, and a field that can hold null types as nullable.
  - title: A dev loop that does not reload the page
    details: Save a template and only the windows using it redraw; save a stylesheet and the CSS swaps with no re-render.
  - title: Tests without a browser
    details: Mock the Foundry globals and drive a whole module lifecycle in Vitest. Quench covers the cases a mock cannot answer, inside a real world.
---

## Why this exists

Every major Foundry version, good modules stop working. Porting one costs the
author weeks, and usually nobody does: the repository goes quiet and the
issue asking whether it will be updated never gets an answer.

What breaks is the sheet plumbing, the registration boilerplate, the class
that moved namespace. The rules of the game the author cared about are still
correct.

VTTForge holds that plumbing in one place. When Foundry moves it, the change
lands here, and a system or module built on it updates a dependency rather
than rewriting a sheet. If this project ever goes quiet, the build output is
plain ES modules that Foundry loads natively, so you can remove the dependency
and keep the code.

The longer version, including what is still only a promise, is in the
[README](https://github.com/vttforge/vttforge#why-this-exists).
