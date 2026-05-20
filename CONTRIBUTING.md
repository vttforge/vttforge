# Contributing to VTTForge

Thanks for considering a contribution. VTTForge is in pre-v0.1 — the core API is being shaped against a real production system ([Ordem Paranormal RPG](https://github.com/fcsouza/ordemparanormal_fvtt)) before stabilising. The most useful contributions today are different from when the SDK is stable.

## What's most useful right now (pre-v0.1)

- **Boilerplate reports** — open an issue with a pattern from your own FoundryVTT system or module that VTTForge could eliminate. See [PRD §3](./PRD.md#3-problem-statement) for the kind of patterns we're cataloguing.
- **API design feedback** — read [PRD §7](./PRD.md#7-api-design) and tell us where the shape feels wrong before it ships.
- **Docs / typo fixes** — always welcome via PR.
- **Trying the v0.1 release** when it lands — early adopters who can give feedback on rough edges are gold.

Once the core API stabilises in v1.0, we'll open up to broader code contributions.

## Code contributions (when the monorepo lands)

The sections below describe the workflow once `@vttforge/core` source code exists. They're forward-looking — verify against the actual repo state when you read this.

### Prerequisites

- **Node.js 22.14 or higher** — required for npm Trusted Publishing and modern features used in the SDK
- **Corepack enabled** — handles the pinned `pnpm` version automatically:
  ```bash
  corepack enable
  ```
- **A FoundryVTT v13 installation** if you're working on sheet/runtime features

### Setup

```bash
git clone https://github.com/vttforge/vttforge.git
cd vttforge
corepack enable          # picks up pinned pnpm from package.json#packageManager
pnpm install
```

### Common commands

```bash
pnpm dev            # Watch mode across all packages (Turborepo orchestrated)
pnpm test           # Run Vitest across the monorepo
pnpm typecheck      # tsc --noEmit across all packages
pnpm lint           # Biome lint + format check
pnpm build          # tsdown build of every package
```

### Adding a changeset

If your PR changes anything user-visible in any `@vttforge/*` package, **add a changeset**:

```bash
pnpm changeset
```

This walks you through which packages changed and at what semver level (patch/minor/major). The `changeset-bot` GitHub App will also remind you on the PR if you forget.

### Commit style

We use [Conventional Commits](https://www.conventionalcommits.org). Examples:

- `feat(core): add SystemConfig.getFlag`
- `fix(vite-plugin): manifest sync drops styles field on rebuild`
- `docs(prd): clarify v0.1 schema inference scope`
- `chore(deps): bump tsdown to 0.22.1`

Scopes match package names (`core`, `cli`, `vite-plugin`, `styles`, `testing`, `types`) or one of `docs`, `prd`, `ci`, `deps`, `release`.

### Pull request checklist

Before you open a PR, make sure:

- [ ] A changeset is included if any package changed (see above)
- [ ] Tests added/updated for behaviour changes
- [ ] `pnpm typecheck` + `pnpm test` + `pnpm lint` pass locally
- [ ] Docs updated if the change is user-visible
- [ ] If you touched an API marked stable in PRD §7, the change has a strong rationale

The PR template surfaces this same checklist.

## Reporting security issues

Do **not** open a public issue for security vulnerabilities. See [SECURITY.md](./SECURITY.md).

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
