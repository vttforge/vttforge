---
"@vttforge/core": minor
---

`keywords` on `registerSystem` and `registerModule`: a list of rules terms, each an id, a label and a description. `@Keyword[id]` in any rich text becomes the label with the description as tooltip, and on `ready` the GM's client writes all of them to a journal entry (named by `keywordsJournal`, or skipped with `false`) and rewrites it when the list changes. A bad or repeated id is refused with VTTF-0009.
