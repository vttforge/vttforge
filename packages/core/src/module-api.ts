/**
 * The object a package publishes for other packages and for macros.
 *
 * Foundry keeps it at `game.modules.get(id).api`, which is fine to write and
 * awkward to read. Writing it by hand is three lines in the right hook, and
 * the hook is the part people get wrong: publish it too late and whatever
 * looked for it during `init` found nothing. `registerModule({ api })` writes
 * it before any CONFIG mutation, which is as early as a module can.
 *
 * Reading it is worse. `game.modules.get(id)?.api` collapses four different
 * situations into `undefined`:
 *
 * - no such module is installed
 * - it is installed and the world has it switched off
 * - it is on, but it publishes nothing
 * - it is on and publishes something, but not the version you expected
 *
 * A module that guesses wrong here tells its user "install X", and X is
 * already installed. `moduleApi` returns the object or nothing, the way the
 * bare read does; `requireModuleApi` throws and says which one it was.
 *
 * **When to call.** Not before `setup`. Another package publishes its api in
 * its own `init`, and nothing orders one package's `init` against another's,
 * so a read during `init` finds an api that is not there yet and cannot tell
 * that apart from a module that publishes none. `onSetup` is the first point
 * where every package has finished its `init`.
 */

import { VttfError } from './errors/registry.js';
import type { GameApi } from './foundry-globals.js';

function game(): GameApi | undefined {
  return (globalThis as { game?: GameApi }).game;
}

/** What a package publishes. Anything JSON-ish or callable; we never inspect it. */
export type PackageApi = Record<string, unknown>;

/** Why `requireModuleApi` could not hand back an api. */
export type MissingApiReason = 'not-ready' | 'not-installed' | 'disabled' | 'no-api';

/**
 * The api another module publishes, or `undefined`.
 *
 * The type argument is the caller's claim about the shape. Nothing checks it,
 * because the other module's types are not ours to import: write down what you
 * use and treat it the way you would any other value crossing a boundary.
 */
export function moduleApi<T = PackageApi>(moduleId: string): T | undefined {
  const handle = game()?.modules?.get(moduleId);
  if (handle?.active !== true) return undefined;
  return (handle.api as T | undefined) ?? undefined;
}

/** Is the module installed and switched on in this world? */
export function isModuleActive(moduleId: string): boolean {
  return game()?.modules?.get(moduleId)?.active === true;
}

/**
 * The api another module publishes. Throws VTTF-0014 naming what is wrong.
 *
 * Use it where the dependency is declared in `relationships.requires` and the
 * module cannot work without it. Use `moduleApi` where the feature is optional.
 */
export function requireModuleApi<T = PackageApi>(moduleId: string): T {
  const modules = game()?.modules;
  const handle = modules?.get(moduleId);
  const reason: MissingApiReason | undefined = !modules
    ? 'not-ready'
    : !handle
      ? 'not-installed'
      : handle.active !== true
        ? 'disabled'
        : handle.api === undefined || handle.api === null
          ? 'no-api'
          : undefined;

  if (reason === undefined) return handle?.api as T;

  const explanation: Record<MissingApiReason, string> = {
    'not-ready': `Foundry has not built its module list yet, so "${moduleId}" cannot be asked for an api. Call this from onSetup or later.`,
    'not-installed': `No module "${moduleId}" is installed in this world.`,
    disabled: `The module "${moduleId}" is installed but switched off in this world. Turn it on in Manage Modules.`,
    'no-api': `The module "${moduleId}" is on but publishes no api. Either it is older than the version this needs, or this ran before its own init: call from onSetup or later.`,
  };
  throw new VttfError('VTTF-0014', explanation[reason]);
}
