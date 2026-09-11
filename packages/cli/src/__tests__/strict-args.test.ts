/**
 * A flag the command does not define used to be collected, ignored and
 * forgotten. `vttforge init app --typ module` scaffolded a system and exited
 * 0, and a README naming a flag that no longer exists did the same.
 */
import type { ArgsDef } from 'citty';
import { parseArgs } from 'citty';
import { describe, expect, it } from 'vitest';
import { audit, build, dev, init, lint, migrate } from '../cli.js';
import { unknownArgs } from '../strict-args.js';

const defOf = (cmd: { args?: unknown }) => (cmd.args ?? {}) as ArgsDef;
const unknownIn = (cmd: { args?: unknown }, argv: string[]) =>
  unknownArgs(parseArgs(argv, defOf(cmd)) as Record<string, unknown>, defOf(cmd));

describe('unknownArgs', () => {
  it('names a flag the command does not define', () => {
    expect(unknownIn(init, ['app', '--type', 'module', '--wat=42'])).toEqual(['wat']);
  });

  it('names every one of them, in the order given', () => {
    expect(unknownIn(init, ['app', '--wat=1', '--nope=2'])).toEqual(['wat', 'nope']);
  });

  it('says nothing about a command called correctly', () => {
    expect(
      unknownIn(init, [
        'app',
        '--type',
        'module',
        '--lang',
        'ts',
        '-y',
        '--no-install',
        '--no-git',
      ]),
    ).toEqual([]);
  });

  it('takes an alias, and either case of a two-word flag', () => {
    // The parser answers to a flag under several keys at once. Every one of
    // them has to pass, or a correct call would be refused.
    expect(unknownIn(dev, ['--data-dir', '/x'])).toEqual([]);
    expect(unknownIn(dev, ['--foundry-data', '/x'])).toEqual([]);
    expect(unknownIn(dev, ['--foundryData', '/x'])).toEqual([]);
  });

  it('leaves the positional alone', () => {
    expect(unknownIn(init, ['my-module'])).toEqual([]);
  });

  it.each([
    ['init', init],
    ['dev', dev],
    ['build', build],
    ['lint', lint],
    ['audit', audit],
    ['migrate', migrate],
  ])('%s carries the check', (_name, cmd) => {
    // The plugin has to be on each command. A subcommand runs its own plugin
    // list, not its parent's, so putting it on the root would cover nothing.
    const plugins = (cmd as { plugins?: Array<{ name?: string }> }).plugins ?? [];
    expect(plugins.map((plugin) => plugin.name)).toContain('vttforge:strict-args');
  });

  it.each([
    ['init', init],
    ['dev', dev],
    ['build', build],
    ['lint', lint],
    ['audit', audit],
    ['migrate', migrate],
  ])('%s defines no cleanup hook', (_name, cmd) => {
    // The plugin refuses an unknown flag by exiting, which walks past
    // citty's cleanup hooks. Nothing defines one today. The day something
    // does, this fails, and the plugin has to stop exiting rather than
    // skipping a teardown in silence.
    expect((cmd as { cleanup?: unknown }).cleanup).toBeUndefined();
  });

  it.each([
    ['init', init],
    ['dev', dev],
    ['build', build],
    ['lint', lint],
    ['audit', audit],
    ['migrate', migrate],
  ])('%s still accepts every flag it declares', (_name, cmd) => {
    // Guards the fold: a declared flag must never read as unknown.
    const names = Object.entries(defOf(cmd))
      .filter(([, def]) => (def as { type?: string }).type !== 'positional')
      .map(([name]) => name);
    const args = Object.fromEntries(names.map((name) => [name, 'x']));
    expect(unknownArgs(args, defOf(cmd))).toEqual([]);
  });
});
