/**
 * Table dice: the step ladder, the pool, and counting.
 *
 * Foundry's `Roll` parses the modifiers a table game needs (`kh`, `kl`, `dh`,
 * `dl`, `cs`, `df`, `x`, `r`, `min`, `max`), so what a system writes by hand
 * is the formula string and the reading of the results. These helpers write
 * the formula from a description, step a die up and down a ladder, and count
 * successes on any evaluated roll.
 *
 * ```ts
 * stepDie(6, 1);                       // 8
 * dicePool({ number: 5, faces: 6, successAt: 5 });        // '5d6cs>=5'
 * dicePool({ number: 2, faces: 20, keep: { highest: 1 } }); // '2d20kh1'
 * countSuccesses(roll, 5);             // { successes, failures, net }
 * ```
 */

import { VttfError } from './errors/registry.js';

/** The faces a die can step through, low to high. The common ladder. */
export const DEFAULT_DIE_LADDER: readonly number[] = [4, 6, 8, 10, 12];

/**
 * Step a die up (`steps > 0`) or down (`steps < 0`) a ladder of faces, and
 * stay on the ends: a d12 stepped up on the default ladder is still a d12.
 *
 * `faces` must be on the ladder; anything else is refused with VTTF-0011.
 */
export function stepDie(
  faces: number,
  steps: number,
  ladder: readonly number[] = DEFAULT_DIE_LADDER,
): number {
  if (!Number.isInteger(steps)) {
    throw new VttfError('VTTF-0011', `stepDie(): steps must be a whole number, got ${steps}.`);
  }
  const index = ladder.indexOf(faces);
  if (index < 0) {
    throw new VttfError(
      'VTTF-0011',
      `stepDie(): d${faces} is not on the ladder [${ladder.map((f) => `d${f}`).join(', ')}].`,
    );
  }
  const next = Math.min(ladder.length - 1, Math.max(0, index + steps));
  return ladder[next] as number;
}

export interface DicePoolSpec {
  /** How many dice. */
  readonly number: number;
  /** Faces per die. */
  readonly faces: number;
  /** Keep only the highest or lowest `n` (at most `number`), as `kh` / `kl`. */
  readonly keep?: { readonly highest: number } | { readonly lowest: number };
  /** Drop the highest or lowest `n` (at most `number`), as `dh` / `dl`. */
  readonly drop?: { readonly highest: number } | { readonly lowest: number };
  /** Count a die as a success at this result or above, as `cs>=n`. The total becomes the count. */
  readonly successAt?: number;
  /** Count a die as a failure at this result or below, as `df<=n`: each one takes 1 off the total. */
  readonly failAt?: number;
  /** Roll again on the highest face (`true`) or at this result or above (a number), as `x`. */
  readonly explode?: boolean | number;
  /** Reroll once at this result or below, as `r<=n`. */
  readonly rerollAt?: number;
  /** Floor and ceiling for each die, as `min` / `max`. */
  readonly min?: number;
  readonly max?: number;
}

function assertWhole(name: string, value: number, atLeast: number, atMost?: number): void {
  if (!Number.isInteger(value) || value < atLeast || (atMost !== undefined && value > atMost)) {
    const range = atMost === undefined ? `of at least ${atLeast}` : `from ${atLeast} to ${atMost}`;
    throw new VttfError(
      'VTTF-0011',
      `dicePool(): ${name} must be a whole number ${range}, got ${value}.`,
    );
  }
}

/**
 * The formula for a pool, using the modifiers Foundry's `Die` documents. The
 * order is the one Foundry applies them in: reroll, explode, floor and
 * ceiling, keep or drop, then counting.
 */
export function dicePool(spec: DicePoolSpec): string {
  assertWhole('number', spec.number, 1);
  assertWhole('faces', spec.faces, 2);
  if (spec.keep && spec.drop) {
    throw new VttfError('VTTF-0011', 'dicePool(): give keep or drop, not both.');
  }
  let formula = `${spec.number}d${spec.faces}`;
  if (spec.rerollAt !== undefined) formula += `r<=${spec.rerollAt}`;
  if (spec.explode === true) formula += 'x';
  else if (typeof spec.explode === 'number') formula += `x>=${spec.explode}`;
  if (spec.min !== undefined) formula += `min${spec.min}`;
  if (spec.max !== undefined) formula += `max${spec.max}`;
  if (spec.keep) {
    if ('highest' in spec.keep) {
      assertWhole('keep.highest', spec.keep.highest, 1, spec.number);
      formula += `kh${spec.keep.highest}`;
    } else {
      assertWhole('keep.lowest', spec.keep.lowest, 1, spec.number);
      formula += `kl${spec.keep.lowest}`;
    }
  }
  if (spec.drop) {
    if ('highest' in spec.drop) {
      assertWhole('drop.highest', spec.drop.highest, 1, spec.number);
      formula += `dh${spec.drop.highest}`;
    } else {
      assertWhole('drop.lowest', spec.drop.lowest, 1, spec.number);
      formula += `dl${spec.drop.lowest}`;
    }
  }
  if (spec.successAt !== undefined) formula += `cs>=${spec.successAt}`;
  if (spec.failAt !== undefined) formula += `df<=${spec.failAt}`;
  return formula;
}

/** The parts of an evaluated `foundry.dice.Roll` the counting reads. */
export interface CountableRoll {
  readonly dice?: ReadonlyArray<{
    readonly results?: ReadonlyArray<{ readonly result: number; readonly active?: boolean }>;
  }>;
}

export interface SuccessCount {
  /** Active dice at `target` or above. */
  readonly successes: number;
  /** Active dice at `failAt` or below; `0` when `failAt` is not given. */
  readonly failures: number;
  /** `successes - failures`. */
  readonly net: number;
  /** Every active result, in order. */
  readonly results: readonly number[];
}

/**
 * Count successes on any evaluated roll, from the active results of every
 * die term. Independent of the formula, so it works on a plain `5d6` as well
 * as on a pool built with `cs`.
 */
export function countSuccesses(
  roll: CountableRoll,
  target: number,
  options: { readonly failAt?: number } = {},
): SuccessCount {
  const results: number[] = [];
  for (const die of roll.dice ?? []) {
    for (const result of die.results ?? []) {
      if (result.active !== false) results.push(result.result);
    }
  }
  let successes = 0;
  let failures = 0;
  for (const value of results) {
    if (value >= target) successes += 1;
    if (options.failAt !== undefined && value <= options.failAt) failures += 1;
  }
  return { successes, failures, net: successes - failures, results };
}
