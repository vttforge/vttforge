# Settings and migrations

## Settings

`PackageConfig` wraps `game.settings` with the package id filled in:

```ts
import { PackageConfig } from '@vttforge/core';

const settings = new PackageConfig('my-system');

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
returning `undefined`, so a typo in a setting name surfaces the first time the
key is read.

Registration has to happen inside `init`. Reads work from `setup` on. See [the
startup lifecycle](/guide/lifecycle) for what each stage can do.

The class used to be called `SystemConfig`. A module stores settings the same
way a system does, and the old name said otherwise. `SystemConfig` is the same
class under the old name, so `instanceof` holds and existing code keeps
working; the instance property `systemId` still answers too. Both go away at
1.0.

## Migrations

`createMigrationRunner` owns the code every package otherwise writes by hand: a
`schemaVersion` world setting, a compare on `ready`, and a loop of `await`s. A
module with stored data of its own needs it as much as a system does.

```ts
import { createMigrationRunner } from '@vttforge/core';

export const migrations = createMigrationRunner({
  packageId: 'my-system',
  compatibleVersion: '0.0.0',
  migrations: [
    {
      version: '0.2.0',
      description: 'bio → biography',
      fn: async () => {
        for (const actor of game.actors.filter((a) => a.type === 'character')) {
          const legacy = actor.system.bio;
          if (typeof legacy !== 'string') continue;
          await actor.update({ 'system.biography': legacy, 'system.bio': _del });
        }
      },
    },
  ],
});
```

The option used to be called `systemId`. It is still read when `packageId` is
absent, and it goes away at 1.0. Pass neither and the call throws
[VTTF-0017](../errors/VTTF-0017): the id is the settings namespace, and
without it the world would keep its `schemaVersion` under the string
`undefined`. TypeScript refuses the call before that, at build time.

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

Write each migration so it can run twice. The `typeof legacy !== 'string'`
check above makes that one safe.

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
