---
'@vttforge/cli': patch
---

Close the three soundness gaps `vttforge audit` shipped with, and a fourth
found while fixing them.

- `filePathFields` is an object whose keys are the field paths, not a flat
  array. Reading it as an array dropped every correctly declared path, so
  rule 004 reported declared fields as missing.
- Modules register subtypes as `<moduleId>.<type>` while the manifest
  declares the bare key. The two were compared verbatim, so no module
  registration ever matched its own declaration.
- Rule 007 searched every schema in the project for the token attribute.
  Token bars read `actor.system`, so an Item model declaring the same path
  satisfied the check on a system whose bars were in fact broken. The
  narrowing applies only when Actor registrations are known; with none
  found the rule falls back to the previous behaviour.
- Registrations through bracket notation were invisible to the scanner
  entirely — which is the only form modules can use, since a dot in the key
  rules out property access.
