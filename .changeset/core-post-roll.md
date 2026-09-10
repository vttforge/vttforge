---
"@vttforge/core": minor
---

`postRoll(roll, options)` posts a roll to chat as a card. It evaluates the roll if needed, decides a critical or a fumble from the first die by the `crit` and `fumble` thresholds you give (`true`, a number, or a function), tags the card with `vttf-roll--crit` or `vttf-roll--fumble` and a label, and stores the outcome in the message flags as `vttforge.roll` under your package's scope. `rollOutcome()` and `naturalResult()` expose the decision without posting.
