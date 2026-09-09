import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { planSheetFile } from '../../migrate/sheets.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(here, 'fixtures', 'v1-actor-sheet.mjs'), 'utf8');

describe('planSheetFile', () => {
  const plan = planSheetFile('module/actor-sheet.mjs', FIXTURE, {
    lang: 'js',
    tabIds: { '.tabs': ['items', 'notes'] },
  });
  const file = plan.files[0];
  if (!file) throw new Error('the fixture produced no file');

  it('writes the class next to the original, on the SDK base', () => {
    expect(file.to).toBe('module/actor-sheet.v2.mjs');
    expect(file.className).toBe('HeroSheet');
    expect(file.base).toBe('BaseActorSheet');
    expect(file.source).toContain(`import { BaseActorSheet } from '@vttforge/core';`);
    expect(file.source).toContain(`import { helper } from '../utils.mjs';`);
    expect(file.source).toContain('const { DialogV2 } = foundry.applications.api;');
    expect(file.source).toContain('export class HeroSheet extends BaseActorSheet() {');
    expect(file.source).toContain('  get actor() {\n    return this.document;\n  }');
  });

  it('declares the statics and the actions', () => {
    expect(file.source).toContain(
      "  static TABS = {\n    primary: { tabs: [{ id: 'items' }, { id: 'notes' }], initial: 'items' },\n  };",
    );
    expect(file.source).toContain(
      "  static DRAG_DROP = [{ dragSelector: '.item-row', dropSelector: null }];",
    );
    expect(file.source).toContain("sheet: { template: 'systems/hero/templates/actor-sheet.html' }");
    expect(file.source).toContain(
      '      actions: {\n        itemCreate: HeroSheet.prototype._onItemCreate,\n        itemDelete: HeroSheet.prototype._onItemDelete,\n        restButton: HeroSheet.prototype._onRestButton,\n      },',
    );
    expect(file.actions.map((a) => [a.name, a.method])).toEqual([
      ['itemCreate', '_onItemCreate'],
      ['itemDelete', '_onItemDelete'],
      ['restButton', '_onRestButton'],
    ]);
  });

  it('carries the methods over with the V2 signatures', () => {
    expect(file.source).toContain('  async _onItemCreate(event, target) {');
    expect(file.source).toContain(
      "  async _onItemDelete(ev, target) {\n    const li = target.closest('.item-row');",
    );
    expect(file.source).toContain(
      "DialogV2.confirm({ window: { title: 'Delete' }, content: '<p>Sure?</p>', yes: { callback: () => true }, no: { callback: () => false } })",
    );
    expect(file.source).toContain('[li.dataset.itemId]');
    expect(file.source).toContain('  async _onRestButton(event, target) {');
    expect(file.source).toContain(
      '  async _prepareContext(options) {\n    const data = await super._prepareContext(options);\n    data.actor = this.document;',
    );
    expect(file.source).toContain('  async onDropItem(droppedItem, event) {');
    expect(file.source).toContain(
      "this.document.createEmbeddedDocuments('Item', [droppedItem.toObject()])",
    );
    expect(file.source).toContain(
      "  _onItemEdit(event) {\n    const li = event.currentTarget.closest('.item-row');\n    this.actor.items.get(li.dataset.itemId).sheet.render(true);",
    );
    expect(file.source).toContain('  _onDragStart(event) {');
    expect(file.source).not.toContain('activateListeners');
  });

  it('rewrites the jQuery inside a render listener and keeps its indentation', () => {
    expect(file.source).toContain(
      "    for (const el of this.element.querySelectorAll('[name=\"system.armed\"]')) {\n      el.addEventListener('change', (e) => {\n        if (e.target.checked) this.element.querySelectorAll('[name=\"system.hidden\"]')[0].checked = false;\n      });\n    }",
    );
  });

  it('marks PARTS when a getter picks the template at runtime', () => {
    const src = `export class S extends ItemSheet {
      static get defaultOptions() { return mergeObject(super.defaultOptions, { template: 'systems/x/templates/a.html' }); }
      get template() { return \`systems/x/templates/\${this.item.type}.html\`; }
    }`;
    const p = planSheetFile('s.mjs', src, { lang: 'js', tabIds: {} });
    expect(p.files[0]?.source).toContain('TODO(migrate): the template is chosen at runtime');
    expect(p.files[0]?.source).toContain('  get template() {');
  });

  it('adds the render listener for the dblclick', () => {
    expect(file.source).toContain(
      "  /** @override */\n  _onRender(context, options) {\n    super._onRender(context, options);\n    for (const el of this.element.querySelectorAll('.item-name')) {\n      el.addEventListener('dblclick', (event) => this._onItemEdit(event));\n    }",
    );
  });

  it('flags a v1 lifecycle override and rewrites the jQuery in it', () => {
    expect(file.source).toContain(
      '// TODO(migrate): setPosition is an Application v1 lifecycle override',
    );
    expect(file.source).toContain(
      "this.element.querySelectorAll('.sheet-body').css('height', position.height - 100);",
    );
  });

  it('leaves TODOs where it stopped, and lists them with their lines', () => {
    expect(file.source).toContain('// TODO(migrate): Dialog v1');
    expect(file.todos.length).toBeGreaterThanOrEqual(2);
    const lines = file.source.split('\n');
    for (const t of file.todos) expect(lines[t.line - 1]).toContain('TODO(migrate)');
  });

  it('records the templates and nav selectors for the template pass', () => {
    expect(file.templates).toEqual(['systems/hero/templates/actor-sheet.html']);
    expect(file.tabNavSelectors).toEqual(['.tabs']);
  });

  it('matches the snapshot', () => {
    expect(file.source).toMatchSnapshot();
  });

  it('reports an unsupported base and ignores files with no sheet', () => {
    const src = 'export class P extends FormApplication {}';
    const p = planSheetFile('module/p.mjs', src, { lang: 'js', tabIds: {} });
    expect(p.files).toEqual([]);
    expect(p.notes[0]).toMatch(/FormApplication/);
    expect(
      planSheetFile('module/x.mjs', 'export const a = 1;', { lang: 'js', tabIds: {} }),
    ).toEqual({
      files: [],
      notes: [],
    });
  });
});
