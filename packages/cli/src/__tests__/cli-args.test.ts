/**
 * Argument parsing is the CLI's contract with its users, and it was the one
 * part nothing covered: the command tree used to live in the bin, which runs
 * on import, so no test could reach it.
 *
 * These cases parse real argv against the real definitions. The negation
 * flags matter most — `--no-install` silently ceasing to work would make the
 * scaffolder install dependencies for someone who asked it not to, and
 * nothing downstream would complain.
 */
import type { ArgsDef } from 'citty';
import { parseArgs } from 'citty';
import { describe, expect, it } from 'vitest';
import { audit, dev, init, main } from '../cli.js';

// `CommandDef.args` is declared as resolvable — it may be a function citty
// awaits. Ours are always plain objects, so the cast is safe here and keeps
// each case readable.
const parse = (cmd: { args?: unknown }, argv: string[]) =>
  parseArgs(argv, (cmd.args ?? {}) as ArgsDef);

describe('init args', () => {
  it('defaults install and git to true, so a bare run does both', () => {
    const args = parse(init, ['my-sys']);
    expect(args.install).toBe(true);
    expect(args.git).toBe(true);
  });

  it.each([
    ['--no-install', 'install'],
    ['--no-git', 'git'],
  ])('%s turns %s off', (flag, key) => {
    expect(parse(init, ['my-sys', flag])[key]).toBe(false);
  });

  it('turns both off together', () => {
    const args = parse(init, ['my-sys', '--no-install', '--no-git']);
    expect(args.install).toBe(false);
    expect(args.git).toBe(false);
  });

  it('reads the name as a positional', () => {
    expect(parse(init, ['my-sys']).name).toBe('my-sys');
    expect(parse(init, []).name).toBeUndefined();
  });

  it('defaults yes to false, so a bare run still prompts', () => {
    expect(parse(init, ['my-sys']).yes).toBe(false);
  });

  it.each([['--yes'], ['-y']])('%s turns off prompting', (flag) => {
    expect(parse(init, ['my-sys', flag]).yes).toBe(true);
  });

  it('reads every metadata flag', () => {
    const args = parse(init, [
      'my-sys',
      '--id',
      'pdf-character-sheet',
      '--title',
      'PDF Character Sheet',
      '--description',
      'Form-fillable PDFs as sheets',
      '--author',
      'Fabricio Cavalcante',
      '--license',
      'Apache-2.0',
    ]);
    expect(args).toMatchObject({
      id: 'pdf-character-sheet',
      title: 'PDF Character Sheet',
      description: 'Form-fillable PDFs as sheets',
      author: 'Fabricio Cavalcante',
      license: 'Apache-2.0',
    });
  });

  it.each([
    [['my-sys', '--type', 'module', '--lang', 'js']],
    [['my-sys', '--type=module', '--lang=js']],
  ])('accepts %j for type and lang', (argv) => {
    const args = parse(init, argv);
    expect(args.type).toBe('module');
    expect(args.lang).toBe('js');
  });
});

describe('dev args', () => {
  it.each([['--foundry-data'], ['--data-dir']])(
    '%s resolves to the canonical foundry-data',
    (flag) => {
      expect(parse(dev, [flag, '/tmp/fd'])['foundry-data']).toBe('/tmp/fd');
    },
  );

  it('leaves foundry-data unset when the flag is absent', () => {
    expect(parse(dev, [])['foundry-data']).toBeUndefined();
  });
});

describe('audit args', () => {
  it('defaults both flags off and takes the path as a positional', () => {
    const args = parse(audit, ['./proj']);
    expect(args.path).toBe('./proj');
    expect(args.json).toBe(false);
    expect(args.strict).toBe(false);
  });

  it.each([['json'], ['strict']])('--%s turns it on', (key) => {
    expect(parse(audit, [`--${key}`])[key]).toBe(true);
  });

  it('combines the path with both flags', () => {
    const args = parse(audit, ['./proj', '--json', '--strict']);
    expect(args).toMatchObject({ path: './proj', json: true, strict: true });
  });
});

describe('command tree', () => {
  it('registers the four subcommands', () => {
    expect(Object.keys(main.subCommands ?? {}).sort()).toEqual(['audit', 'build', 'dev', 'init']);
  });
});
