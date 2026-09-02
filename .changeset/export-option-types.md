---
"@vttforge/core": patch
"@vttforge/testing": patch
---

Export the option and config interfaces that public functions already took: `MockDocumentOptions` and `MockFoundryOptions` from `@vttforge/testing`, `ActorConfig` and `ItemConfig` from `@vttforge/core`. They were reachable through the functions but could not be named.
