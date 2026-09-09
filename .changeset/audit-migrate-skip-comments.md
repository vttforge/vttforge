---
'@vttforge/cli': patch
---

`vttforge audit` rules 011 to 016 and `vttforge migrate` no longer match inside comments. A call quoted in a JSDoc block or a `// TODO` line was a finding, and `migrate` rewrote it.
