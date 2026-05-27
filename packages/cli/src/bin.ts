#!/usr/bin/env node
/**
 * vttforge bin — CLI entry.
 *
 * `vttforge init` is the only fully-implemented subcommand in this version.
 * `dev`, `build`, and `audit` are reserved so users get a discoverable error
 * pointing at the right workaround until the real implementations land.
 */
import { defineCommand, runMain } from 'citty';
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
    description:
      'Run vite build --watch + symlink dist/ into Foundry Data (coming in a later release)',
  },
  run() {
    console.error(
      'vttforge dev is not implemented yet. For now: run `vite build --watch` from your project and symlink `dist/` into your Foundry Data/systems/<id>/ (or use the dev compose mount).',
    );
    process.exit(1);
  },
});

const build = defineCommand({
  meta: {
    name: 'build',
    description: 'Run vite build + emit a foundryvtt.com release zip (coming in a later release)',
  },
  run() {
    console.error(
      'vttforge build is not implemented yet. For now: run `vite build`. The release workflow already shipped in your scaffold zips dist/ automatically on tag push.',
    );
    process.exit(1);
  },
});

const audit = defineCommand({
  meta: {
    name: 'audit',
    description:
      'Scan a system/module source tree for v13 manifest footguns (coming in a later release)',
  },
  run() {
    console.error('vttforge audit is not implemented yet. Coming after the build pipeline lands.');
    process.exit(1);
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
