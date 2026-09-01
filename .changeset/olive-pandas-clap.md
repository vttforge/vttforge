---
'@vttforge/testing': patch
---

The ambient globals now arrive with the import.

They shipped as a separate `@vttforge/testing/globals` export, documented for `compilerOptions.types`. That does not work: `types` entries resolve against package roots, not subpath exports, and a consumer following the README got `Cannot find type definition file`.

Importing from `@vttforge/testing/vitest` declares them instead — the import a test already writes is the moment it needs them, and there is nothing to configure.

Found by using the package from `@vttforge/core`.
