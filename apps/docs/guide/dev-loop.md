# The dev loop

```bash
vttforge dev
```

Builds, symlinks `dist/` into Foundry's data directory, opens a small server,
and watches. Save a file and the change applies in the open window.

## What reloads, and what does not

| You change | What happens |
|---|---|
| a stylesheet | the `<link>` swaps, nothing re-renders |
| a template | only the windows using it redraw |
| a language file | every open window redraws; translations are read on render |
| anything else | nothing; reload the page |

The scoping is the hard part. Vite rewrites its whole output on every build,
so a naive watcher fires for every file each time and redraws all 21 open
windows for a one-line template edit. The watcher hashes content and ignores
files that came out identical.

## In a container

A container cannot follow a symlink on your host. `vttforge dev` detects the
case and prints the compose mount to use instead.

If you rebuild while the container runs, a bind mount to `dist/` breaks when
the build recreates that directory, and the container keeps serving the old
inode. Mount a directory the build only ever writes into, or recreate the
container after a build.

## The companion module

Hot reload needs a small module inside Foundry to receive the messages:
`@vttforge/dev-module`, which `vttforge dev` links for you. Enable
**VTTForge Dev** in the world once.

If the port is busy or the module is missing, `vttforge dev` says so and
carries on without hot reload. Losing the reload is not worth losing the
dev loop.
