/**
 * SystemConfig: typed wrapper around `game.settings.register/get/set`.
 *
 * Eliminates the boilerplate of repeating the system id in every call:
 *
 *   // before
 *   game.settings.register("ordemparanormal", "homebrewRules", { ... });
 *   game.settings.get("ordemparanormal", "homebrewRules");
 *
 *   // after
 *   const cfg = new SystemConfig("ordemparanormal");
 *   cfg.register("homebrewRules", { ... });
 *   cfg.get<boolean>("homebrewRules");
 *
 * Also keeps a local manifest of registered keys so attempts to read an
 * unregistered key fail with VTTF-0003 instead of returning undefined.
 *
 * Registration must happen during the `init` hook; reads can happen any
 * time after.
 */

import { VttfError } from './errors/registry.js';
import type { GameApi, SettingConfig } from './foundry-globals.js';

function readGame(): GameApi {
  const candidate = (globalThis as Record<string, unknown>).game as GameApi | undefined;
  if (candidate === undefined || candidate.settings === undefined) {
    throw new VttfError(
      'VTTF-0002',
      'game.settings is not available. Call SystemConfig methods inside or after the Foundry "init" hook',
    );
  }
  return candidate;
}

export class SystemConfig {
  readonly systemId: string;
  readonly #registered = new Set<string>();

  constructor(systemId: string) {
    this.systemId = systemId;
  }

  register<T>(key: string, config: SettingConfig<T>): void {
    const game = readGame();
    game.settings.register(this.systemId, key, config);
    this.#registered.add(key);
  }

  get<T>(key: string): T {
    if (!this.#registered.has(key)) {
      throw new VttfError(
        'VTTF-0003',
        `SystemConfig.get("${key}") was called before register("${key}")`,
      );
    }
    return readGame().settings.get<T>(this.systemId, key);
  }

  async set<T>(key: string, value: T): Promise<T> {
    if (!this.#registered.has(key)) {
      throw new VttfError(
        'VTTF-0003',
        `SystemConfig.set("${key}") was called before register("${key}")`,
      );
    }
    return readGame().settings.set<T>(this.systemId, key, value);
  }

  isRegistered(key: string): boolean {
    return this.#registered.has(key);
  }
}
