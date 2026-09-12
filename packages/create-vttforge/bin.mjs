#!/usr/bin/env node
/**
 * create-vttforge — npm `create-*` convention wrapper.
 *
 * `pnpm create vttforge my-system` (or `npm create vttforge@latest my-system`,
 * `bun create vttforge my-system`, `yarn create vttforge my-system`) invokes
 * this binary. We forward the args to `@vttforge/cli`'s `init` subcommand so
 * the scaffolder code lives in exactly one place.
 *
 * The flag list mirrors `vttforge init`. It used to carry four of them, so
 * `--description` and the rest of the manifest fields were unreachable through
 * the entry point most people actually use, and a scaffold came out holding
 * the template's placeholder text.
 */
import { runInit } from '@vttforge/cli';

const args = process.argv.slice(2);

/** Flags taking a value, mapped to the `runInit` option they fill. */
const VALUE_FLAGS = new Map([
  ['--type', 'type'],
  ['-t', 'type'],
  ['--lang', 'lang'],
  ['-l', 'lang'],
  ['--id', 'id'],
  ['--title', 'title'],
  ['--description', 'description'],
  ['--author', 'author'],
  ['--license', 'license'],
]);

const options = {};
let name;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === undefined) continue;

  // Accept both the create-* convention (--no-install, --no-git) and the
  // affirmative form (--install=false). Defaults are install + git enabled.
  if (arg === '--no-install' || arg === '--install=false') {
    options.noInstall = true;
    continue;
  }
  if (arg === '--no-git' || arg === '--git=false') {
    options.noGit = true;
    continue;
  }
  if (arg === '--yes' || arg === '-y') {
    options.yes = true;
    continue;
  }

  const spaced = VALUE_FLAGS.get(arg);
  if (spaced !== undefined) {
    i += 1;
    const value = args[i];
    if (value === undefined || value.startsWith('-')) {
      console.error(`Missing value for ${arg}.`);
      process.exit(1);
    }
    options[spaced] = value;
    continue;
  }

  const eq = arg.indexOf('=');
  if (arg.startsWith('--') && eq > 0) {
    const joined = VALUE_FLAGS.get(arg.slice(0, eq));
    if (joined !== undefined) {
      options[joined] = arg.slice(eq + 1);
      continue;
    }
  }

  if (arg.startsWith('-')) {
    // Skipping this used to be deliberate, to keep the create-* flow from
    // crashing. It cost more than it saved: the flag did nothing, nothing
    // was printed, and the scaffold came out as whatever the defaults are.
    console.error(`Unknown flag: ${arg}.`);
    console.error(
      'This command takes: --type (-t), --lang (-l), --id, --title, --description, --author, --license, --yes (-y), --no-install, --no-git.',
    );
    process.exit(1);
  }

  if (name === undefined) {
    name = arg;
  }
}

try {
  await runInit({ name, ...options });
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
