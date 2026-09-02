/**
 * Minimal type-only contracts for the Foundry v13+ globals VTTForge core touches.
 *
 * Intentionally narrow. The Foundry members the bases stand on are in `@vttforge/types`;
 * built on top of `fvtt-types`. We mirror just the surface we use so the core
 * package compiles without pulling in fvtt-types' git-SHA dependency.
 *
 * Every consumer is expected to run inside the Foundry runtime; we read these
 * via `globalThis` and never bundle Foundry itself.
 */

export type HookCallback<Args extends readonly unknown[] = readonly unknown[]> = (
  ...args: Args
) => unknown | Promise<unknown>;

export interface HooksApi {
  once<Args extends readonly unknown[]>(event: string, fn: HookCallback<Args>): number;
  on<Args extends readonly unknown[]>(event: string, fn: HookCallback<Args>): number;
  off(event: string, idOrFn: number | HookCallback): boolean;
  call(event: string, ...args: readonly unknown[]): boolean;
  callAll(event: string, ...args: readonly unknown[]): boolean;
}

export type SettingScope = 'world' | 'client';

export interface SettingConfig<T = unknown> {
  readonly name?: string;
  readonly hint?: string;
  readonly scope: SettingScope;
  readonly config?: boolean;
  readonly type: unknown;
  readonly default: T;
  readonly choices?: Readonly<Record<string, string>>;
  readonly range?: { readonly min: number; readonly max: number; readonly step?: number };
  readonly onChange?: (value: T) => void;
}

export interface GameSettingsApi {
  register<T>(namespace: string, key: string, config: SettingConfig<T>): void;
  get<T = unknown>(namespace: string, key: string): T;
  set<T>(namespace: string, key: string, value: T): Promise<T>;
}

export interface GameApi {
  readonly settings: GameSettingsApi;
  readonly user?: { readonly isGM: boolean };
}

export type ConfigCollection<T = unknown> = Record<string, T>;

export interface ActorConfig {
  documentClass?: unknown;
  dataModels: ConfigCollection;
}

export interface ItemConfig {
  documentClass?: unknown;
  dataModels: ConfigCollection;
}

export interface CombatConfig {
  initiative?: { formula: string; decimals?: number };
}

export interface ActiveEffectConfig {
  legacyTransferral?: boolean;
}

export interface FoundryConfig {
  Actor: ActorConfig;
  Item: ItemConfig;
  Combat: CombatConfig;
  ActiveEffect: ActiveEffectConfig;
  statusEffects?: unknown[];
  [key: string]: unknown;
}
