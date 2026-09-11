import type { DocumentConfig, Game } from './foundry-globals.js';
/**
 * Names kept alive past the rename that replaced them.
 *
 * Every entry here is the same value under its old name, so `instanceof`
 * holds and code written against the old name keeps working. They go away at
 * 1.0.
 */

import { PackageConfig } from './package-config.js';

/**
 * @deprecated Use {@link PackageConfig}. The same class, so `instanceof`
 * holds both ways and nothing has to change at once.
 */
export const SystemConfig = PackageConfig;

/** @deprecated Use {@link PackageConfig}. */
export type SystemConfig = PackageConfig;

/**
 * @deprecated since 0.20.0. Renamed to `Game`, which is what Foundry calls it.
 * Removed in the next major.
 */
export type GameApi = Game;

/**
 * @deprecated since 0.20.0. Use `DocumentConfig`, which covers every
 * `CONFIG.<Document>` entry rather than only Actor. Removed in the next major.
 */
export type ActorConfig = DocumentConfig;

/**
 * @deprecated since 0.20.0. Use `DocumentConfig`. Removed in the next major.
 */
export type ItemConfig = DocumentConfig;

/**
 * @deprecated since 0.20.0. Write `Record<string, T>`, which is all this was.
 * Removed in the next major.
 */
export type ConfigCollection<T = unknown> = Record<string, T>;
