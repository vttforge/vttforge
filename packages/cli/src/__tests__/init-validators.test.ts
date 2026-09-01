import { describe, expect, it } from 'vitest';
import { validateMetadata, validatePackageId, validateRequiredMetadata } from '../commands/init.js';

describe('validatePackageId', () => {
  it.each([['my-system'], ['a'], ['sys2'], ['a-b-c-1']])('accepts %j', (id) => {
    expect(validatePackageId(id)).toBeUndefined();
  });

  it.each([
    ['', 'empty'],
    ['1leading', 'leading digit'],
    ['-leading', 'leading dash'],
    ['Upper', 'uppercase'],
    ['has space', 'space'],
    ['has.dot', 'dot'],
    ['has/slash', 'slash'],
  ])('rejects %j (%s)', (id) => {
    expect(validatePackageId(id)).toMatch(/must start with a letter/);
  });

  it('rejects undefined rather than coercing it to the string "undefined"', () => {
    expect(validatePackageId(undefined)).toMatch(/must start with a letter/);
  });
});

describe('validateMetadata', () => {
  it.each([['A plain title'], ["Vex's Grimoire"], ['Dashes - and, commas']])(
    'accepts %j',
    (value) => {
      expect(validateMetadata(value)).toBeUndefined();
    },
  );

  it.each([
    ['a "quoted" word', 'double quote'],
    ['back\\slash', 'backslash'],
    ['line\nbreak', 'newline'],
    ['tab\there', 'tab'],
  ])('rejects %j (%s) — it would break the generated manifest', (value) => {
    expect(validateMetadata(value)).toMatch(/backslashes, double quotes/);
  });

  it('rejects a block-comment terminator, which would truncate generated headers', () => {
    expect(validateMetadata('ends the */ header')).toMatch(/closes block comments/);
  });

  it.each([[undefined], ['']])('treats %j as blank, which is allowed here', (value) => {
    expect(validateMetadata(value)).toBeUndefined();
  });
});

describe('validateRequiredMetadata', () => {
  it('accepts a filled value', () => {
    expect(validateRequiredMetadata('My System')).toBeUndefined();
  });

  it.each([[undefined], [''], ['   ']])('rejects %j', (value) => {
    expect(validateRequiredMetadata(value)).toMatch(/Required/);
  });

  it('still applies the metadata rules on top of the blank check', () => {
    expect(validateRequiredMetadata('a "quoted" title')).toMatch(/backslashes, double quotes/);
  });
});
