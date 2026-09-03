---
"@vttforge/cli": patch
---

The scaffolding sheet templates no longer open a `<form>` the sheet already is. `BaseActorSheet` and `BaseItemSheet` set `tag: 'form'`, so the application element is the form; the nested one owned every field inside it, and the submit read the outer element and found nothing. A scaffolded project's sheets accepted every edit and dropped it when the window closed, with no error. Found by the new `VTTF-AUDIT-008`, which reported it against all four templates the first time it ran.
