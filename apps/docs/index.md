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
