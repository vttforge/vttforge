/**
 * `createMigrationRunner` — declarative schema migrations for Foundry systems.
 *
 * Replaces the copy-pasted "schemaVersion setting + Hooks.once('ready') +
 * isNewerVersion compare + sequential await" pattern documented in the
 * Foundry system guidance skill (§"Data Migration" and `references/data-migration.md`
 * §5 "Migration Registry"). The runner owns no hooks — call `register()` from
 * your `init` hook and `run()` from your `ready` hook (gated by
 * `game.user.isGM`).
 *
 * Versions are semver strings, compared with `foundry.utils.isNewerVersion`,
 * the comparator this runner uses. This lines up cleanly with `system.json`'s
 * `flags.<systemId>.needsMigrationVersion` / `compatibleMigrationVersion`.
 *
 * Failures advance `schemaVersion` only past migrations that *completed* — a
 * mid-sequence throw leaves the world at the last successful version so the
 * retry on the next world load picks up exactly where it failed.
 */

import { VttfError } from '../errors/registry.js';
import type { GameSettingsApi } from '../foundry-globals.js';
import type {
  Migration,
  MigrationLogger,
  MigrationRunner,
  MigrationRunnerOptions,
} from './types.js';

const DEFAULT_SETTING_KEY = 'schemaVersion';
const INITIAL_VERSION = '0.0.0';

interface FoundryUtilsApi {
  isNewerVersion?: (next: string, current: string) => boolean;
}

interface FoundryUiNotifications {
  info?: (msg: string) => unknown;
  warn?: (msg: string) => unknown;
  error?: (msg: string) => unknown;
}

function resolveIsNewerVersion(): (next: string, current: string) => boolean {
  const foundry = (globalThis as Record<string, unknown>).foundry as
    | { utils?: FoundryUtilsApi }
    | undefined;
  const fn = foundry?.utils?.isNewerVersion;
  if (typeof fn === 'function') return fn;
  // Last-resort fallback for non-Foundry runtimes — naive numeric semver compare.
  // Real consumers always run inside Foundry where the proper comparator exists.
  return naiveIsNewerVersion;
}

function naiveIsNewerVersion(next: string, current: string): boolean {
  const parse = (v: string): number[] =>
    v.split('.').map((part) => {
      const n = Number.parseInt(part, 10);
      return Number.isNaN(n) ? 0 : n;
    });
  const a = parse(next);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
}

function resolveSettings(): GameSettingsApi {
  const game = (globalThis as Record<string, unknown>).game as
    | { settings?: GameSettingsApi }
    | undefined;
  const settings = game?.settings;
  if (
    settings === undefined ||
    typeof settings.register !== 'function' ||
    typeof settings.get !== 'function' ||
    typeof settings.set !== 'function'
  ) {
    throw new VttfError(
      'VTTF-0002',
      'globalThis.game.settings is not available — call createMigrationRunner().register() inside the Foundry runtime (or pass an explicit settings adapter in MigrationRunnerOptions).',
    );
  }
  return settings;
}

function resolveLogger(): MigrationLogger {
  const ui = (globalThis as Record<string, unknown>).ui as
    | { notifications?: FoundryUiNotifications }
    | undefined;
  const notifications = ui?.notifications;
  return {
    info(message) {
      // biome-ignore lint/suspicious/noConsole: console.info is the only Foundry-portable info-level logger
      console.info(message);
      notifications?.info?.(message);
    },
    warn(message) {
      console.warn(message);
      notifications?.warn?.(message);
    },
    error(message) {
      console.error(message);
      notifications?.error?.(message);
    },
  };
}

function lastVersion(migrations: ReadonlyArray<Migration>): string {
  return migrations.at(-1)?.version ?? INITIAL_VERSION;
}

function assertAscending(
  migrations: ReadonlyArray<Migration>,
  isNewer: (next: string, current: string) => boolean,
): void {
  for (let i = 1; i < migrations.length; i++) {
    const prevMig = migrations[i - 1];
    const nextMig = migrations[i];
    // Loop bounds guarantee both indices are valid; the explicit guard
    // exists to satisfy TypeScript's flow analysis without a non-null
    // assertion.
    if (prevMig === undefined || nextMig === undefined) continue;
    if (!isNewer(nextMig.version, prevMig.version)) {
      throw new VttfError(
        'VTTF-0004',
        `Migration list out of order: ${nextMig.version} must be newer than ${prevMig.version}.`,
      );
    }
  }
}

/**
 * Build a migration runner for a system. See module header for the failure
 * semantics; see `Migration` JSDoc for the per-entry shape.
 *
 * @example
 * ```ts
 * const migrations = createMigrationRunner({
 *   systemId: 'my-system',
 *   migrations: [
 *     { version: '1.0.0', description: 'Rename bio → biography', fn: migrateV1 },
 *     { version: '2.0.0', description: 'Add hp.temp', fn: migrateV2 },
 *   ],
 *   compatibleVersion: '0.9.0',
 * });
 *
 * registerSystem({
 *   id: 'my-system',
 *   onAfterInit: () => migrations.register(),
 *   onReady: async () => {
 *     if (!game.user.isGM) return;
 *     await migrations.run();
 *   },
 * });
 * ```
 */
export function createMigrationRunner(options: MigrationRunnerOptions): MigrationRunner {
  const settingKey = options.settingKey ?? DEFAULT_SETTING_KEY;
  const target = lastVersion(options.migrations);
  const settingsOverride = options.settings;
  const loggerOverride = options.logger;
  const isNewerOverride = options.isNewerVersion;

  return {
    targetVersion: target,

    register(): void {
      const settings = settingsOverride ?? resolveSettings();
      settings.register<string>(options.systemId, settingKey, {
        name: 'Schema Version',
        hint: 'Internal schema version for VTTForge data migration tracking. Do not edit by hand.',
        scope: 'world',
        config: false,
        type: String,
        default: INITIAL_VERSION,
      });
    },

    async run(): Promise<ReadonlyArray<string>> {
      if (options.migrations.length === 0) return [];

      const settings = settingsOverride ?? resolveSettings();
      const logger = loggerOverride ?? resolveLogger();
      const isNewer = isNewerOverride ?? resolveIsNewerVersion();

      assertAscending(options.migrations, isNewer);

      const stored = settings.get<string>(options.systemId, settingKey);
      const current = stored ?? INITIAL_VERSION;

      if (options.compatibleVersion !== undefined) {
        if (isNewer(options.compatibleVersion, current)) {
          throw new VttfError(
            'VTTF-0005',
            `World schemaVersion ${current} is older than ${options.systemId}'s compatibleVersion ${options.compatibleVersion}. Upgrade through an intermediate release first.`,
          );
        }
      }

      const pending = options.migrations.filter((m) => isNewer(m.version, current));
      if (pending.length === 0) return [];

      const ran: string[] = [];
      let lastApplied = current;
      logger.warn(
        `${options.systemId} | Running ${pending.length} pending migration(s) from ${current} to ${target}.`,
      );

      for (const migration of pending) {
        const label = migration.description
          ? `${migration.version} — ${migration.description}`
          : migration.version;
        logger.info(`${options.systemId} | Migrating to ${label}`);
        try {
          await migration.fn();
        } catch (cause) {
          if (isNewer(lastApplied, current)) {
            await settings.set(options.systemId, settingKey, lastApplied);
          }
          throw new VttfError(
            'VTTF-0004',
            `Migration to ${label} failed for system "${options.systemId}". schemaVersion left at ${lastApplied}.`,
            { cause },
          );
        }
        await settings.set(options.systemId, settingKey, migration.version);
        lastApplied = migration.version;
        ran.push(migration.version);
      }

      logger.info(`${options.systemId} | Migration complete. schemaVersion = ${target}.`);
      return ran;
    },
  };
}
