/**
 * Each rewrite `vttforge migrate` makes, and each thing it refuses to decide.
 */
import { describe, expect, it } from 'vitest';
import {
  activeEffectModes,
  contextMenuKeys,
  dataOperators,
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

  it('turns "roll" into undefined, and notes an expression', () => {
    const r = rollMode('a({ rollMode: "roll" });\nb({ rollMode: chosen });\n');
    expect(r.output).toBe('a({ messageMode: undefined });\nb({ messageMode: chosen });\n');
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]).toMatchObject({ line: 2 });
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
  it('declares the type next to the id and raises compatibility to 14', () => {
    const r = transformManifest(
      '{\n  "id": "my-system",\n  "title": "T",\n  "compatibility": { "minimum": "13", "verified": "13.341" }\n}\n',
      'system',
    );
    expect(r).not.toBeNull();
    const parsed = JSON.parse(r?.output ?? '{}');
    expect(Object.keys(parsed).slice(0, 3)).toEqual(['id', 'type', 'title']);
    expect(parsed.compatibility).toEqual({ minimum: '14', verified: '14' });
    expect(r?.changes).toHaveLength(3);
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
