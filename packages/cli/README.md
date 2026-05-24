# @vttforge/cli

VTTForge CLI — scaffolding (`vttforge init`), dev server orchestration (`vttforge dev`), and production builds (`vttforge build`).

> **Status:** v0.0.1 placeholder. Implementation lands in v0.3.0.

## Planned commands (v0.3.0)

```bash
vttforge init <name> --type system|module --lang ts|js
vttforge dev --foundry-data <path>
vttforge build
```

Stack: Citty (commands) + Giget (template fetching) + Clack (prompts).
