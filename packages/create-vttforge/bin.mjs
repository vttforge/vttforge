#!/usr/bin/env node
/**
 * create-vttforge — npm `create-*` convention wrapper.
 *
 * `pnpm create vttforge my-system` (or `npm create vttforge@latest my-system`,
 * `bun create vttforge my-system`, `yarn create vttforge my-system`) invokes
 * this binary. We forward the args directly to `@vttforge/cli`'s `init`
 * subcommand so the scaffolder code lives in exactly one place.
 */
import { runInit } from '@vttforge/cli';

const args = process.argv.slice(2);

let name;
let type;
let lang;
let noInstall = false;
let noGit = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === undefined) continue;
  // Accept both the create-* convention (--no-install, --no-git) and the
  // affirmative form (--install=false). Defaults are install + git enabled.
  if (arg === '--no-install' || arg === '--install=false') {
    noInstall = true;
    continue;
  }
  if (arg === '--no-git' || arg === '--git=false') {
    noGit = true;
    continue;
  }
  if (arg === '--type' || arg === '-t') {
    i += 1;
    type = args[i];
    continue;
  }
  if (arg === '--lang' || arg === '-l') {
    i += 1;
    lang = args[i];
    continue;
  }
  if (arg.startsWith('--type=')) {
    type = arg.slice('--type='.length);
    continue;
  }
  if (arg.startsWith('--lang=')) {
    lang = arg.slice('--lang='.length);
    continue;
  }
  if (arg.startsWith('-')) {
    // Unknown flag — skip silently rather than crash the create-* flow.
    continue;
  }
  if (name === undefined) {
    name = arg;
  }
}

try {
  await runInit({ name, type, lang, noInstall, noGit });
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
