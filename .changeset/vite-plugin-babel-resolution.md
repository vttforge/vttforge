---
'@vttforge/vite-plugin': patch
---

The decorator lowering passes the Babel plugin as a module instead of by name. Babel resolved the name from the consumer's project root, where the package is not installed, so every build outside this repository failed with "Cannot find package '@babel/plugin-proposal-decorators'".
