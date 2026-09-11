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
