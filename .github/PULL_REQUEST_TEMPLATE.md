<!--
Thanks for your PR! Fill in what's relevant — sections that don't apply can be removed.
-->

## What & why

<!-- One-paragraph summary: what does this change and why. Link any relevant issues. -->

Closes #

## Type of change

<!-- Check all that apply -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing usage to fail)
- [ ] Docs only
- [ ] Build / CI / tooling only

## Affected packages

<!-- Check all that apply -->

- [ ] `@vttforge/core`
- [ ] `@vttforge/styles`
- [ ] `@vttforge/cli`
- [ ] `@vttforge/vite-plugin`
- [ ] `@vttforge/testing`
- [ ] `@vttforge/types`
- [ ] Root tooling / monorepo
- [ ] Documentation

## Checklist

- [ ] Changeset added (`pnpm changeset`) for every user-visible package change
- [ ] Tests added or updated for behaviour changes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm lint` passes (Biome + syncpack)
- [ ] If a public API changed: PRD §7 updated and CHANGELOG entry phrased for end users
- [ ] If a new error path was added: a `VTTF-NNNN` registry entry was added in `packages/core/src/errors/registry.ts` and the docs page generates correctly

## Additional notes

<!-- Anything the reviewer should know: trade-offs, follow-ups, screenshots, etc. -->
