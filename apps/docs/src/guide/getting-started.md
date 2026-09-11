# Getting started

## Scaffold

```bash
pnpm create vttforge my-system --type system --lang ts
cd my-system
pnpm build
```

Pass `--type module` for a module. Everything below is the same either way:
the same data models, the same sheet bases, the same build, the same dev loop.
What differs is what you reach for afterwards, and the
[modules guide](/guide/modules) covers that.

`create` installs for you, so there is no separate install step. If you would
rather not go through it, `npx @vttforge/cli init` takes the same arguments.

That produces a Foundry-loadable tree in `dist/` and a release zip with the
manifest at the root, which is what foundryvtt.com expects.

Everything is a flag, so this works in CI too:

```bash
vttforge init my-system --type system --lang ts \
  --title "My System" --license MIT --yes
```

## Point Foundry at it

```bash
vttforge dev
```

This builds, symlinks `dist/` into your Foundry data directory, and watches.
The first run asks where Foundry keeps its data and remembers the answer.

If Foundry runs in a container it cannot follow that symlink, and `vttforge
dev` prints the compose mount line to use instead.

## What you get

A system with one Actor type, one Item type, sheets for both, a migration
runner, and a settings registration. A module scaffolds its own sub-type under
the `<module id>.<type>` prefix Foundry files it under, with the sheet to
match. All of it is real code you are meant to edit.

Run `vttforge audit` at any point. It checks the manifest and source against
the v14 catalog of things that break quietly.
