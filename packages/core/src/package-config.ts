/**
 * A typed wrapper around `game.settings.register` / `get` / `set`.
 *
 * Foundry wants the package id in every call, so the id is repeated on every
 * line and a typo in it registers a setting nobody reads:
 *
 *   game.settings.register('my-module', 'homebrewRules', { ... });
 *   game.settings.get('my-module', 'homebrewRules');
 *
 * `PackageConfig` holds the id once:
 *
 *   const config = new PackageConfig('my-module');
 *   config.register('homebrewRules', { ... });
 *   config.get<boolean>('homebrewRules');
 *
 * It also keeps its own list of registered keys, so reading one that never
 * reached `register` throws VTTF-0003 instead of handing back `undefined`.
 * Foundry returns `undefined` for an unregistered key, which reads as "the
 * setting is off" and is the same value a registered boolean can hold.
 *
 * Register during `init`. Read any time after.
 */

import { VttfError } from './errors/registry.js';
import type { Game, SettingConfig } from './foundry-globals.js';

function readGame(): Game {
  const candidate = (globalThis as Record<string, unknown>).game as Game | undefined;
  if (candidate === undefined || candidate.settings === undefined) {
    throw new VttfError(
      'VTTF-0002',
      'game.settings is not available. Call PackageConfig methods inside or after the Foundry "init" hook',
    );
  }
  return candidate;
}

/** Settings for one package, system or module. */
export class PackageConfig {
  /** The package id every call is made against. */
  readonly packageId: string;
  readonly #registered = new Set<string>();

  constructor(packageId: string) {
    this.packageId = packageId;
  }

  /**
   * The package id.
   *
   * @deprecated Read `packageId`. This class covers modules too, and the old
   * name says otherwise. The property stays for the rest of the 0.x line.
   */
  get systemId(): string {
    return this.packageId;
  }

  register<T>(key: string, config: SettingConfig<T>): void {
    const game = readGame();
    game.settings.register(this.packageId, key, config);
    this.#registered.add(key);
  }

  get<T>(key: string): T {
    if (!this.#registered.has(key)) {
      throw new VttfError(
        'VTTF-0003',
        `PackageConfig.get("${key}") was called before register("${key}")`,
      );
    }
    return readGame().settings.get<T>(this.packageId, key);
  }

  async set<T>(key: string, value: T): Promise<T> {
    if (!this.#registered.has(key)) {
      throw new VttfError(
        'VTTF-0003',
        `PackageConfig.set("${key}") was called before register("${key}")`,
      );
    }
    return readGame().settings.set<T>(this.packageId, key, value);
  }

  isRegistered(key: string): boolean {
    return this.#registered.has(key);
  }
}
