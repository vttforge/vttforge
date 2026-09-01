---
'@vttforge/cli': minor
---

`vttforge init` can now run without a terminal.

Five values — id, title, description, author, license — were always asked for, with no flag to supply them. Clack prompts read from stdin, so with none attached the scaffolder hung: no error, no output, nothing to debug. That ruled out CI and scripts, and meant nothing could test the scaffolder through its own entry point.

Each now has a flag, and `--yes` (`-y`) takes the default for anything not passed. A run with no terminal assumes `--yes`, so CI needs no extra flag.

```bash
vttforge init pdf-character-sheet --type module --lang ts \
  --title "PDF Character Sheet" --license Apache-2.0 --yes
```

The directory name is the one thing with no sensible default. Without a terminal to ask, the run stops and says so.
