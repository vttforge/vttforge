/**
 * vttforge command tree.
 *
 * Kept apart from `bin.ts`, which only runs it. Argument definitions are the
 * CLI's contract with its users — `--no-install` skipping the install, an
 * alias resolving to its canonical name — and a module that calls `runMain`
 * on import cannot be reached by a test. Exporting the commands from here
 * lets the suite parse real argv against the real definitions.
 */
import { defineCommand } from 'citty';
import { runAuditCommand } from './commands/audit.js';
import { runBuild } from './commands/build.js';
import { runDev } from './commands/dev.js';
import { runInit, ScaffoldError } from './commands/init.js';
import { VTTFORGE_CLI_VERSION } from './index.js';

export const init = defineCommand({
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
    id: {
      type: 'string',
      description: 'Manifest id (defaults to a slug of the directory name)',
    },
    title: {
      type: 'string',
      description: 'Human-readable title shown in Foundry setup screens',
    },
    description: {
      type: 'string',
      description: 'One-line description for the manifest',
    },
    author: {
      type: 'string',
      description: 'Author name for the manifest (defaults to the git author)',
    },
    license: {
      type: 'string',
      description: 'SPDX license id (default MIT)',
    },
    // Without a terminal there is nothing for a prompt to read, so it waits
    // forever. This flag takes the defaults instead — and the scaffolder
    // also assumes it when stdin is not a TTY, so CI need not pass it.
    yes: {
      type: 'boolean',
      alias: 'y',
      default: false,
      description: 'Accept defaults for anything not passed, without prompting',
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
        id: typeof args.id === 'string' ? args.id : undefined,
        title: typeof args.title === 'string' ? args.title : undefined,
        description: typeof args.description === 'string' ? args.description : undefined,
        author: typeof args.author === 'string' ? args.author : undefined,
        license: typeof args.license === 'string' ? args.license : undefined,
        yes: args.yes === true,
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

export const dev = defineCommand({
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
    'hmr-port': {
      type: 'string',
      description: 'Port for the hot reload bridge (default 31313)',
    },
  },
  async run({ args }) {
    // Citty surfaces aliases under the canonical name. Belt-and-suspenders:
    // accept either spelling so older docs and muscle memory keep working.
    const explicit =
      (typeof args['foundry-data'] === 'string' ? args['foundry-data'] : undefined) ??
      (typeof args['data-dir'] === 'string' ? args['data-dir'] : undefined);
    // A non-numeric port is the user's typo, not a reason to fall back to a
    // port they did not ask for — say so and stop.
    const rawPort = typeof args['hmr-port'] === 'string' ? args['hmr-port'] : undefined;
    const hmrPort = rawPort === undefined ? undefined : Number(rawPort);
    if (hmrPort !== undefined && !Number.isInteger(hmrPort)) {
      console.error(`--hmr-port expects a whole number, got \`${rawPort}\`.`);
      process.exit(1);
    }
    try {
      await runDev({ dataDir: explicit, hmrPort });
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  },
});

export const build = defineCommand({
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

export const audit = defineCommand({
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

export const main = defineCommand({
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
