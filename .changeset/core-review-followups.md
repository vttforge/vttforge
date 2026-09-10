---
"@vttforge/core": patch
---

The keywords journal finds its page by flag and rewrites only that page, so pages the GM adds to the journal survive a sync, and a deleted page comes back without touching the others. `postRoll` merges `vttforge.roll` into the scope's existing `vttforge` flags instead of replacing them.
