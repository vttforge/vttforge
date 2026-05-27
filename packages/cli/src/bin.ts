#!/usr/bin/env node
/**
 * vttforge bin — CLI entry.
 *
 * `init`, `dev`, and `build` are wired to their real implementations.
 * `audit` is still reserved so users get a discoverable error pointing
 * at the right workaround until that subcommand lands.
 */
import { defineCommand, runMain } from 'citty';
import { runAuditCommand } from './commands/audit.js';
import { runBuild } from './commands/build.js';
import { runDev } from './commands/dev.js';
import { runInit, ScaffoldError } from './commands/init.js';
import { VTTFORGE_CLI_VERSION } from './index.js';

const init = defineCommand({
  meta: {
    name: 'init',
    description: 'Scaffold a new Foundry VTT system or module from a VTTForge template',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Directory name for the new system/module (also the default manifest id)',
      required: false,
    },
    type: {
      type: 'string',
      description: 'Package type: system | module',
    },
    lang: {
      type: 'string',
      description: 'Language: ts | js',
    },
    // Citty parses `--no-X` as `args.X === false`, so define affirmative
    // flags with a true default. `--no-install` then yields `install: false`
    // which we forward as `noInstall: true`.
    install: {
      type: 'boolean',
      default: true,
      description: 'Install dependencies after scaffold (use --no-install to skip)',
    },
    git: {
      type: 'boolean',
      default: true,
      description: 'Initialize a git repository after scaffold (use --no-git to skip)',
    },
  },
  async run({ args }) {
    try {
      await runInit({
        name: typeof args.name === 'string' ? args.name : undefined,
        type: typeof args.type === 'string' ? (args.type as 'system' | 'module') : undefined,
        lang: typeof args.lang === 'string' ? (args.lang as 'ts' | 'js') : undefined,
        noInstall: args.install === false,
        noGit: args.git === false,
      });
    } catch (err) {
      // ScaffoldError already surfaced its message via `p.cancel`; anything
      // else is a real crash worth showing. Either way the bin exits 1.
      if (!(err instanceof ScaffoldError)) {
        console.error(err instanceof Error ? err.message : String(err));
      }
      process.exit(1);
    }
  },
});

const dev = defineCommand({
  meta: {
    name: 'dev',
    description: 'Symlink dist/ into Foundry Data and run vite build --watch',
  },
  args: {
    'foundry-data': {
      type: 'string',
      alias: 'data-dir',
      description:
        'Override the Foundry user-data directory (skips env / config / first-run prompt)',
    },
  },
  async run({ args }) {
    // Citty surfaces aliases under the canonical name. Belt-and-suspenders:
    // accept either spelling so older docs and muscle memory keep working.
    const explicit =
      (typeof args['foundry-data'] === 'string' ? args['foundry-data'] : undefined) ??
      (typeof args['data-dir'] === 'string' ? args['data-dir'] : undefined);
    try {
      await runDev({ dataDir: explicit });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});

const build = defineCommand({
  meta: {
    name: 'build',
    description: 'Run vite build (production) and emit <id>-<version>.zip for foundryvtt.com',
  },
  async run() {
    try {
      await runBuild();
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});

const audit = defineCommand({
  meta: {
    name: 'audit',
    description: 'Scan a system/module project for the seven v13 manifest + code footguns',
  },
  args: {
    path: {
      type: 'positional',
      description: 'Project root to scan (defaults to the current directory)',
      required: false,
    },
    json: {
      type: 'boolean',
      default: false,
      description: 'Emit a machine-readable JSON report instead of markdown',
    },
    strict: {
      type: 'boolean',
      default: false,
      description: 'Exit non-zero on any finding (default: only HIGH triggers a non-zero exit)',
    },
  },
  async run({ args }) {
    try {
      const result = await runAuditCommand({
        cwd: typeof args.path === 'string' ? args.path : undefined,
        format: args.json === true ? 'json' : 'markdown',
        strict: args.strict === true,
      });
      // Set exitCode instead of calling process.exit so any pending stdout
      // writes (the JSON / markdown report) get flushed before the process
      // tears down. process.exit(1) would truncate large reports on the
      // exact runs CI needs them intact.
      if (result.exitCode !== 0) process.exitCode = result.exitCode;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});

const main = defineCommand({
  meta: {
    name: 'vttforge',
    version: VTTFORGE_CLI_VERSION,
    description: 'VTTForge CLI — scaffold, dev, build for Foundry v13+ systems and modules',
  },
  subCommands: {
    init,
    dev,
    build,
    audit,
  },
});

runMain(main);
