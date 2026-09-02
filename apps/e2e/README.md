# End-to-end: the SDK inside a real Foundry

Boots Foundry v13 in Docker with `examples/simple-system` and
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
| Sheet keys | Each sheet is filed under `vttforge-example.<id>`, the key Foundry writes onto every document. This is the whole reason `sheets` takes an `id`, and a mock cannot prove it |
| Sheet render | A character sheet draws its four tabs, six abilities and an inventory row, and `prepareDerivedData` produced the numbers on it |
| Module sub-types | The module's `note` type is filed as `vttforge-example-module.note`, never as `note`, with its sheet, its enricher and its API |

Any console error naming VTTForge fails the run.

## How it boots

Foundry's setup screens are never driven, because that is the part that would
rot. Three plain steps replace them:

1. The end-user licence is a real HTML form. One POST signs it.
2. A world is a directory with a manifest. Writing `world.json` declares it.
3. `Config/options.json` has a `world` field. Setting it launches that world
   on the next start, which also creates the Gamemaster.

The browser only joins a world that is already running.

## Credentials

The [felddy/foundryvtt](https://hub.docker.com/r/felddy/foundryvtt) image
downloads a licensed Foundry, so it needs `FOUNDRY_LICENSE_KEY`,
`FOUNDRY_USERNAME` and `FOUNDRY_PASSWORD`. Without them the run stops and says
which are missing. They are personal, so this does not run on pull requests
from forks, where secrets are not available by design.

The downloaded Foundry is cached in `.foundry/container_cache`, so only the
first run pays for it.
