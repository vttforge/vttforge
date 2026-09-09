import { describe, expect, it } from 'vitest';
import { findSheetClasses, parseSource } from '../../migrate/parse.js';
import { actionName, extractListeners } from '../../migrate/sheet-listeners.js';

const SRC = `
class S extends ActorSheet {
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.options.editable) return;
    html.find(".item-create").click(this._onItemCreate.bind(this));
    html.find(".item-edit").click((ev) => this._onItemEdit(ev));
    html.find(".item-delete").click(async (ev) => {
      const li = $(ev.currentTarget).closest(".item");
      await this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
    });
    html.find("#rest-button").click(async () => { await this.actor.rest(); });
    html.find(".item-name").dblclick((event) => this._onItemEdit(event));
    html.find(".qty").change(this._onQty.bind(this));
    html.find(".tag").on("contextmenu", (ev) => this._onTag(ev));
    html.find("input").click(this._onInput.bind(this));
    html.on("click", ".late", (ev) => this._onLate(ev));
  }
}`;

describe('actionName', () => {
  it('camel-cases the first class or id', () => {
    const taken = new Set<string>();
    expect(actionName('.item-create', taken)).toBe('itemCreate');
    expect(actionName('#rest-button', taken)).toBe('restButton');
    expect(actionName('.item-toggle-equipped', taken)).toBe('itemToggleEquipped');
    expect(actionName('li.item .item-edit', taken)).toBe('item');
    expect(actionName('input', taken)).toBeNull();
    expect(actionName('[data-x]', taken)).toBeNull();
  });

  it('suffixes a collision', () => {
    const taken = new Set(['itemEdit']);
    expect(actionName('.item-edit', taken)).toBe('itemEdit2');
  });
});

describe('extractListeners', () => {
  const [cls] = findSheetClasses(parseSource(SRC, 'js'), SRC);
  if (!cls) throw new Error('fixture has no sheet class');
  const l = extractListeners(cls, SRC);

  it('turns click bindings into actions', () => {
    expect(l.actions.map((a) => [a.name, a.kind, a.method])).toEqual([
      ['itemCreate', 'method', '_onItemCreate'],
      ['itemEdit', 'method', '_onItemEdit'],
      ['itemDelete', 'inline', null],
      ['restButton', 'inline', null],
    ]);
    const del = l.actions[2];
    expect(del?.param).toBe('ev');
    expect(del?.isAsync).toBe(true);
    expect(del?.body).toContain('deleteEmbeddedDocuments');
    expect(l.actions[3]?.param).toBeNull();
  });

  it('routes other events to _onRender listeners', () => {
    expect(l.listeners.map((x) => [x.selector, x.event])).toEqual([
      ['.item-name', 'dblclick'],
      ['.qty', 'change'],
      ['.tag', 'contextmenu'],
    ]);
    expect(l.listeners[1]?.handlerText).toBe('this._onQty.bind(this)');
  });

  it('lists what it did not translate', () => {
    expect(l.leftovers.map((x) => x.text)).toEqual([
      'html.find("input").click(this._onInput.bind(this));',
      'html.on("click", ".late", (ev) => this._onLate(ev));',
    ]);
  });

  it('is empty for a class without activateListeners', () => {
    const src = 'class T extends ItemSheet {}';
    const [t] = findSheetClasses(parseSource(src, 'js'), src);
    if (!t) throw new Error('fixture has no sheet class');
    expect(extractListeners(t, src)).toEqual({ actions: [], listeners: [], leftovers: [] });
  });
});

describe('bindings under a condition', () => {
  it('are still actions, and the lost condition is reported', () => {
    const src = `class S extends ActorSheet {
      activateListeners(html) {
        super.activateListeners(html);
        if (!this.isEditable) return;
        if (this.actor.isOwner) {
          html.find('.owner-only').click(this._onOwner.bind(this));
        }
      }
    }`;
    const cls = findSheetClasses(parseSource(src, 'js'), src)[0];
    if (!cls) throw new Error('fixture has no sheet class');
    const l = extractListeners(cls, src);
    expect(l.actions.map((a) => a.name)).toEqual(['ownerOnly']);
    expect(l.leftovers).toHaveLength(1);
    expect(l.leftovers[0]?.text).toContain('this.actor.isOwner');
  });
});
