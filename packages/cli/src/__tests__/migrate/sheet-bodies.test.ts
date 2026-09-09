import { describe, expect, it } from 'vitest';
import {
  rewriteDialogs,
  rewriteDropMethod,
  rewriteGetData,
  rewriteHandlerBody,
} from '../../migrate/sheet-bodies.js';

describe('rewriteHandlerBody', () => {
  it('replaces the event target and the jQuery helpers', () => {
    const body = `{
      const li = $(ev.currentTarget).closest(".item");
      const id = li.data("itemId");
      const kind = li.data("item-kind");
      const el = ev.currentTarget;
      const name = html.find(".name");
    }`;
    const r = rewriteHandlerBody(body, 'ev', 'html');
    expect(r.code).toContain('const li = target.closest(".item");');
    expect(r.code).toContain('const id = li.dataset.itemId;');
    expect(r.code).toContain('const kind = li.dataset.itemKind;');
    expect(r.code).toContain('const el = target;');
    expect(r.code).toContain('const name = this.element.querySelector(".name");');
    expect(r.todos).toEqual([]);
  });

  it('marks the jQuery it cannot translate', () => {
    const body = `{
      const v = $(ev.currentTarget).val();
      $(".x").slideToggle();
    }`;
    const r = rewriteHandlerBody(body, 'ev', null);
    expect(r.code).toContain('TODO(migrate)');
    expect(r.todos).toHaveLength(2);
  });

  it('marks a line once however much jQuery it holds', () => {
    const r = rewriteHandlerBody(`{ $(".a").val($(".b").text()); }`, null, null);
    expect(r.todos).toHaveLength(1);
    expect(r.code.match(/TODO\(migrate\)/g)).toHaveLength(1);
  });

  it('leaves a body with no event param alone', () => {
    expect(rewriteHandlerBody('{ await this.actor.rest(); }', null, null).code).toBe(
      '{ await this.actor.rest(); }',
    );
  });
});

describe('rewriteGetData', () => {
  it('becomes _prepareContext and fills the context keys V2 does not', () => {
    const src = `async getData() {
    const data = await super.getData();
    data.items = data.items.sort();
    return data;
  }`;
    const r = rewriteGetData(src, 'ActorSheet');
    expect(r.code).toContain('async _prepareContext(options) {');
    expect(r.code).toContain('const data = await super._prepareContext(options);');
    expect(r.code).toContain('data.actor = this.document;');
    expect(r.code).toContain('data.system = this.document.system;');
    expect(r.code).toContain('data.items = [...this.document.items];');
    expect(r.code.indexOf('data.actor = ')).toBeLessThan(
      r.code.indexOf('data.items = data.items.sort()'),
    );
  });

  it('uses item for item sheets and skips keys the method sets itself', () => {
    const src = `getData() { const context = super.getData(); context.system = context.item.system; return context; }`;
    const r = rewriteGetData(src, 'ItemSheet');
    expect(r.code).toContain('context.item = this.document;');
    expect(r.code).not.toContain('context.system = this.document.system;');
    expect(r.code).not.toContain('context.items');
  });

  it('asks for the context keys by hand when nothing takes the super result', () => {
    const r = rewriteGetData('getData() { return { foo: 1 }; }', 'ActorSheet');
    expect(r.todos).toHaveLength(1);
    expect(r.code).toContain('TODO(migrate)');
    expect(r.code).toContain('context.actor = this.document;');
  });

  it('flags a parameter the new signature drops', () => {
    const r = rewriteGetData('async getData(opts) { return super.getData(opts); }', 'ItemSheet');
    expect(r.code).toContain('async _prepareContext(options) {');
    expect(r.todos.join(' ')).toContain('opts');
  });
});

describe('rewriteDropMethod', () => {
  it('renames the drop handler and its super call', () => {
    const src = `async _onDropItem(event, itemData) {
    const item = ((await super._onDropItem(event, itemData)) || []).pop();
    return item;
  }`;
    const r = rewriteDropMethod(src, 'Item');
    expect(r.code).toContain('async onDropItem(droppedItem, event) {');
    expect(r.code).toContain(
      "this.document.createEmbeddedDocuments('Item', [droppedItem.toObject()])",
    );
    expect(r.todos.length).toBeGreaterThan(0);
  });

  it('leaves a signature it cannot read alone', () => {
    const src = 'async _onDropItem(event) { return true; }';
    const r = rewriteDropMethod(src, 'Item');
    expect(r.code).toBe(src);
    expect(r.todos).toEqual([]);
  });
});

describe('rewriteDialogs', () => {
  it('moves Dialog.confirm to DialogV2.confirm', () => {
    const src = `const ok = await Dialog.confirm({ title: t, content: c, yes: () => true, no: () => false, defaultYes: false });`;
    const r = rewriteDialogs(src);
    expect(r.code).toBe(
      `const ok = await DialogV2.confirm({ window: { title: t }, content: c, yes: { callback: () => true }, no: { callback: () => false } });`,
    );
    expect(r.todos).toEqual([]);
  });

  it('marks new Dialog', () => {
    const r = rewriteDialogs(`new Dialog({ title: "x", buttons: {} }).render(true);`);
    expect(r.code).toMatch(/TODO\(migrate\).*DialogV2/);
    expect(r.todos).toHaveLength(1);
  });

  it('leaves the call as written when the options defeat the pattern', () => {
    const src = `const ok = await Dialog.confirm({ title: t, yes: () => this.actor.update({ dead: true }) });`;
    const r = rewriteDialogs(src);
    expect(r.code).toContain(src);
    expect(r.code.startsWith('// TODO(migrate)')).toBe(true);
    expect(r.todos).toHaveLength(1);
  });

  it('flags options it dropped on the floor', () => {
    const r = rewriteDialogs('await Dialog.confirm({ ...base, content: c });');
    expect(r.code).toContain('DialogV2.confirm({ content: c })');
    expect(r.todos).toHaveLength(1);
    expect(r.todos.join(' ')).toContain('spread');
  });

  it('ignores a dialog named inside a comment or a string', () => {
    const src = `// new Dialog({}) was here\nconst s = 'new Dialog({})';`;
    expect(rewriteDialogs(src)).toEqual({ code: src, todos: [] });
  });
});
