---
layout: home
hero:
  name: VTTForge
  text: Build Foundry systems without the boilerplate
  tagline: An SDK and CLI for Foundry VTT v13+. Typed data models, sheets that already know their fields, and a dev loop that reloads in place.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/vttforge/vttforge
features:
  - title: Schemas that type themselves
    details: Write defineSchema once and this.level is a number inside prepareDerivedData. No second declaration to keep in sync, and no lie when a field can hold null.
  - title: A dev loop that does not reload the page
    details: Save a template and the open sheet redraws. Save a stylesheet and the CSS swaps. Only the windows showing what you changed.
  - title: Tests without a browser
    details: Mock the Foundry globals and drive a whole module lifecycle in Vitest. What a mock cannot answer runs in Quench, inside a real world.
---

## Why this exists

Every major Foundry version, good modules stop working. Sometimes the author
ports them and it costs weeks. More often the repository goes quiet and the
issue asking whether it will be updated never gets an answer.

What breaks is almost never the interesting part. It is the sheet plumbing, the
registration boilerplate, the class that moved namespace. The rules of the game
the author cared about are still correct.

VTTForge exists to hold that plumbing in one place. When Foundry moves it, the
change lands here, and a system or module built on it updates a dependency
instead of rewriting a sheet. If this project ever goes quiet, the build output
is plain ES modules that Foundry loads natively: delete the dependency and your
code is still your code.

The longer version, including what is still only a promise, is in the
[README](https://github.com/vttforge/vttforge#why-this-exists).
