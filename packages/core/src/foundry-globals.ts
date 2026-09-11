/**
 * Minimal type-only contracts for the Foundry v14+ globals VTTForge core touches.
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

/** One connected or known user, as far as the socket helpers care. */
export interface UserLike {
  readonly id?: string;
  readonly name?: string;
  readonly isGM?: boolean;
  readonly active?: boolean;
  query?: (name: string, data: unknown, options?: { timeout?: number }) => Promise<unknown>;
}

/** `game.socket`. The second argument of a listener is the server's own sender id. */
export interface SocketApi {
  emit(channel: string, message: unknown, options?: { recipients?: readonly string[] }): void;
  on(channel: string, listener: (message: unknown, senderId?: unknown) => void): void;
  off?(channel: string, listener: (message: unknown, senderId?: unknown) => void): void;
}

export interface GameApi {
  readonly settings: GameSettingsApi;
  readonly user?: { readonly isGM: boolean };
  readonly userId?: string | null;
  readonly users?: {
    get(id: string): UserLike | undefined;
    filter(fn: (user: UserLike) => boolean): UserLike[];
    find(fn: (user: UserLike) => boolean): UserLike | undefined;
  };
  readonly socket?: SocketApi;
  readonly system?: { readonly id: string; readonly socket?: boolean };
  readonly modules?: { get(id: string): { socket?: boolean; api?: unknown } | undefined };
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

/**
 * One entry of `CONFIG.statusEffects`. Foundry v14 indexes that collection by
 * `id`, so the id is the one field VTTForge needs; the rest (`name`, `img`,
 * `system.changes`, ...) is passed through untouched.
 */
export interface StatusEffectConfig {
  readonly id: string;
  readonly [key: string]: unknown;
}

/**
 * `CONFIG.queries`. A handler registered here can be called on this client by
 * another user through `User#query`, and its return value travels back.
 */
export type QueryHandlers = Record<
  string,
  (data: unknown, context: { timeout?: number; user?: UserLike }) => unknown
>;

export interface FoundryConfig {
  Actor: ActorConfig;
  Item: ItemConfig;
  Combat: CombatConfig;
  statusEffects?: Record<string, unknown>;
  queries?: QueryHandlers;
  [key: string]: unknown;
}
