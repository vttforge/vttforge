---
'@vttforge/cli': patch
---

Build each ability score from a factory rather than one shared options object.

A field keeps a reference to the options it was handed, and some field classes write back into that object. Six fields sharing one object is safe for the field this template uses, but it is not a habit to teach in code people copy and adapt.
