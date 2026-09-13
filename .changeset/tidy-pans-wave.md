---
'@vttforge/testing': minor
---

`createMockConfig()` now gives every `documentClass` a working `create` and `createDocuments`. Each returns a mock document of that entry's kind. The class was empty before, so a test that called `CONFIG.Item.documentClass.create(...)` threw.
