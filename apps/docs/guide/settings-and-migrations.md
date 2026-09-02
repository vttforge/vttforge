# Settings and migrations

## Settings

`SystemConfig` wraps `game.settings` with the package id filled in:

```ts
import { SystemConfig } from '@vttforge/core';

const settings = new SystemConfig('my-system');

// inside init; `onAfterInit` in registerSystem is the place
settings.register('showTutorial', {
  name: 'MY.Settings.showTutorial.name',
  hint: 'MY.Settings.showTutorial.hint',
  scope: 'client',
  config: true,
  type: Boolean,
  default: true,
});

// anywhere after
if (settings.get<boolean>('showTutorial')) { /* … */ }
```

Reading a key that was never registered throws `VTTF-0003` instead of
returning `undefined`. A typo in a setting name is found the first time it is
read, not by a user who wonders why a switch does nothing.

Registration has to happen inside `init`. Reads work any time after.

## Migrations

Every system grows the same code: a `schemaVersion` world setting, a compare on
`ready`, a loop of `await`s. `createMigrationRunner` owns that.

```ts
import { createMigrationRunner } from '@vttforge/core';

export const migrations = createMigrationRunner({
  systemId: 'my-system',
  compatibleVersion: '0.0.0',
  migrations: [
    {
      version: '0.2.0',
      description: 'bio → biography',
      fn: async () => {
        for (const actor of game.actors.filter((a) => a.type === 'character')) {
          const legacy = actor.system.bio;
          if (typeof legacy !== 'string') continue;
          await actor.update({ 'system.biography': legacy, '-=system.bio': null });
        }
      },
    },
  ],
});
```

Wire it into `registerSystem`:

```ts
registerSystem({
  id: 'my-system',
  onAfterInit: () => migrations.register(),   // the schemaVersion setting
  onReady: async () => {
    if (!game.user.isGM) return;              // migrations write to the world
    await migrations.run();
  },
});
```

`run()` compares each migration's `version` against the stored one with
`foundry.utils.isNewerVersion` and runs the newer ones in order. The stored
version advances only past migrations that finished. A throw in the middle
leaves the world at the last good version, and the next load retries from
there.

Write each migration so it can run twice. The `typeof legacy !== 'string'` check above is what makes that one
safe.

### The manifest flags

Foundry reads two flags from `system.json` to warn users before a world
loads on a version that will migrate it:

```json
"flags": {
  "my-system": {
    "needsMigrationVersion": "0.2.0",
    "compatibleMigrationVersion": "0.0.0"
  }
}
```

Keep `needsMigrationVersion` equal to the highest `version` in your list, and
`compatibleMigrationVersion` equal to the runner's `compatibleVersion`. The
scaffold ships both filled in.
