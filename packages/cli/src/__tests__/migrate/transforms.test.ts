/**
 * Each rewrite `vttforge migrate` makes, and each thing it refuses to decide.
 */
import { describe, expect, it } from 'vitest';
import {
  activeEffectModes,
  contextMenuKeys,
  dataOperators,
  hookNotes,
  legacyTransferral,
  removedGlobals,
  rollMode,
  statusEffectsAssignment,
  transformManifest,
  transformSource,
  unregisterCoreSheets,
} from '../../migrate/transforms.js';

describe('removed globals', () => {
  it('namespaces the v12 utilities and Math.clamped', () => {
    const r = removedGlobals('const a = mergeObject(x, y);\nconst b = Math.clamped(v, 0, 1);\n');
    expect(r.output).toBe(
      'const a = foundry.utils.mergeObject(x, y);\nconst b = Math.clamp(v, 0, 1);\n',
    );
    expect(r.changes.map((c) => c.line)).toEqual([1, 2]);
  });

  it('leaves a name the file defines, and the already namespaced call', () => {
    const src =
      "function getProperty(o, k) { return o[k]; }\ngetProperty(x, 'y');\nfoundry.utils.mergeObject(a, b);\n";
    expect(removedGlobals(src).output).toBe(src);
  });

  it('notes game.template instead of guessing', () => {
    const r = removedGlobals('const t = game.template.Actor;\n');
    expect(r.output).toContain('game.template');
    expect(r.notes[0]?.message).toContain('game.model');
  });
});

describe('data operators', () => {
  it('turns deletion keys into _del, nested or not', () => {
    const r = dataOperators(
      "await a.update({ 'system.biography': legacy, '-=system.bio': null, \"flags.mod.-=old\": null });\n",
    );
    expect(r.output).toBe(
      "await a.update({ 'system.biography': legacy, 'system.bio': _del, \"flags.mod.old\": _del });\n",
    );
    expect(r.changes).toHaveLength(2);
  });

  it('handles a template-literal key with a ${} segment in the prefix', () => {
    const r = dataOperators('actor.update({ [`flags.${id}.-=item`]: null });\n');
    expect(r.output).toBe('actor.update({ [`flags.${id}.item`]: _del });\n');
  });

  it('wraps a replacement value of any shape in _replace', () => {
    const r = dataOperators(
      'await a.update({ "==system.stats": { str: 10, list: [1, 2] }, other: 1 });\n',
    );
    expect(r.output).toBe(
      'await a.update({ "system.stats": _replace({ str: 10, list: [1, 2] }), other: 1 });\n',
    );
  });

  it('renames performDeletions and objectsEqual', () => {
    const r = dataOperators(
      'foundry.utils.mergeObject(a, b, { performDeletions: true });\nfoundry.utils.objectsEqual(a, b);\n',
    );
    expect(r.output).toBe(
      'foundry.utils.mergeObject(a, b, { applyOperators: true });\nfoundry.utils.equals(a, b);\n',
    );
  });
});

describe('roll mode', () => {
  it('maps the literal modes and the setting', () => {
    const r = rollMode(
      "roll.toMessage({}, { rollMode: 'gmroll' });\nconst m = game.settings.get('core', 'rollMode');\n",
    );
    expect(r.output).toBe(
      "roll.toMessage({}, { messageMode: 'gm' });\nconst m = game.settings.get('core', 'messageMode');\n",
    );
    expect(r.notes).toEqual([]);
  });

  it('turns "roll" into undefined, and wraps an expression in the mapper', () => {
    const r = rollMode(
      'a({ rollMode: "roll" });\nb({ rollMode: chosen });\nc(undefined, { rollMode: secret ? \'gmroll\' : undefined }).then(x);\n',
    );
    expect(r.output).toBe(
      "a({ messageMode: undefined });\nb({ messageMode: Roll._mapLegacyRollMode(chosen) });\nc(undefined, { messageMode: Roll._mapLegacyRollMode(secret ? 'gmroll' : undefined) }).then(x);\n",
    );
    expect(r.notes).toEqual([]);
  });

  it('replaces the constants and CONFIG.Dice.rollModes', () => {
    const r = rollMode(
      'for (const k in CONFIG.Dice.rollModes) {}\nconst v = CONST.DICE_ROLL_MODES.PRIVATE;\n',
    );
    expect(r.output).toBe('for (const k in CONFIG.ChatMessage.modes) {}\nconst v = "gm";\n');
  });
});

describe('context menu keys', () => {
  it('renames the keys of an entry and notes the new callback shape', () => {
    const src = `options.push({
  name: 'MOD.choose',
  icon: '<i class="fa-solid fa-check"></i>',
  condition: () => game.user.isGM,
  callback: (li) => open(li),
});
const other = { name: 'kept', value: 1 };
`;
    const r = contextMenuKeys(src);
    expect(r.output).toContain("  label: 'MOD.choose',");
    expect(r.output).toContain('  visible: () => game.user.isGM,');
    expect(r.output).toContain('  onClick: (li) => open(li),');
    expect(r.output).toContain("const other = { name: 'kept', value: 1 };");
    expect(r.notes[0]?.message).toContain('(event, target)');
  });
});

describe('context menu keys, the shapes that are not entries', () => {
  it('leaves a Dialog button alone: it has icon, label and callback, and keeps callback', () => {
    const src = `new Dialog({
  title: "T",
  buttons: {
    create: {
      icon: '<i class="fas fa-check"></i>',
      label: game.i18n.localize("X"),
      callback: (html) => save(html),
    },
  },
  default: "create",
});
`;
    const r = contextMenuKeys(src);
    expect(r.output).toBe(src);
    expect(r.changes).toEqual([]);
  });

  it('renames only the entry, not the class body or the nested object around it', () => {
    const src = `class Sheet {
  static name = "kept";
  menu() {
    return [{ name: "MOD.x", condition: () => true, callback: (li) => ({ name: li.dataset.name }) }];
  }
}
`;
    const r = contextMenuKeys(src);
    expect(r.output).toBe(`class Sheet {
  static name = "kept";
  menu() {
    return [{ label: "MOD.x", visible: () => true, onClick: (li) => ({ name: li.dataset.name }) }];
  }
}
`);
    expect(r.changes).toHaveLength(1);
  });
});

describe('legacyTransferral and core sheets', () => {
  it('drops the assignment, the registerSystem option, and the unregister lines', () => {
    const src = `CONFIG.ActiveEffect.legacyTransferral = false;
registerSystem({
  id: 'x',
  activeEffect: { legacyTransferral: false },
  onBeforeInit: () => {
    const { Actors, Items } = foundry.documents.collections;
    Actors.unregisterSheet('core', foundry.applications.sheets.ActorSheetV2);
    Items.unregisterSheet("core", foundry.applications.sheets.ItemSheetV2);
  },
});
`;
    const out = unregisterCoreSheets(legacyTransferral(src).output).output;
    expect(out).toBe(`registerSystem({
  id: 'x',
  onBeforeInit: () => {
    const { Actors, Items } = foundry.documents.collections;
  },
});
`);
  });
});

describe('status effects and effect modes', () => {
  it('adds status effects by id instead of assigning the array', () => {
    const r = statusEffectsAssignment(
      'CONFIG.statusEffects = [\n  { id: "a" },\n  { id: "b" },\n];\nif (CONFIG.statusEffects === x) {}\n',
    );
    expect(r.output).toBe(
      'for (const effect of [\n  { id: "a" },\n  { id: "b" },\n]) CONFIG.statusEffects[effect.id] = effect;\nif (CONFIG.statusEffects === x) {}\n',
    );
  });

  it('turns numeric modes into string types and notes system.changes', () => {
    const r = activeEffectModes(
      'changes: [{ key: "system.ac", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: 2 }]\nconst m = CONST.ACTIVE_EFFECT_MODES.OVERRIDE;\n',
    );
    expect(r.output).toBe(
      'changes: [{ key: "system.ac", type: "add", value: 2 }]\nconst m = "override";\n',
    );
    expect(r.notes).toHaveLength(1);
  });
});

describe('the manifest', () => {
  it('declares the type on the line after id and raises compatibility, keeping the file as written', () => {
    const raw =
      '{\n    "id": "my-system",\n    "title": "T",\n    "styles": ["a.css", "b.css"],\n    "compatibility": { "minimum": "13", "verified": "13.341" }\n}';
    const r = transformManifest(raw, 'system');
    expect(r?.output).toBe(
      '{\n    "id": "my-system",\n    "type": "system",\n    "title": "T",\n    "styles": ["a.css", "b.css"],\n    "compatibility": { "minimum": "14", "verified": "14" }\n}',
    );
    expect(r?.changes).toHaveLength(3);
  });

  it('keeps tabs, a numeric minimum, and a missing trailing newline', () => {
    const raw =
      '{\n\t"id": "m",\n\t"compatibility": {\n\t\t"minimum": 13.336,\n\t\t"verified": 14\n\t}\n}';
    const r = transformManifest(raw, 'module');
    expect(r?.output).toBe(
      '{\n\t"id": "m",\n\t"type": "module",\n\t"compatibility": {\n\t\t"minimum": "14",\n\t\t"verified": 14\n\t}\n}',
    );
  });

  it('leaves a v14 manifest alone and notes a maximum below 14', () => {
    expect(
      transformManifest(
        '{"id":"m","type":"module","compatibility":{"minimum":"14","verified":"14"}}',
        'module',
      ),
    ).toBeNull();
    const r = transformManifest(
      '{"id":"m","type":"module","compatibility":{"minimum":"14","verified":"14","maximum":"13"}}',
      'module',
    );
    expect(r?.changes).toEqual([]);
    expect(r?.notes[0]?.message).toContain('maximum');
  });
});

describe('comments are left alone', () => {
  it('rewrites the code and not the prose that mentions it', () => {
    const src = [
      '/**',
      ' * flattenObject({ system: actor.system }) // → { system: CharacterData }',
      ' */',
      "// '-=system.bio': null used to work",
      'const m = mergeObject(a, b); // not Math.clamped(x)',
      "await a.update({ '-=system.bio': null });",
      '',
    ].join('\n');
    const r = transformSource(src);
    expect(r.output).toBe(
      [
        '/**',
        ' * flattenObject({ system: actor.system }) // → { system: CharacterData }',
        ' */',
        "// '-=system.bio': null used to work",
        'const m = foundry.utils.mergeObject(a, b); // not Math.clamped(x)',
        "await a.update({ 'system.bio': _del });",
        '',
      ].join('\n'),
    );
    expect(r.changes.map((c) => c.line)).toEqual([5, 6]);
  });

  it('renames menu keys only outside comments inside the entry', () => {
    const src =
      'options.push({\n  // name: is the old key\n  name: "x",\n  icon: "i",\n  callback: () => 1,\n});\n';
    const r = contextMenuKeys(src);
    expect(r.output).toContain('  // name: is the old key');
    expect(r.output).toContain('  label: "x",');
    expect(r.output).toContain('  onClick: () => 1,');
  });
});

describe('the whole pipeline', () => {
  it('leaves a v14 file untouched', () => {
    const src =
      "import { registerSystem } from '@vttforge/core';\nregisterSystem({ id: 'x', statusEffects: [{ id: 'x.dazed' }] });\nawait a.update({ 'system.old': _del });\nawait roll.toMessage({}, { messageMode: 'gm' });\n";
    const r = transformSource(src);
    expect(r.output).toBe(src);
    expect(r.changes).toEqual([]);
    expect(r.notes).toEqual([]);
  });
});

describe('hook notes', () => {
  it('notes renderChatMessage and changes nothing', () => {
    const src = 'Hooks.on("renderChatMessage", (m, html) => html.find("a"));\n';
    const r = hookNotes(src);
    expect(r.output).toBe(src);
    expect(r.changes).toEqual([]);
    expect(r.notes[0]?.message).toContain('renderChatMessageHTML');
  });
});
