---
"@vttforge/cli": minor
---

`vttforge audit` rule `VTTF-AUDIT-020` (HIGH): a release workflow that zips the checkout of a project that builds to `dist/`, or builds and then zips the source tree. The published package has no entry file and no world starts on it, and nothing says so until a player installs it. `vttforge migrate` reports the same workflow as needing a decision, since the rewrite is what moves a project onto the build.
