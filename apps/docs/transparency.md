---
title: Transparency
---

# Transparency

VTTForge is two halves. One runs inside Foundry, in your players' browsers. The
other runs on your own machine, in your terminal. They deserve different
answers.

## What runs inside Foundry

`@vttforge/core`, `@vttforge/styles` and `@vttforge/dev-module` are what a
system or module built on VTTForge ships to a world.

**No network calls.** None of these packages calls out. There is no telemetry,
no analytics, no version check, no phone-home, because there is no code in them
that can make a request. The one exception is deliberate and local: while
`vttforge dev` is running, the companion module opens a WebSocket to
`localhost` (or `host.docker.internal` when Foundry is in a container) to hear
that a file changed. It is never installed in a world you publish.

**No third-party runtime dependencies.** `styles`, `testing`, `types`,
`vite-plugin` and `dev-module` have none at all. `core` has one,
`@vttforge/types`, which is types only and disappears at build time.

**Nothing about your world is read or sent.** The SDK registers your data
models, your sheets and your settings with Foundry and then gets out of the
way. It does not inspect your actors, your players, or your compendia.

## What runs on your machine

`@vttforge/cli` is a different kind of trust. It is a program you run in your
terminal, so here is everything it touches.

| It does | Where |
|---|---|
| Writes the project it scaffolds | The directory you named |
| Remembers where Foundry keeps its data | `<project>/.vttforge/config.json` |
| Creates a symlink to your build | `<Foundry data>/Data/systems/<id>` or `modules/<id>` |
| Runs Vite | Your project |
| Serves the hot-reload bridge | `localhost:31313`, while `dev` is running |
| Writes a release zip | Your project root |

It makes no network requests of its own. The one time anything is downloaded is
when `init` installs dependencies, and that is your own package manager,
running the command you approved.

## How it is published

Every package goes to npm through OIDC trusted publishing, with a provenance
attestation tying the tarball to the commit and the workflow that built it.
Nothing is published from a laptop, and no long-lived npm token exists to leak.
You can check any version yourself:

```bash
npm audit signatures
```

## How it is built

I write VTTForge with the help of AI coding agents. That is worth saying
plainly rather than leaving for someone to notice.

What decides whether a change ships is not who typed it. Every change, mine or
an agent's, goes through a pull request and has to pass the same gates:

| Gate | What it does |
|---|---|
| Typecheck | TypeScript strict across every package |
| Tests | 664 of them |
| Lint | Biome, plus a dependency-version check and a check that the scaffolding templates pin versions that exist |
| Dead code | Unused exports and dependencies fail the build |
| Package quality | `publint` and `attw`, so the published shape is correct |
| A real Foundry | Every push to `main` boots Foundry v13 in a container, installs the example system and module, joins a world, and drives them. Any console error naming VTTForge fails it |

That last one is the one I care about most. The unit tests run against a mocked
Foundry, so they prove the SDK calls the right things. Only a running Foundry
proves Foundry accepted them.

I read what ships and I merge it. No agent merges its own work or publishes a
release.

Being honest about the gaps, since a list of gates is only worth what it leaves
out: there are no staged release channels, no visual regression captures, and
the end-to-end run covers v13 only. Every package is below 1.0, and a minor may
break you. The [stability policy](/stability) says exactly how much.

## If you would rather not

Some people prefer not to build on AI-assisted software, and that is a
reasonable line to draw. Nothing here is hidden: the repository is public,
every change went through a pull request you can read, and the packages carry
provenance back to the commit that built them. Pin a version and stay on it, or
read the code before you install it.
