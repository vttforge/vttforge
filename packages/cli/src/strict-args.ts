/**
 * Refuse a flag the command does not define.
 *
 * The argument parser collects anything that looks like a flag, whether or
 * not the command declared it, and hands the whole lot to `run`. A command
 * reads the keys it knows and never looks at the rest, so a typo does
 * nothing and says nothing: `vttforge init app --typ module` scaffolds a
 * system, exit code 0. The user finds out much later, usually from Foundry.
 *
 * This plugin runs before the command and stops on the first unknown flag.
 */

import { type ArgsDef, type CittyPlugin, defineCittyPlugin } from 'citty';

/**
 * One spelling of a flag name, for comparison.
 *
 * The parser answers to a flag under several keys: the declared name, its
 * aliases, and the camelCase and kebab-case forms of each. Folding case and
 * dropping the dashes covers all of them with one rule. It accepts a few
 * spellings the parser would not produce on its own, which is the safe
 * direction to be loose in: this check can then never reject a flag the
 * command really does define.
 */
function fold(name: string): string {
  return name.toLowerCase().replaceAll('-', '');
}

function acceptedNames(argsDef: ArgsDef): Set<string> {
  const accepted = new Set<string>();
  for (const [name, def] of Object.entries(argsDef)) {
    accepted.add(fold(name));
    const alias = (def as { alias?: string | string[] }).alias;
    for (const entry of Array.isArray(alias) ? alias : alias ? [alias] : []) {
      accepted.add(fold(entry));
    }
  }
  return accepted;
}

/** The flags passed that the command does not define, in the order given. */
export function unknownArgs(args: Record<string, unknown>, argsDef: ArgsDef): string[] {
  const accepted = acceptedNames(argsDef);
  return Object.keys(args).filter((key) => key !== '_' && !accepted.has(fold(key)));
}

/**
 * Add to a command's `plugins`. It has to go on each command rather than on
 * the root: a subcommand runs through its own plugin list, not its parent's.
 */
export const strictArgs: CittyPlugin = defineCittyPlugin({
  name: 'vttforge:strict-args',
  setup({ args, cmd }) {
    // Resolved by the time a plugin runs. A command whose args are a promise
    // or a function is not one of ours.
    const argsDef = typeof cmd.args === 'object' && cmd.args !== null ? (cmd.args as ArgsDef) : {};
    const unknown = unknownArgs(args as Record<string, unknown>, argsDef);
    if (unknown.length === 0) return;

    const named = unknown.map((flag) => `--${flag}`).join(', ');
    const known = Object.keys(argsDef)
      .filter((name) => (argsDef[name] as { type?: string }).type !== 'positional')
      .map((name) => `--${name}`)
      .join(', ');
    // Resolved, like `args`, by the time a plugin runs.
    const meta = cmd.meta as { name?: string } | undefined;
    const label = meta?.name ? ` ${meta.name}` : '';
    console.error(
      `Unknown ${unknown.length === 1 ? 'flag' : 'flags'} for \`vttforge${label}\`: ${named}.`,
    );
    console.error(`This command takes: ${known}.`);
    // Exiting here skips citty's `cleanup` hooks. No command defines one,
    // and a test holds that true: a command that starts a watcher or a
    // server would need its teardown to run, and this would walk past it.
    // citty does not export `CLIError`, and any other throw prints a stack.
    process.exit(1);
  },
}) as CittyPlugin;
