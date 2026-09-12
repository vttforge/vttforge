#!/usr/bin/env node
/**
 * Refuse a path out of the home directory of the machine a change was written
 * on, and any absolute `link:` or `file:` dependency specifier.
 *
 * A lockfile is the usual carrier. Pointing a dependency at a local checkout,
 * to try code that is not published yet, makes the package manager write the
 * developer's home directory into the lock. Restoring the version range
 * afterwards does not rewrite the lock, and `git add -A` sweeps the stale file
 * into the commit.
 *
 * That is not a secret, and it is still not ours to publish. Taking one out of
 * a pushed commit costs a history rewrite, and a rewrite alone leaves the old
 * blob readable by SHA through the forge's API.
 *
 * The test matches this machine's own home, not `/Users/` or `/home/`. A test
 * asserting where Foundry keeps its data on macOS says `/Users/dev`, which is
 * a fixture and not anyone's home.
 *
 * Two modes. With a staged diff, read the added lines: that is the hook. With
 * none, read every tracked file: that is CI, and the mode that still catches a
 * commit made with `--no-verify`.
 */
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const HOME = homedir();

/** Escape for both POSIX ERE and JS RegExp. */
function escapeForPattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ERE = `(${escapeForPattern(HOME)}|(link|file):/)`;
const JS_RE = new RegExp(`(${escapeForPattern(HOME)}|(?:link|file):/)`);

/** A line that exists to describe the rule, not to break it. */
const ALLOWED = [/check-no-absolute-paths/];

function git(args) {
  const run = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  // `git grep` exits 1 for "no matches", which is success here. Anything above
  // that is a broken invocation, and reporting it as "nothing found" is how a
  // check returns a result it never computed.
  if (run.status !== null && run.status > 1) {
    console.error(`check-no-absolute-paths: git ${args.join(' ')} failed`);
    console.error(run.stderr?.trim() ?? '');
    process.exit(2);
  }
  return run.stdout ?? '';
}

const staged = git(['diff', '--cached', '-U0']);
const fromStage = staged.trim() !== '';

const lines = fromStage
  ? staged
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.slice(1))
  : git(['grep', '-nI', '-E', ERE, '--', '.']).split('\n').filter(Boolean);

const hits = lines.filter((line) => JS_RE.test(line) && !ALLOWED.some((ok) => ok.test(line)));

if (hits.length > 0) {
  console.error(`A path from this machine is ${fromStage ? 'staged' : 'tracked'}:\n`);
  for (const hit of hits.slice(0, 20)) console.error(`  ${hit}`);
  if (hits.length > 20) console.error(`  ... and ${hits.length - 20} more`);
  console.error('\nReinstall, or take the file out of the commit.');
  process.exit(1);
}
