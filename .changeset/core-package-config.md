---
'@vttforge/core': minor
---

`SystemConfig` is now `PackageConfig`, and `createMigrationRunner` takes
`packageId`.

One thing changes behaviour. `createMigrationRunner` now throws VTTF-0017 when
the call carries neither id. Before, it registered the world's `schemaVersion`
under the string `undefined` and read it back from there for the life of the
world. TypeScript callers see it at build time: the options type is a union,
and a call with no id matches no branch. A JavaScript caller gets the throw on
world load, and its stored version is under `undefined`.

VTTF-0017 is its own code rather than the migration-failure one. A mistake in
the call is not a migration that failed, and a catch that reads the code has
to be able to tell them apart.

The rest is names. A module stores settings the same way a system does, and
runs migrations over its own stored data the same way. The old names said
otherwise, and a module author reading the reference had to work out that the
class was meant for them too.

`SystemConfig` is the same class under the old name, so `instanceof` holds
both ways and existing code keeps working. The instance property `systemId`
still answers, and `createMigrationRunner` still reads a `systemId` option
when `packageId` is absent. All three are deprecated and go away at 1.0.
