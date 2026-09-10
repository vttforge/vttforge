# End-to-end: the SDK inside a real Foundry

Boots Foundry v14 in Docker with `examples/simple-system` and
`examples/simple-module` installed, joins the world as the Gamemaster, and
asserts what only a running Foundry can answer.

```bash
cp .env.example .env      # at the repo root: your Foundry licence and login
pnpm build
pnpm test:e2e
```

## What it covers

| Test | The claim |
|---|---|
| System registration | `registerSystem` put the data models, the initiative formula, the settings and the Active Effect flag where Foundry reads them |
| Sheet keys | Foundry files each sheet under `vttforge-example.<id>`, the key it writes onto every document. That is why `sheets` takes an `id`, and a mock cannot prove it |
| Sheet render | A character sheet draws its four tabs, six abilities and an inventory row, and `prepareDerivedData` produced the numbers on it |
| Module sub-types | Foundry files the module's `note` type as `vttforge-example-module.note`, never as `note`, with its sheet, its enricher and its API |

Any console error naming VTTForge fails the run.

## How it boots

The harness never drives Foundry's setup screens, because that is the part
that would rot. Three plain steps replace them:

1. The end-user licence is a real HTML form. One POST signs it.
2. A world is a directory with a manifest. Writing `world.json` declares it.
3. `Config/options.json` has a `world` field. Setting it launches that world
   on the next start, which also creates the Gamemaster.

The browser only joins a world that is already running.

## Running inside a container

CI runs this from a container that shares the host's Docker daemon, which
moves two things:

- **Paths.** The host resolves every path in a `docker` command, not this
  process, so a bind mount and a `writeFileSync` to the same string are two
  different directories. The harness seeds everything through `docker cp` into
  a named volume instead, which crosses that boundary from either side.
- **The network.** A published port lands on the host, which is not this
  process's `localhost`. When there is a container to join, Foundry joins its
  network and answers by name; otherwise it publishes the port and answers on
  localhost. The harness works this out on its own.

## Credentials

The [felddy/foundryvtt](https://hub.docker.com/r/felddy/foundryvtt) image
downloads a licensed Foundry, so it needs `FOUNDRY_LICENSE_KEY`,
`FOUNDRY_USERNAME` and `FOUNDRY_PASSWORD`. Without them the run stops and says
which are missing. They are personal, so this does not run on pull requests
from forks, which get no secrets.

Foundry's data lives in a named Docker volume, `vttforge-e2e-data`, so you pay
for the licensed download once and reuse it. `docker volume rm
vttforge-e2e-data` starts over.
