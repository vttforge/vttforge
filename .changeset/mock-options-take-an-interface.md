---
'@vttforge/testing': patch
---

`modules`, `actors`, `items` and `journal` take fixtures declared as an
interface, not only object literals.

`MockModuleOptions` and `MockWorldDocument` carried an index signature, and an
interface never satisfies one. So a test that declared its fixtures the ordinary
way:

```ts
interface Handle { id: string; title: string; version: string }
withMockFoundry({ modules: handles });
```

failed to compile with "Index signature for type 'string' is missing in type
'Handle'", which reads like a puzzle when the object plainly has the fields the
option wants. Both types are unions now, so the strict shape, an interface and a
loose record all fit. Nothing that compiled before stops compiling.
