---
'@vttforge/cli': patch
---

Move to citty 0.2 and cover argument parsing with tests.

citty 0.2 is ESM-only, drops its runtime dependencies, and rewrites the
parser on top of `node:util.parseArgs`. Parsing behaviour is unchanged for
every flag this CLI defines — negation, aliases, positionals, `--flag=value`
and boolean defaults all produce identical results on 0.1.6 and 0.2.2.

The command tree moves from `bin.ts` to `cli.ts`, leaving the bin as the
launch only. The definitions were unreachable from tests before, because a
module that calls `runMain` on import runs the CLI. They are now covered,
including `--no-install` and `--no-git`, which would have made the
scaffolder install dependencies for someone who asked it not to had the
parser rewrite changed them.
