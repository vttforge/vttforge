---
"@vttforge/core": minor
---

Add `createMigrationRunner()` for declarative schema migrations, plus
`onReady` lifecycle on `registerSystem()`.

`createMigrationRunner({ systemId, migrations, ... })` returns `{ register(),
run(), targetVersion }`. Call `register()` from `init` to register the
`schemaVersion` setting; call `run()` from `ready` (gated by
`game.user.isGM`) to execute every pending migration in order. Migrations use
semver versions and `foundry.utils.isNewerVersion` for comparison — the same
contract `system.json`'s `flags.<systemId>.needsMigrationVersion` /
`compatibleMigrationVersion` use.

Failure semantics: `schemaVersion` is committed per-migration, so a
mid-sequence throw leaves the world at the last successful version and the
retry on the next world load picks up exactly where it failed. Migration
errors are wrapped in `VttfError VTTF-0004` with the original error on
`.cause`; calling `run()` against a world older than `compatibleVersion`
throws `VttfError VTTF-0005`.

`registerSystem()` gains `onReady?: () => void | Promise<void>` — the natural
place to wire `migrationRunner.run()`. Not GM-gated; consumer guards inside
their callback.

New error codes (append-only): `VTTF-0004 MigrationFailed`,
`VTTF-0005 WorldTooOldForMigration`.
