/**
 * Public types for `createMigrationRunner()`.
 *
 * Versions are semver strings so they line up with `system.json`'s
 * `flags.<systemId>.needsMigrationVersion` / `compatibleMigrationVersion` and
 * with `foundry.utils.isNewerVersion`, which is the comparator the runner
 * uses. A migration that targets `"2.4.0"` runs once the stored
 * `schemaVersion` is anything strictly older than `"2.4.0"`.
 */

import type { GameSettingsApi } from '../foundry-globals.js';

export interface Migration {
  /** Semver version this migration brings the world to. */
  readonly version: string;
  /** Optional human-readable description, logged when the migration runs and shown in error messages. */
  readonly description?: string;
  /** The migration body. May be sync or async. Should be idempotent (safe to re-run after partial failure). */
  readonly fn: () => void | Promise<void>;
}

export interface MigrationLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * The package id, under either name. Both are here so the old one keeps
 * working, and the union is what makes the compiler still demand one: a call
 * carrying neither matches no branch and does not build.
 */
type MigrationRunnerId =
  | {
      /** Package id, used as the `game.settings` namespace. */
      readonly packageId: string;
      /** @deprecated Pass `packageId`. Ignored when `packageId` is present. */
      readonly systemId?: string;
    }
  | {
      readonly packageId?: undefined;
      /**
       * @deprecated Pass `packageId`. Modules run migrations too, and the old
       * name says otherwise. Read for the rest of the 0.x line.
       */
      readonly systemId: string;
    };

export type MigrationRunnerOptions = MigrationRunnerId & MigrationRunnerSettings;

interface MigrationRunnerSettings {
  /** Migrations in ascending version order. Empty array is allowed (`run()` is a no-op then). */
  readonly migrations: ReadonlyArray<Migration>;
  /** Settings key under the package id. Defaults to `'schemaVersion'`. */
  readonly settingKey?: string;
  /**
   * Compatibility floor: worlds with a stored schemaVersion strictly older than this
   * throw `VttfError VTTF-0005` instead of running migrations. Mirrors the
   * `flags.<id>.compatibleMigrationVersion` declaration in the manifest.
   */
  readonly compatibleVersion?: string;
  /**
   * Override the semver comparator. Defaults to `foundry.utils.isNewerVersion`
   * resolved at call time. Test-only injection.
   */
  readonly isNewerVersion?: (next: string, current: string) => boolean;
  /**
   * Override `game.settings`. Defaults to `globalThis.game.settings` resolved
   * at call time. Test-only injection.
   */
  readonly settings?: GameSettingsApi;
  /**
   * Override the logger. Defaults to a `console` + `ui.notifications` adapter.
   * Test-only injection.
   */
  readonly logger?: MigrationLogger;
}

export interface MigrationRunner {
  /** The target version (last migration's `version`, or `'0.0.0'` if the list is empty). */
  readonly targetVersion: string;
  /**
   * Register the `schemaVersion` setting. Call once from your `init` hook so
   * Foundry knows about it before any world load. Re-calls are idempotent (the
   * underlying `game.settings.register` enforces that).
   */
  register(): void;
  /**
   * Run every migration whose version is newer than the stored
   * `schemaVersion`, in order. Returns the list of versions actually executed
   * (empty when the world is already up to date). Throws `VttfError VTTF-0004`
   * wrapping the original error if any migration throws; throws
   * `VttfError VTTF-0005` if the stored version is older than `compatibleVersion`.
   *
   * Call from your `ready` hook, gated by `game.user.isGM`; this method does
   * NOT enforce GM-only itself so consumers can compose differently if needed.
   */
  run(): Promise<ReadonlyArray<string>>;
}
