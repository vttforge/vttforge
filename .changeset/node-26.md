---
'@vttforge/core': minor
'@vttforge/cli': minor
'@vttforge/vite-plugin': minor
'@vttforge/styles': minor
'@vttforge/types': minor
'@vttforge/testing': minor
'create-vttforge': minor
---

Require Node 26.

The floor moves from `>=22.14.0` to `>=26.0.0` across every package and the
four scaffolding templates, and the bundler target for the Node-side
packages moves from `node22` to `node26`.

Node 22 entered maintenance in October 2025 and receives security fixes
only. Node 26 becomes the active LTS line on 2026-10-28.

This is breaking for anyone on Node 22 or 24. It is marked `minor` rather
than `major` on purpose: these packages are still on 0.x, where a minor
signals the break, and a major would push every package to 1.0.0 — a claim
of API stability that has not been audited, on packages two of which are
still stubs.

The templates move to the versions this release publishes. On 0.x a caret
pins the minor, so their old ranges would not have matched.

CI now pins Node through `actions/setup-node` instead of inheriting whatever
the runner image ships, so the version the packages declare is the version
they are tested on. It was not before: the workflow took the image's Node,
and nothing enforced the declared floor because `engine-strict` is not set.
