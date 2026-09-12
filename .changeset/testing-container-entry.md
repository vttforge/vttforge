---
'@vttforge/testing': minor
---

New entry point: `@vttforge/testing/container` boots a real Foundry in Docker,
installs your build into it, and hands back the URL it answers on.

Until now a package built on this SDK could test against mocks under Vitest, or
against a world a person opened under Quench, and had nothing for the case in
between: a CI job with no world, checking that the package it just built loads
at all. The code that does this ran only inside this repo. It is published now.

```ts
import { startFoundryContainer } from '@vttforge/testing/container';

const foundry = await startFoundryContainer({
  acceptLicense: true,
  name: 'my-module-e2e',
  packages: [
    { kind: 'system', id: 'some-system', from: 'test/fixtures/system' },
    { kind: 'module', id: 'my-module', from: 'dist' },
  ],
});

try {
  await page.goto(foundry.baseUrl);
} finally {
  foundry.stop();
}
```

Needs `docker` on the PATH, plus `FOUNDRY_LICENSE_KEY`, `FOUNDRY_USERNAME` and
`FOUNDRY_PASSWORD` in the environment. Docker reads each by name, so no
credential lands in an argument list.

**You accept the licence, not this code.** Booting Foundry records an answer to
its licence agreement. `startFoundryContainer` throws unless you pass
`acceptLicense: true` or set `FOUNDRY_ACCEPT_LICENSE=1`. Read the agreement
first.

Two things the API is shaped around. Foundry scans its packages directory once,
at startup, so `packages` installs before the world launches and a package
added later needs `restart()`. And the container name, the volume and the world
id all default, so two runs sharing a name fight over one container: name them
per project.

`stopFoundryContainer(name)` and `foundryContainerLogs(name)` do the same as the
handle's `stop()` and `logs()`, for a teardown script running in its own process
and for a boot that failed before there was a handle to hold.

Nothing existing changes. The root, `/vitest` and `/quench` entries are
untouched, and the new one is not re-exported from the root, because it reads
`node:child_process` and would break a browser-side import of the package.
