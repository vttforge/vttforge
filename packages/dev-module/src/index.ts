/**
 * `@vttforge/dev-module`: the Foundry side of `vttforge dev`.
 *
 * Foundry can hot reload on its own, but only when the server is started with
 * the right flag and the files sit where that watcher looks. `vttforge dev`
 * builds with Vite instead, so this module takes delivery into its own hands:
 * the CLI pushes a payload per changed file and this end applies it.
 *
 * Development only. Nothing here belongs in a shipped world.
 */

export { bootstrap, DEFAULT_PORT, MODULE_ID, resolveServerUrl } from './bootstrap.js';
export type { ClientOptions, Connection, SocketLike } from './client.js';
export { connect, parsePayload } from './client.js';
export type { FoundryEnv, HotReloadData, ReloadOutcome } from './reload.js';
export { applyHotReload } from './reload.js';
