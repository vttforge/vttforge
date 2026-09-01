---
'@vttforge/cli': patch
---

Point the templates at the CLI version this release publishes.

The templates asked for `@vttforge/cli@^0.2.0` while the release takes it to
0.3.0. A caret pins the minor on a 0.x version, so that range would not have
matched — every project scaffolded after the release would ask for a version
the release had just superseded.
