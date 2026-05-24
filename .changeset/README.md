# Changesets

This folder contains [changesets](https://github.com/changesets/changesets) — small markdown files describing the user-visible impact of a change. Each PR that touches a published `@vttforge/*` package should ship with one.

Add one with:

```bash
pnpm changeset
```

The walkthrough asks which packages changed and at what semver level (patch / minor / major). Changesets are consumed by the release workflow (`.github/workflows/changesets.yml`) which opens a Version PR that bumps versions and updates each package's `CHANGELOG.md`.
