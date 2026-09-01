# @vttforge/dev-module

The Foundry side of `vttforge dev`. It applies stylesheet, template and
language changes to a running world without a page reload.

Development only. It opens a socket to your machine and applies whatever
arrives; nothing about that belongs in a world you care about.

## Why it exists

Foundry can hot reload on its own, but only when the server is started with
the right flag and the files sit where its watcher looks. `vttforge dev`
builds with Vite instead, so the files Foundry serves are build output that
its watcher never sees.

This module takes delivery into its own hands: `vttforge dev` pushes a
payload per changed file, and this end applies it.

## What it does with each file

| Extension | Effect |
| --- | --- |
| `css` | Swaps the stylesheet in place |
| `hbs`, `html` | Recompiles the template and re-renders open windows |
| `json` | Merges a language file, if it is one you are viewing |

Anything else is ignored — the watcher may cover more file types than can be
applied without a reload.

## Vetoing a reload

The `hotReload` hook fires before anything is applied, exactly as Foundry's
own does. Returning `false` cancels it:

```js
Hooks.on('hotReload', (data) => {
  if (data.extension === 'css') return false;
});
```

## Pointing it somewhere else

It connects to `ws://localhost:31313`, or to `host.docker.internal` when
Foundry is not served from a local address — which is what a containerised
Foundry needs to reach the CLI on your machine. To override:

```js
globalThis.VTTFORGE_DEV_SERVER_URL = 'ws://192.168.1.10:31313';
```

A dropped connection is expected: the CLI stops between runs. Reconnection
backs off rather than hammering a closed port.
