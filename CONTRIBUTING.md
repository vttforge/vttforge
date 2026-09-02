# Contributing to VTTForge

Thanks for considering it. Every package is on npm and below 1.0, so the API still moves. That makes these the most useful contributions today:

- **Boilerplate reports.** Open an issue with a pattern from your own Foundry system or module that VTTForge could take off your hands.
- **API feedback.** Where the shape feels wrong, say so before it hardens at 1.0.
- **Bug reports with a reproduction.** A scaffolded project plus the diff that breaks it is ideal.
- **Docs fixes.** Always welcome.

Code contributions are welcome too. The workflow is below.

## Prerequisites

- **Node.js 26 or higher.**
- **Corepack enabled.** It picks the pinned `pnpm` from `package.json#packageManager`:
  ```bash
  corepack enable
  ```
- **A Foundry VTT v13 installation**, or Docker plus a foundryvtt.com license, for anything that touches sheets or the dev loop.

## Setup

```bash
git clone https://github.com/vttforge/vttforge.git
cd vttforge
corepack enable
pnpm install
```

## Commands

```bash
pnpm build          # tsdown build of every package
pnpm test           # Vitest across the monorepo
pnpm typecheck      # tsc --noEmit across all packages
pnpm lint           # Biome, syncpack, and the template pin check
pnpm format         # Biome, writing fixes
pnpm knip           # unused exports and dependencies
```

`pnpm lint` may print a Biome out-of-memory warning under some terminals. It is the parent shell's TTY setup, not the code: run it as `bash -c "pnpm lint"` and it goes away.

## Running Foundry locally

For sheet or runtime work you want a real Foundry v13 with the example system loaded. `docker-compose.dev.yml` uses the [felddy/foundryvtt](https://hub.docker.com/r/felddy/foundryvtt) image and mounts the **built** `examples/simple-system` and `examples/simple-module` read-only into the container's data tree.

1. Copy the env template and fill in your Foundry license and foundryvtt.com login. They stay on your machine; never commit `.env`.
   ```bash
   cp .env.example .env
   ```
2. Build the examples once, so `dist/` exists for the mounts:
   ```bash
   pnpm -F @vttforge-examples/simple-system build
   pnpm -F @vttforge-examples/simple-module build
   ```
   Use `dev` instead of `build` to keep rebuilding on every edit.
3. Start Foundry:
   ```bash
   docker compose -f docker-compose.dev.yml up
   ```
4. Open <http://localhost:30000>. The first boot downloads the licensed Foundry build into the `foundry-dev-data` volume; later boots are fast.
5. Create a world on **VTTForge Example**, or enable the example module in any world.

`Ctrl+C` stops the container. `docker compose -f docker-compose.dev.yml down -v` wipes worlds and settings.

Foundry credentials are personal and license-gated, so CI does not run Foundry. Each contributor smoke-tests locally.

## Changesets

If your PR changes anything user-visible in a `@vttforge/*` package, add a changeset:

```bash
pnpm changeset
```

It asks which packages changed and at what level. The bot reminds you on the PR if you forget.

## Commit style

[Conventional Commits](https://www.conventionalcommits.org):

- `feat(core): add SystemConfig.getFlag`
- `fix(vite-plugin): manifest sync drops styles on rebuild`
- `docs: explain the sheet id`
- `chore(deps): bump tsdown`

Scopes are package names (`core`, `cli`, `vite-plugin`, `styles`, `testing`, `types`, `dev-module`) or `docs`, `ci`, `deps`, `release`. One scope per PR.

## Pull request checklist

- [ ] A changeset, if a package changed
- [ ] Tests for behaviour changes
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm lint` pass
- [ ] Docs updated if the change is user-visible

The PR template carries the same list.

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](./SECURITY.md).

## Code of Conduct

Participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

Contributions are licensed under the [MIT License](./LICENSE).
