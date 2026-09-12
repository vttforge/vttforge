---
'@vttforge/cli': minor
---

Five fixes found by building a module on the SDK from scratch, outside this
repo.

**The TypeScript templates type the Foundry globals.** `foundry-globals.ts`
declared `game`, `CONFIG`, `Hooks`, `ui` and `foundry` as `any`, and its
comment said `@vttforge/types` was still to come. It shipped. The file is now
`foundry-globals.d.ts`, where an ambient declaration belongs, and it imports
from `@vttforge/types`. `foundry.*` is narrowed to the members the template
reaches for rather than widened to `any`, because a typo in a namespaced path
is the kind of mistake that only shows up at runtime. The entry point no
longer imports the file: a `.d.ts` is picked up by `include`.

**Breaking for a scaffolded project you have already edited.** Typed globals
report mistakes the `any` declarations accepted. Delete
`scripts/foundry-globals.ts`, take the new `.d.ts`, and drop the
`import './foundry-globals.js';` line from your entry point.

**`create-vttforge` forwards every flag `vttforge init` takes.** It carried
four, so `--id`, `--title`, `--description`, `--author`, `--license` and
`--yes` were unreachable through `npm create vttforge`, which is the entry
point most people use. A scaffold came out holding the template's placeholder
description.

**`vttforge lint` stops reporting `noThisInStatic`.** ApplicationV2 calls an
action handler with `this` bound to the instance even though the handler is
declared static, which is how Foundry's own documentation writes it. The
rule's suggested fix compiles and then fails at runtime.

**`vttforge audit` no longer reads a TypeScript member signature as a bare v13
global.** `renderTemplate(path: string, context: unknown): Promise<string>`
inside an `interface` declares the namespaced member; rule 019 called it a use
of the removed alias. A call in a ternary is still flagged.

**The release workflow the templates ship matches the Node and pnpm the
templates require.** It ran Node 22 and pnpm 10 against an `engines.node` of
`>=26`.

The scaffold templates pin `@vttforge/cli` at `^0.18.0` and add
`@vttforge/types` at `^0.5.0`, the versions this release publishes. A caret
pins the minor on a 0.x line.
