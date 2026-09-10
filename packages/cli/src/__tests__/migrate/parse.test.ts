import { describe, expect, it } from 'vitest';
import { findSheetClasses, methodOf, parseSource, unsupportedBases } from '../../migrate/parse.js';

const SRC = `
import { x } from './x.js';
export class HeroSheet extends ActorSheet {
  static get defaultOptions() { return foundry.utils.mergeObject(super.defaultOptions, { width: 1 }); }
  async getData() { return super.getData(); }
}
export class GearSheet extends foundry.appv1.sheets.ItemSheet {}
export class Picker extends FormApplication {}
export class Ask extends Dialog {}
const Anon = class extends ActorSheet {};
export default class extends ItemSheet {}
`;

describe('findSheetClasses', () => {
  it('finds bare and namespaced ActorSheet / ItemSheet subclasses', () => {
    const ast = parseSource(SRC, 'js');
    const found = findSheetClasses(ast, SRC).map((c) => [c.name, c.base, c.superText]);
    expect(found).toEqual([
      ['HeroSheet', 'ActorSheet', 'ActorSheet'],
      ['GearSheet', 'ItemSheet', 'foundry.appv1.sheets.ItemSheet'],
      ['Picker', 'FormApplication', 'FormApplication'],
      ['Anon', 'ActorSheet', 'ActorSheet'],
      ['DefaultItemSheet', 'ItemSheet', 'ItemSheet'],
    ]);
  });

  it('reports the v1 bases it does not convert', () => {
    const ast = parseSource(SRC, 'js');
    expect(unsupportedBases(ast, SRC)).toEqual([{ name: 'Ask', superText: 'Dialog', line: 9 }]);
  });

  it('parses TypeScript when asked', () => {
    const ts = 'export class S extends ActorSheet { private n: number = 1; }';
    expect(findSheetClasses(parseSource(ts, 'ts'), ts)).toHaveLength(1);
  });

  it('finds a method by name, kind and staticness', () => {
    const ast = parseSource(SRC, 'js');
    const hero = findSheetClasses(ast, SRC)[0];
    if (!hero) throw new Error('fixture has no sheet class');
    expect(methodOf(hero.node, 'defaultOptions', { static: true, kind: 'get' })?.kind).toBe('get');
    expect(methodOf(hero.node, 'getData')?.kind).toBe('method');
    expect(methodOf(hero.node, 'nope')).toBeNull();
  });
});
