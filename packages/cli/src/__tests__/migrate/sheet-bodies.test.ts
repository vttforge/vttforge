import { describe, expect, it } from 'vitest';
import {
  rewriteDialogs,
  rewriteDropMethod,
  rewriteGetData,
  rewriteHandlerBody,
  rewriteUpdateObject,
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
    expect(r.code).toContain('const name = this.element.querySelectorAll(".name");');
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

  it('turns this.element.find into querySelector and flags css()', () => {
    const r = rewriteHandlerBody("{ this.element.find('.body').css('height', h); }", null, null);
    expect(r.code).toContain("this.element.querySelectorAll('.body').css('height', h);");
    expect(r.todos).toHaveLength(1);
  });

  it('reads jQuery parents() as the nearest ancestor', () => {
    const r = rewriteHandlerBody('{ const li = $(ev.currentTarget).parents(".row"); }', 'ev', null);
    expect(r.code).toBe('{ const li = target.closest(".row"); }');
    expect(r.todos).toEqual([]);
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
    expect(r.code).toContain('data.data = this.document;');
    expect(r.code).toContain('data.editable = this.isEditable;');
    expect(r.code).toContain('data.owner = this.document.isOwner;');
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
  });

  it('replaces the old payload identifier with toDragData()', () => {
    const src = `async _onDropItem(event, data) {
    const { item } = await fromDropData(data);
    return super._onDropItem(event, data);
  }`;
    const r = rewriteDropMethod(src, 'Item');
    expect(r.code).toContain('await fromDropData(droppedItem.toDragData());');
    expect(r.code).toContain(
      "this.document.createEmbeddedDocuments('Item', [droppedItem.toObject()]);",
    );
    const codeLines = r.code.split('\n').filter((l) => !l.includes('TODO(migrate)'));
    expect(codeLines.join('\n')).not.toMatch(/\bdata\b/);
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
      `const ok = await DialogV2.confirm({ window: { title: t }, content: c, yes: { callback: (event, button, dialog) => true }, no: { callback: (event, button, dialog) => false } });`,
    );
    const withHtml = rewriteDialogs(
      `await Dialog.confirm({ title: t, content: c, yes: (html) => html.find("input").val(), rejectClose: false });`,
    );
    expect(withHtml.code).toBe(
      `await DialogV2.confirm({ window: { title: t }, content: c, yes: { callback: (event, button, dialog) => dialog.element.querySelector("input").value }, rejectClose: false });`,
    );
    expect(r.todos).toEqual([]);
  });

  it('turns new Dialog({...}).render(true) into DialogV2.wait with the buttons as a list', () => {
    const src = `    new Dialog({
      title: game.i18n.localize("X.Create"),
      content,
      buttons: {
        create: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize("X.Create"),
          callback: (html) => {
            const form = html[0].querySelector("form");
            const name = html.find("[name=name]").val();
            this.actor.createOwnedItem({ name: form.itemname.value, alt: name });
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "create",
    }).render(true);`;
    const r = rewriteDialogs(src);
    expect(r.todos).toEqual([]);
    expect(r.code).toContain('DialogV2.wait({');
    expect(r.code).toContain('window: { title: game.i18n.localize("X.Create") },');
    expect(r.code).toContain('content,');
    expect(r.code).toContain(
      "{ action: 'create', icon: 'fas fa-check', label: game.i18n.localize(\"X.Create\"), callback: (event, button, dialog) => {",
    );
    expect(r.code).toContain('const form = dialog.element.querySelector("form");');
    expect(r.code).toContain('const name = dialog.element.querySelector("[name=name]").value;');
    expect(r.code).toContain('default: true },');
    expect(r.code).toContain('{ action: \'cancel\', label: "Cancel" },');
    expect(r.code).not.toContain('.render(true)');
    expect(r.code).not.toContain('new Dialog');
  });

  it('notes a new Dialog kept in a variable, and marks one it cannot read', () => {
    const kept = rewriteDialogs(
      `const d = new Dialog({ title: t, content: c, buttons: {} });\nd.render(true);`,
    );
    expect(kept.code).toContain('const d = DialogV2.wait({');
    expect(kept.todos.some((m) => /drop any later \.render/.test(m))).toBe(true);

    const unreadable = rewriteDialogs('new Dialog(makeOptions()).render(true);');
    expect(unreadable.code).toContain('new Dialog(makeOptions()).render(true);');
    expect(unreadable.code).toMatch(/TODO\(migrate\): new Dialog here could not be read/);
    expect(unreadable.todos).toHaveLength(1);
  });

  it('turns Dialog.prompt into DialogV2.prompt', () => {
    const r = rewriteDialogs(
      `await Dialog.prompt({ title: t, content: c, label: "Go", callback: (html) => html.find("input").val(), rejectClose: false });`,
    );
    expect(r.code).toBe(
      'await DialogV2.prompt({ window: { title: t }, content: c, ok: { label: "Go", callback: (event, button, dialog) => dialog.element.querySelector("input").value }, rejectClose: false });',
    );
    expect(r.todos).toEqual([]);
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

describe('rewriteUpdateObject', () => {
  it('reads TypeScript annotations and a return type', () => {
    const src = `  async _updateObject(event: Event, data: Record<string, unknown>): Promise<void> {
    await save(data);
  }`;
    const r = rewriteUpdateObject(src);
    expect(r.code).toContain('static async formHandler(event, form, formData) {');
    expect(r.code).toContain('const data = foundry.utils.expandObject(formData.object);');
  });

  it('moves the parameter aside when the body called it formData', () => {
    const r = rewriteUpdateObject(
      '  async _updateObject(event, formData) {\n    for (const k of Object.keys(formData)) use(k);\n  }',
    );
    expect(r.code).toContain('static async formHandler(event, form, submission) {');
    expect(r.code).toContain('const formData = foundry.utils.expandObject(submission.object);');
  });
});

describe('the dialog callback parameter', () => {
  it('is replaced in a ternary and left alone as an object key', () => {
    const r = rewriteDialogs(
      'await Dialog.prompt({ title: t, content: c, label: "Go", callback: (html) => ({ html: 1, el: ok ? html : null }) });',
    );
    expect(r.code).toContain('({ html: 1, el: ok ? dialog.element : null })');
  });
});

describe('the rest of a v1 dialog literal', () => {
  it('moves close to the (event, dialog) signature and asks for buttons when there are none', () => {
    const r = rewriteDialogs(
      `new Dialog({ title: t, content: c, close: (html) => html.find("x").val() }).render(true);`,
    );
    expect(r.code).toContain('close: (event, dialog) => dialog.element.querySelector("x").value');
    expect(r.todos.join(' ')).toMatch(/buttons/);
  });
});

describe('enrichHTML on v14', () => {
  it('drops the async option', () => {
    const r = rewriteHandlerBody(
      '{ a = await TextEditor.enrichHTML(x, { async: true }); b = await enrichHTML(y, { async: true, secrets: true }); c = await enrichHTML(z, { secrets: true, async: true }); }',
      null,
      null,
    );
    expect(r.code).toBe(
      '{ a = await TextEditor.enrichHTML(x); b = await enrichHTML(y, { secrets: true }); c = await enrichHTML(z, { secrets: true }); }',
    );
  });
});
