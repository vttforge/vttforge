/**
 * The template half of `migrate --sheets`: attributes appear on opening tags
 * and nothing else in the file moves.
 */
import { describe, expect, it } from 'vitest';
import { editTemplate, readTabIds } from '../../migrate/sheet-templates.js';

const TPL = `<form class="hero" autocomplete="off">
  <button id="rest-button" type="button" class="strict">Rest</button>
  <nav class="tabs" data-group="primary">
    <a class="item" data-tab="items">Items</a>
    <a class="item" data-tab="notes" data-action="vttforgeTab" data-group="primary">Notes</a>
  </nav>
  <div class="tab" data-tab="items">
    <a class="item-create" title="Create"><i class="fas fa-plus"></i></a>
    <li class="item-row" data-item-id="{{item._id}}"><a class="item-delete">x</a></li>
  </div>
  <section class="tab" data-group="primary" data-tab="notes"></section>
</form>
`;

describe('readTabIds', () => {
  it('reads the data-tab values under the nav', () => {
    expect(readTabIds(TPL, '.tabs')).toEqual(['items', 'notes']);
    expect(readTabIds(TPL, '.missing')).toEqual([]);
  });
});

describe('editTemplate', () => {
  const r = editTemplate(TPL, {
    actions: [
      { name: 'itemCreate', selector: '.item-create' },
      { name: 'itemDelete', selector: '.item-delete' },
      { name: 'restButton', selector: '#rest-button' },
    ],
    navSelectors: ['.tabs'],
  });

  it('adds data-action to the matching class and id elements', () => {
    expect(r.output).toContain(
      '<button id="rest-button" type="button" class="strict" data-action="restButton">',
    );
    expect(r.output).toContain('<a class="item-create" title="Create" data-action="itemCreate">');
    expect(r.output).toContain('<a class="item-delete" data-action="itemDelete">');
  });

  it('wires the tabs nav and panes for the SDK tab action', () => {
    expect(r.output).toContain(
      '<a class="item" data-tab="items" data-action="vttforgeTab" data-group="primary">',
    );
    expect(r.output).toContain(
      '<a class="item" data-tab="notes" data-action="vttforgeTab" data-group="primary">',
    );
    expect(r.output).toContain('<div class="tab" data-tab="items" data-group="primary">');
    expect(r.output).toContain('<section class="tab" data-group="primary" data-tab="notes">');
  });

  it('reports each edit with its line and flags the form root', () => {
    expect(r.edits.map((e) => e.line)).toEqual([2, 4, 7, 8, 9]);
    expect(r.formRoot).toBe(true);
  });

  it('changes nothing else', () => {
    const lines = TPL.split('\n');
    const out = r.output.split('\n');
    expect(out.length).toBe(lines.length);
    for (const i of [0, 2, 5, 10, 11]) {
      expect(out[i]).toBe(lines[i]);
    }
  });

  it('is idempotent', () => {
    const again = editTemplate(r.output, {
      actions: [{ name: 'itemCreate', selector: '.item-create' }],
      navSelectors: ['.tabs'],
    });
    expect(again.edits).toEqual([]);
    expect(again.output).toBe(r.output);
  });
});

const HBS = `<div class="sheet">
  <nav class="sheet-tabs">
    <a class="item" data-tab="{{id}}">Dynamic</a>
    <a class="item" data-tab="gear">Gear</a>
  </nav>
  {{#if editable}}
  <div class="tab {{cls}}" data-tab="gear">
    <a class="item-create" data-tooltip="{{localize 'SHEET.Create'}}">+</a>
  </div>
  {{/if}}
</div>
`;

describe('templates with expressions in attribute values', () => {
  const r = editTemplate(HBS, {
    actions: [{ name: 'itemCreate', selector: '.item-create' }],
    navSelectors: ['.sheet-tabs'],
  });

  it('skips a tab id that is an expression', () => {
    expect(readTabIds(HBS, '.sheet-tabs')).toEqual(['gear']);
  });

  it('still edits tags whose attribute values hold expressions', () => {
    expect(r.output).toContain(
      '<a class="item" data-tab="{{id}}" data-action="vttforgeTab" data-group="primary">',
    );
    expect(r.output).toContain('<div class="tab {{cls}}" data-tab="gear" data-group="primary">');
    expect(r.output).toContain(
      `<a class="item-create" data-tooltip="{{localize 'SHEET.Create'}}" data-action="itemCreate">`,
    );
    expect(r.edits.map((e) => e.line)).toEqual([3, 4, 7, 8]);
    expect(r.formRoot).toBe(false);
  });

  it('leaves the block helper lines alone', () => {
    const lines = HBS.split('\n');
    const out = r.output.split('\n');
    expect(out.length).toBe(lines.length);
    for (const i of [0, 1, 5, 9, 10, 11]) {
      expect(out[i]).toBe(lines[i]);
    }
  });
});
