/**
 * Posting a roll to chat.
 *
 * `Roll#toMessage` posts a roll; that part is one call. What every system then
 * writes around it is the same: check the first die for a natural high or
 * low, mark the message so the card and later hooks can tell, and put a
 * result line above Foundry's dice block. `postRoll` is that once.
 *
 * The card is Foundry's own rendering of the roll, wrapped in a `div` with
 * classes the styles package (and any system CSS) can pick up:
 *
 * ```html
 * <div class="vttf-roll vttf-roll--crit" data-vttforge-roll="crit">
 *   <span class="vttf-roll__tag">Critical</span>
 *   <div class="dice-roll">…</div>
 * </div>
 * ```
 *
 * The result also lands in the message flags, as `vttforge.roll` under the
 * package's own scope (the system id unless `scope` says otherwise), so a hook
 * can read it back with `message.getFlag(game.system.id, 'vttforge.roll')`
 * without parsing the formula again. Foundry only reads flags whose scope is
 * a package id, which is why the outcome is not filed under `vttforge`.
 */

import { escapeHtml, localize } from './text.js';

/** How to decide a critical or a fumble. */
export type RollThreshold = boolean | number | ((roll: PostableRoll) => boolean);

/** The parts of `foundry.dice.Roll` that `postRoll` reads. */
export interface PostableRoll {
  readonly _evaluated?: boolean;
  evaluate(options?: Record<string, unknown>): Promise<unknown>;
  render(options?: { flavor?: string; isPrivate?: boolean }): Promise<string>;
  readonly dice?: ReadonlyArray<{
    readonly faces?: number;
    readonly results?: ReadonlyArray<{ readonly result: number; readonly active?: boolean }>;
  }>;
  readonly total?: number;
}

export interface PostRollOptions {
  /** The actor speaking. Ignored when `speaker` is given. */
  readonly actor?: object;
  /** A ready speaker, as `ChatMessage.getSpeaker()` returns it. */
  readonly speaker?: object;
  /** Text shown in the message header, above the card. */
  readonly flavor?: string;
  /**
   * When the roll is a critical. `true` means the first die shows its highest
   * face; a number means the natural result is at least that; a function
   * decides for itself. Left out, no roll is a critical.
   */
  readonly crit?: RollThreshold;
  /**
   * When the roll is a fumble. `true` means the first die shows a 1; a number
   * means the natural result is at most that; a function decides for itself.
   * Left out, no roll is a fumble.
   */
  readonly fumble?: RollThreshold;
  /**
   * The words on the card for each outcome, as localization keys or plain
   * text. Defaults: `'Critical'` and `'Fumble'`.
   */
  readonly labels?: { readonly crit?: string; readonly fumble?: string };
  /**
   * A key of `CONFIG.ChatMessage.modes`: `public`, `gm`, `blind`, `self` or
   * `ic`. Left out, the user's chat setting applies.
   */
  readonly messageMode?: string;
  /**
   * The flag scope the outcome is stored under: your system or module id.
   * Default: `game.system.id`.
   */
  readonly scope?: string;
  /** Extra flags for the message, merged before the outcome is added. */
  readonly flags?: Record<string, unknown>;
}

/** What `postRoll` decided, also stored in the message flags. */
export interface RollOutcome {
  /** The first active result of the first die, or `undefined` without dice. */
  readonly natural: number | undefined;
  readonly crit: boolean;
  readonly fumble: boolean;
}

/** Root class of the card; `--crit` or `--fumble` is added for the outcome. */
export const ROLL_CARD_CLASS = 'vttf-roll';

interface ChatMessageClass {
  create(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>;
  getSpeaker(options?: { actor?: object }): object;
}

function chatMessageClass(): ChatMessageClass {
  const config = (globalThis as Record<string, unknown>).CONFIG as
    | { ChatMessage?: { documentClass?: ChatMessageClass } }
    | undefined;
  const cls = config?.ChatMessage?.documentClass;
  if (!cls) {
    throw new Error(
      'CONFIG.ChatMessage.documentClass is not available. Call postRoll() inside a Foundry runtime or stub CONFIG in tests',
    );
  }
  return cls;
}

function diceSound(): string | undefined {
  const config = (globalThis as Record<string, unknown>).CONFIG as
    | { sounds?: { dice?: string } }
    | undefined;
  return config?.sounds?.dice;
}

function systemId(): string | undefined {
  const game = (globalThis as Record<string, unknown>).game as
    | { system?: { id?: string } }
    | undefined;
  return game?.system?.id;
}

/** The first active result of the first die term. */
export function naturalResult(roll: PostableRoll): number | undefined {
  const die = roll.dice?.[0];
  return die?.results?.find((result) => result.active !== false)?.result;
}

function decide(
  roll: PostableRoll,
  threshold: RollThreshold | undefined,
  edge: 'high' | 'low',
): boolean {
  if (threshold === undefined || threshold === false) return false;
  if (typeof threshold === 'function') return threshold(roll);
  const natural = naturalResult(roll);
  if (natural === undefined) return false;
  if (threshold === true) {
    const faces = roll.dice?.[0]?.faces;
    return edge === 'high' ? faces !== undefined && natural >= faces : natural <= 1;
  }
  return edge === 'high' ? natural >= threshold : natural <= threshold;
}

/** The outcome of a roll under the given thresholds, without posting it. */
export function rollOutcome(
  roll: PostableRoll,
  options: Pick<PostRollOptions, 'crit' | 'fumble'> = {},
): RollOutcome {
  const crit = decide(roll, options.crit, 'high');
  // A roll is never both; the critical wins when the thresholds overlap.
  const fumble = !crit && decide(roll, options.fumble, 'low');
  return { natural: naturalResult(roll), crit, fumble };
}

/**
 * Evaluate the roll if it has not been, and post it as a chat card.
 *
 * ```js
 * const roll = new foundry.dice.Roll('1d20 + @str.mod', actor.getRollData());
 * await postRoll(roll, { actor, flavor: 'Strength check', crit: 20, fumble: 1 });
 * ```
 *
 * Returns the created message and the outcome it was tagged with.
 */
export async function postRoll(
  roll: PostableRoll,
  options: PostRollOptions = {},
): Promise<{ message: unknown; outcome: RollOutcome }> {
  if (!roll._evaluated) await roll.evaluate();
  const outcome = rollOutcome(roll, options);
  const ChatMessage = chatMessageClass();

  const classes = [ROLL_CARD_CLASS];
  let tag = '';
  if (outcome.crit) {
    classes.push(`${ROLL_CARD_CLASS}--crit`);
    tag = localize(options.labels?.crit ?? 'Critical');
  } else if (outcome.fumble) {
    classes.push(`${ROLL_CARD_CLASS}--fumble`);
    tag = localize(options.labels?.fumble ?? 'Fumble');
  }
  const kind = outcome.crit ? 'crit' : outcome.fumble ? 'fumble' : 'plain';
  const content =
    `<div class="${classes.join(' ')}" data-vttforge-roll="${kind}">` +
    (tag ? `<span class="${ROLL_CARD_CLASS}__tag">${escapeHtml(tag)}</span>` : '') +
    (await roll.render()) +
    '</div>';

  const scope = options.scope ?? systemId();
  if (scope === undefined) {
    throw new Error(
      'postRoll() needs a flag scope: pass `scope` (your system or module id) when game.system is not available',
    );
  }
  // Merge into whatever the caller already put under the scope, including
  // its own `vttforge` keys; only `vttforge.roll` is ours.
  const scoped = (options.flags?.[scope] ?? {}) as Record<string, unknown>;
  const ours = (scoped.vttforge ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = {
    content,
    rolls: [roll],
    speaker: options.speaker ?? ChatMessage.getSpeaker({ actor: options.actor }),
    flags: {
      ...options.flags,
      [scope]: { ...scoped, vttforge: { ...ours, roll: outcome } },
    },
  };
  if (options.flavor !== undefined) data.flavor = options.flavor;
  const sound = diceSound();
  if (sound !== undefined) data.sound = sound;

  const createOptions: Record<string, unknown> = {};
  if (options.messageMode !== undefined) createOptions.messageMode = options.messageMode;
  const message = await ChatMessage.create(data, createOptions);
  return { message, outcome };
}
