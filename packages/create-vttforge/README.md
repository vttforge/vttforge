# create-vttforge

Scaffold a new Foundry VTT system or module with VTTForge.

```bash
pnpm create vttforge my-system
# or
npm create vttforge@latest my-system
# or
bun create vttforge my-system
# or
yarn create vttforge my-system
```

This package is a thin wrapper around `@vttforge/cli init`. The scaffolder asks for the package type, language, id, title, author, license, and Foundry version, then writes a runnable Foundry v13+ scaffold into the named directory.

See [`@vttforge/cli`](https://www.npmjs.com/package/@vttforge/cli) for the full CLI surface (`init`, `dev`, `build`, `audit`).
