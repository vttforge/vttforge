import { describe, expect, it } from 'vitest';
import { findSheetClasses, parseSource } from '../../migrate/parse.js';
import { extractOptions, renderStatics } from '../../migrate/sheet-options.js';

const SRC = `
export class HeroSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["hero", "sheet", "actor"],
      template: "systems/hero/templates/actor-sheet.html",
      width: 600,
      height: 750,
      resizable: true,
      scrollY: [".items"],
      tabs: [{ navSelector: ".tabs", contentSelector: ".content", initial: "items" }],
      dragDrop: [{ dragSelector: ".item-row", dropSelector: null }],
    });
  }
}`;

function options(src: string) {
  const cls = findSheetClasses(parseSource(src, 'js'), src)[0];
  if (!cls) throw new Error('fixture has no sheet class');
  return extractOptions(cls, src);
}

describe('extractOptions', () => {
  it('reads the mergeObject literal', () => {
    const o = options(SRC);
    expect(o.classes).toBe('["hero", "sheet", "actor"]');
    expect(o.template).toBe('systems/hero/templates/actor-sheet.html');
    expect(o.width).toBe(600);
    expect(o.height).toBe(750);
    expect(o.resizable).toBe(true);
    expect(o.tabs).toEqual([
      { navSelector: '.tabs', contentSelector: '.content', initial: 'items' },
    ]);
    expect(o.dragDrop).toBe('[{ dragSelector: ".item-row", dropSelector: null }]');
    expect(o.unknown).toEqual(['scrollY']);
  });

  it('keeps a dynamic template getter', () => {
    const src = `class S extends ItemSheet {
      static get defaultOptions() { return mergeObject(super.defaultOptions, { width: 1 }); }
      get template() { return \`systems/x/\${this.item.type}.html\`; }
    }`;
    const o = options(src);
    expect(o.template).toBeNull();
    expect(o.templateGetter?.kind).toBe('get');
  });

  it('tolerates a class with no defaultOptions', () => {
    const o = options('class S extends ActorSheet {}');
    expect(o.width).toBeNull();
    expect(o.tabs).toEqual([]);
  });
});

describe('renderStatics', () => {
  it('writes DEFAULT_OPTIONS, TABS, DRAG_DROP and PARTS', () => {
    const o = options(SRC);
    const out = renderStatics(o, { '.tabs': ['items', 'notes'] }, (m) => `// TODO(migrate): ${m}`);
    expect(out).toContain('classes: ["hero", "sheet", "actor"],');
    expect(out).toContain('position: { width: 600, height: 750 },');
    expect(out).toContain('window: { resizable: true },');
    expect(out).toContain('form: { submitOnChange: true },');
    expect(out).toContain(
      "static TABS = {\n    primary: { tabs: [{ id: 'items' }, { id: 'notes' }], initial: 'items' },\n  };",
    );
    expect(out).toContain(
      'static DRAG_DROP = [{ dragSelector: ".item-row", dropSelector: null }];',
    );
    expect(out).toContain(
      "static PARTS = {\n    sheet: { template: 'systems/hero/templates/actor-sheet.html' },\n  };",
    );
    expect(out).toContain('// TODO(migrate): scrollY');
  });

  it('marks tabs whose ids it could not read', () => {
    const o = options(SRC);
    const out = renderStatics(o, {}, (m) => `// TODO(migrate): ${m}`);
    expect(out).toContain("primary: { tabs: [], initial: 'items' }");
    expect(out).toContain('TODO(migrate): tab ids');
  });
});
