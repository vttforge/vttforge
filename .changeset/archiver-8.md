---
'@vttforge/cli': patch
---

Move the release-zip writer to archiver 8.

Archiver 8 is ESM-only and dropped its default export, so the old
`archiver('zip', options)` factory call is gone. The writer now builds the
named `ZipArchive` class directly. Same options, same output: package
contents sit at the zip root with no wrapper folder, and LICENSE, README
and CHANGELOG still ride along from the project root when present.
