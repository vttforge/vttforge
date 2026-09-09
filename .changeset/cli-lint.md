---
"@vttforge/cli": minor
---

`vttforge lint`: Biome over the project, then the v14 audit. Biome ships as a dependency of the CLI with `lint/vttforge-biome.json`, so a scaffolded project lints and formats without installing or configuring anything; a `biome.json` at the project root replaces the shipped config. `--fix` writes the safe fixes and formats, `--no-audit` skips the audit, `--strict` makes any audit finding fail. The templates gain `lint` and `format` scripts that call it.
