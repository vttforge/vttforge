/**
 * vttforge command tree.
 *
 * Kept apart from `bin.ts`, which only runs it. Argument definitions are the
 * CLI's contract with its users (`--no-install` skipping the install, an
 * alias resolving to its canonical name) and a module that calls `runMain`
 * on import cannot be reached by a test. Exporting the commands from here
 * lets the suite parse real argv against the real definitions.
 */
import { defineCommand } from 'citty';
import { runAuditCommand } from './commands/audit.js';
import { runBuild } from './commands/build.js';
import { runDev } from './commands/dev.js';
import { runInit, ScaffoldError } from './commands/init.js';
import { runLintCommand } from './commands/lint.js';
import { runMigrateCommand } from './commands/migrate.js';
import { VTTFORGE_CLI_VERSION } from './index.js';
import { strictArgs } from './strict-args.js';

export const init = defineCommand({
  plugins: [strictArgs],
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
    // `enum` rather than `string`: citty then refuses a value that is not on
    // the list and says which ones are, and `--help` prints them. As a plain
    // string a typo fell through to the default and scaffolded the wrong
    // thing without a word.
    type: {
      type: 'enum',
      options: ['system', 'module'],
      description: 'Package type: system | module',
    },
    lang: {
      type: 'enum',
      options: ['ts', 'js'],
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
    // forever. This flag takes the defaults instead, and the scaffolder
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
  plugins: [strictArgs],
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
    // port they did not ask for. Say so and stop.
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
  plugins: [strictArgs],
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

export const lint = defineCommand({
  plugins: [strictArgs],
  meta: {
    name: 'lint',
    description: 'Run Biome (shipped with the CLI) over the project, then the v14 audit',
  },
  args: {
    path: {
      type: 'positional',
      description: 'Project root to lint (defaults to the current directory)',
      required: false,
    },
    fix: {
      type: 'boolean',
      default: false,
      description: 'Write the safe fixes and format the files instead of only reporting',
    },
    // Affirmative flag with a true default, so `--no-audit` parses as
    // `audit: false` (same pattern as `--no-install` on init).
    audit: {
      type: 'boolean',
      default: true,
      description: 'Run `vttforge audit` after Biome (use --no-audit to skip)',
    },
    strict: {
      type: 'boolean',
      default: false,
      description: 'For the audit: exit non-zero on any finding, not only HIGH',
    },
  },
  async run({ args }) {
    try {
      const result = await runLintCommand({
        cwd: typeof args.path === 'string' ? args.path : undefined,
        fix: args.fix === true,
        audit: args.audit !== false,
        strict: args.strict === true,
      });
      if (result.exitCode !== 0) process.exitCode = result.exitCode;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  },
});

export const audit = defineCommand({
  plugins: [strictArgs],
  meta: {
    name: 'audit',
    description:
      'Scan a system/module project for the v14 manifest, source and template breakages that fail quietly',
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

export const migrate = defineCommand({
  plugins: [strictArgs],
  meta: {
    name: 'migrate',
    description:
      'Rewrite a v13 system or module for Foundry v14 (preview by default); --data-models and --sheets write the v16 replacements',
  },
  args: {
    path: {
      type: 'positional',
      description: 'Project root to rewrite (defaults to the current directory)',
      required: false,
    },
    write: {
      type: 'boolean',
      default: false,
      description: 'Write the edits. Without it, the command only reports what it would change',
    },
    json: {
      type: 'boolean',
      default: false,
      description: 'Emit the report as JSON',
    },
    strict: {
      type: 'boolean',
      default: false,
      description: 'Exit 1 when anything is left that needs a decision, for CI',
    },
    'data-models': {
      type: 'boolean',
      default: false,
      description:
        'Also generate a data model per template.json type (template.json is deprecated since v14)',
    },
    // `enum`, for the same reason as `init`: as plain strings a typo landed
    // on the default and wrote the wrong thing without a word.
    style: {
      type: 'enum',
      options: ['plain', 'sdk'],
      default: 'plain',
      description: 'For --data-models: "plain" Foundry classes, or "sdk" classes on @vttforge/core',
    },
    lang: {
      type: 'enum',
      options: ['js', 'ts'],
      default: 'js',
      description: 'For --data-models and --sheets: "js" writes .mjs, "ts" writes .ts',
    },
    sheets: {
      type: 'boolean',
      default: false,
      description:
        'Also write a V2 sheet file (on the SDK bases) next to each Application v1 sheet class, and the data-action attributes its templates need',
    },
  },
  async run({ args }) {
    try {
      const { exitCode } = await runMigrateCommand({
        cwd: args.path ? String(args.path) : undefined,
        write: Boolean(args.write),
        json: Boolean(args.json),
        strict: Boolean(args.strict),
        dataModels: Boolean(args['data-models']),
        style: String(args.style) === 'sdk' ? 'sdk' : 'plain',
        lang: String(args.lang) === 'ts' ? 'ts' : 'js',
        sheets: Boolean(args.sheets),
      });
      process.exitCode = exitCode;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  },
});

export const main = defineCommand({
  meta: {
    name: 'vttforge',
    version: VTTFORGE_CLI_VERSION,
    description:
      'VTTForge CLI: scaffold, dev, build, lint, audit and migrate for Foundry v14+ systems and modules',
  },
  subCommands: {
    init,
    dev,
    build,
    lint,
    audit,
    migrate,
  },
});
