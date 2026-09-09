/**
 * Source rules for the v13 code that v14 broke or deprecated.
 *
 *   VTTF-AUDIT-011 (HIGH)  : a bare utility global v14 removed (`mergeObject(`, ...)
 *   VTTF-AUDIT-012 (MEDIUM): `-=` / `==` update keys, replaced by data operators
 *   VTTF-AUDIT-013 (MEDIUM): `rollMode`, replaced by `messageMode`
 *   VTTF-AUDIT-014 (MEDIUM): `CONFIG.statusEffects = [...]`, which empties the collection first
 *   VTTF-AUDIT-015 (MEDIUM): `legacyTransferral`, a flag v14 no longer reads
 *   VTTF-AUDIT-016 (MEDIUM): numeric Active Effect modes, replaced by string change types
 *
 * Regex heuristics like the rest of the source rules, for the same reason:
 * the patterns are short and a TypeScript AST would not make them more
 * precise. Comments are blanked first, so prose that mentions a call is not
 * a finding. Each rule reports the first match per file; one finding is
 * enough to send the reader to the file, and the fix is a search-and-replace
 * there.
 */

import { readFile } from 'node:fs/promises';
import { maskComments } from './mask.js';
import { _internal } from './source-rules.js';
import type { RuleResult } from './types.js';

/**
 * VTTF-AUDIT-011 (HIGH): a bare utility global v14 removed.
 *
 * v13 kept the v12-era globals (`mergeObject`, `getProperty`, ...) as
 * deprecation shims over `foundry.utils`. v14 removed the shims, so a bare
 * call throws `ReferenceError` the first time it runs, which for a helper
 * called from a sheet or a migration means a feature that dies on click.
 *
 * Only names with no plausible user-land meaning are listed: `duplicate`
 * and `debounce` are left out because a project can define its own.
 */
export const REMOVED_UTILS = [
  'mergeObject',
  'getProperty',
  'setProperty',
  'hasProperty',
  'deepClone',
  'expandObject',
  'flattenObject',
  'diffObject',
  'isNewerVersion',
  'randomID',
] as const;

interface RemovedGlobal {
  readonly name: string;
  readonly pattern: RegExp;
  readonly replacement: string;
}

const REMOVED_GLOBALS: readonly RemovedGlobal[] = [
  ...REMOVED_UTILS.map((name) => ({
    name,
    pattern: new RegExp(`(?<![\\w$.])${name}\\s*\\(`),
    replacement: `\`foundry.utils.${name}\``,
  })),
  { name: 'Math.clamped', pattern: /\bMath\.clamped\s*\(/, replacement: '`Math.clamp`' },
  {
    name: 'game.template',
    pattern: /\bgame\.template\b/,
    replacement: '`game.model` or the `documentTypes` on the package',
  },
];

/**
 * A file that declares, imports, or defines the name as a method (a test
 * mock's `utils: { mergeObject(a, b) {...} }`) is using its own, not
 * Foundry's. The method-shorthand alternative uses `[^)]*` (no nested
 * parens) to avoid a false positive on call-sites inside conditional blocks
 * like `if (hasProperty(obj, 'key')) {`, where a lazy `[\s\S]*?` would
 * backtrack through the outer `)` and match the block brace.
 */
function definesItself(content: string, name: string): boolean {
  return new RegExp(
    `(?:function\\s+${name}\\b|(?:const|let|var)\\s+${name}\\b|import[^;]*\\b${name}\\b|\\b${name}\\s*\\([^)]*\\)\\s*\\{)`,
  ).test(content);
}

function rule011(filePath: string, content: string): RuleResult[] {
  // Each removed name is checked on its own, so a file that wraps one of
  // them in a helper of the same name still gets its other hits reported.
  const hits = REMOVED_GLOBALS.flatMap((global) => {
    const idx = content.search(global.pattern);
    if (idx < 0) return [];
    if (
      REMOVED_UTILS.includes(global.name as (typeof REMOVED_UTILS)[number]) &&
      definesItself(content, global.name)
    ) {
      return [];
    }
    return [{ global, idx }];
  });
  const first = hits.sort((a, b) => a.idx - b.idx)[0];
  if (first === undefined) return [];

  return [
    {
      ruleId: 'VTTF-AUDIT-011',
      title: 'A global v14 removed',
      severity: 'HIGH',
      filePath,
      line: _internal.lineOf(content, first.global.pattern),
      message: `\`${first.global.name}\` was a v12 shim that v13 kept and v14 removed. The call throws ReferenceError the first time it runs.`,
      remediation: `Use ${first.global.replacement}.`,
    },
  ];
}

/**
 * VTTF-AUDIT-012 (MEDIUM): `-=` / `==` update keys.
 *
 * Deprecated since v14, removed in v16. The replacement is a data operator:
 * `{ "system.old": _del }` and `{ "system.stats": _replace({...}) }`, or the
 * classes under `foundry.data.operators`.
 */
function rule012(filePath: string, content: string): RuleResult[] {
  const pattern = /['"`](?:[\w$]+\.)*(?:-=|==)[\w$]/;
  if (!pattern.test(content)) return [];
  return [
    {
      ruleId: 'VTTF-AUDIT-012',
      title: 'Update key uses the -= / == prefix',
      severity: 'MEDIUM',
      filePath,
      line: _internal.lineOf(content, pattern),
      message:
        'The `-=key` and `==key` update syntax is deprecated since v14 and removed in v16. Foundry warns on every write that uses it.',
      remediation:
        'Delete with `{ "path.to.key": _del }` and replace with `{ "path.to.key": _replace(value) }`, or use `foundry.data.operators.ForcedDeletion` / `ForcedReplacement`. `mergeObject` takes `{ applyOperators: true }` where it took `{ performDeletions: true }`.',
    },
  ];
}

/**
 * VTTF-AUDIT-013 (MEDIUM): `rollMode`.
 *
 * v14 renamed the option to `messageMode`, moved the user default to the
 * `core.messageMode` setting, and made `CONFIG.Dice.rollModes` and
 * `CONST.DICE_ROLL_MODES` deprecation proxies over `CONFIG.ChatMessage.modes`.
 * The old names warn until v16.
 */
function rule013(filePath: string, content: string): RuleResult[] {
  const pattern = /\brollMode\s*:|['"]rollMode['"]|CONFIG\.Dice\.rollModes|DICE_ROLL_MODES/;
  if (!pattern.test(content)) return [];
  return [
    {
      ruleId: 'VTTF-AUDIT-013',
      title: 'rollMode is deprecated in favour of messageMode',
      severity: 'MEDIUM',
      filePath,
      line: _internal.lineOf(content, pattern),
      message:
        'The `rollMode` option, the `core.rollMode` setting, `CONFIG.Dice.rollModes` and `CONST.DICE_ROLL_MODES` are deprecated since v14 and removed in v16.',
      remediation:
        'Pass `{ messageMode }` (a key of `CONFIG.ChatMessage.modes`: public, gm, blind, self, ic) to `Roll#toMessage` and `ChatMessage.create`; read the user default from `game.settings.get("core", "messageMode")`; map an old value with `Roll._mapLegacyRollMode`.',
    },
  ];
}

/**
 * VTTF-AUDIT-014 (MEDIUM): `CONFIG.statusEffects = [...]`.
 *
 * v14 keys the collection by id. Assigning a whole array still works, but
 * the setter empties the collection first, so every condition another
 * package added earlier in `init` is gone, with no warning.
 */
function rule014(filePath: string, content: string): RuleResult[] {
  const pattern = /CONFIG\.statusEffects\s*=[^=]/;
  if (!pattern.test(content)) return [];
  return [
    {
      ruleId: 'VTTF-AUDIT-014',
      title: 'CONFIG.statusEffects is assigned wholesale',
      severity: 'MEDIUM',
      filePath,
      line: _internal.lineOf(content, pattern),
      message:
        'Assigning an array to `CONFIG.statusEffects` empties the collection first, which drops the conditions other packages added before this code ran. v14 deprecates the assignment.',
      remediation:
        'Add and remove by id: `CONFIG.statusEffects["my-id"] = { id: "my-id", name, img }` and `delete CONFIG.statusEffects.dead`. `registerSystem` and `registerModule` do this for the `statusEffects` option.',
    },
  ];
}

/**
 * VTTF-AUDIT-015 (MEDIUM): `legacyTransferral`.
 *
 * v14 removed the flag. Effects on owned Items with `transfer: true` apply
 * to the Actor in place; nothing is copied. Setting the flag does nothing,
 * and code that reasons about copied effects reasons about the wrong model.
 */
function rule015(filePath: string, content: string): RuleResult[] {
  const pattern = /\blegacyTransferral\b/;
  if (!pattern.test(content)) return [];
  return [
    {
      ruleId: 'VTTF-AUDIT-015',
      title: 'legacyTransferral no longer exists',
      severity: 'MEDIUM',
      filePath,
      line: _internal.lineOf(content, pattern),
      message:
        '`CONFIG.ActiveEffect.legacyTransferral` was removed in v14. Item effects with `transfer: true` apply to the Actor in place through `allApplicableEffects()`; the flag is ignored.',
      remediation:
        'Delete the assignment. If the code relied on effects being copied onto the Actor, iterate `actor.allApplicableEffects()` instead of `actor.effects`.',
    },
  ];
}

/**
 * VTTF-AUDIT-016 (MEDIUM): numeric Active Effect modes.
 *
 * v14 moved `changes` to `system.changes` and replaced the numeric `mode`
 * with a string `type` (`add`, `multiply`, `override`, `upgrade`,
 * `downgrade`, `subtract`, `custom`). The old shape loads through a
 * migration shim that warns until v16.
 */
function rule016(filePath: string, content: string): RuleResult[] {
  const pattern = /\bACTIVE_EFFECT_MODES\b/;
  if (!pattern.test(content)) return [];
  return [
    {
      ruleId: 'VTTF-AUDIT-016',
      title: 'Active Effect changes use numeric modes',
      severity: 'MEDIUM',
      filePath,
      line: _internal.lineOf(content, pattern),
      message:
        '`CONST.ACTIVE_EFFECT_MODES` and a numeric `mode` on a change are deprecated since v14 and removed in v16. Changes live in `system.changes` with a string `type`.',
      remediation:
        'Write `{ key, type: "add", value }` under `system.changes`; register extra types in `CONFIG.ActiveEffect.changeTypes`.',
    },
  ];
}

export async function runV14Rules(cwd: string): Promise<RuleResult[]> {
  const results: RuleResult[] = [];
  for await (const file of _internal.walkSourceFiles(cwd)) {
    let content: string;
    try {
      content = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    // Comments are blanked before matching, so a call quoted in a JSDoc
    // block or a `// TODO: drop mergeObject(` line is not a finding. The
    // mask keeps every offset, so the line numbers still point at the file.
    content = maskComments(content);
    results.push(
      ...rule011(file, content),
      ...rule012(file, content),
      ...rule013(file, content),
      ...rule014(file, content),
      ...rule015(file, content),
      ...rule016(file, content),
    );
  }
  return results;
}
