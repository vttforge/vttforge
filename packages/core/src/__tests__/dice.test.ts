import { describe, expect, it } from 'vitest';
import { countSuccesses, DEFAULT_DIE_LADDER, dicePool, stepDie } from '../dice.js';
import { VttfError } from '../errors/registry.js';

describe('stepDie', () => {
  it('walks the ladder and stays on its ends', () => {
    expect(DEFAULT_DIE_LADDER).toEqual([4, 6, 8, 10, 12]);
    expect(stepDie(6, 1)).toBe(8);
    expect(stepDie(6, -1)).toBe(4);
    expect(stepDie(6, 0)).toBe(6);
    expect(stepDie(12, 3)).toBe(12);
    expect(stepDie(4, -2)).toBe(4);
    expect(stepDie(8, 2, [4, 6, 8, 10, 12, 20])).toBe(12);
  });

  it('refuses a die off the ladder and a fractional step', () => {
    expect(() => stepDie(7, 1)).toThrow(VttfError);
    expect(() => stepDie(7, 1)).toThrow(/VTTF-0011/);
    expect(() => stepDie(6, 0.5)).toThrow(/whole number/);
  });
});

describe('dicePool', () => {
  it('writes the modifiers in the order Foundry applies them', () => {
    expect(dicePool({ number: 5, faces: 6 })).toBe('5d6');
    expect(dicePool({ number: 5, faces: 6, successAt: 5 })).toBe('5d6cs>=5');
    expect(dicePool({ number: 5, faces: 6, successAt: 5, failAt: 1 })).toBe('5d6cs>=5df<=1');
    expect(dicePool({ number: 2, faces: 20, keep: { highest: 1 } })).toBe('2d20kh1');
    expect(dicePool({ number: 2, faces: 20, keep: { lowest: 1 } })).toBe('2d20kl1');
    expect(dicePool({ number: 4, faces: 6, drop: { lowest: 1 } })).toBe('4d6dl1');
    expect(dicePool({ number: 4, faces: 6, drop: { highest: 1 } })).toBe('4d6dh1');
    expect(dicePool({ number: 3, faces: 6, explode: true })).toBe('3d6x');
    expect(dicePool({ number: 3, faces: 6, explode: 5 })).toBe('3d6x>=5');
    expect(dicePool({ number: 3, faces: 6, rerollAt: 1, min: 2, max: 5 })).toBe('3d6r<=1min2max5');
    expect(
      dicePool({
        number: 6,
        faces: 10,
        rerollAt: 1,
        explode: true,
        keep: { highest: 3 },
        successAt: 8,
      }),
    ).toBe('6d10r<=1xkh3cs>=8');
  });

  it('refuses bad counts and keep with drop', () => {
    expect(() => dicePool({ number: 0, faces: 6 })).toThrow(/VTTF-0011/);
    expect(() => dicePool({ number: 1, faces: 1 })).toThrow(/faces/);
    expect(() => dicePool({ number: 2, faces: 6, keep: { highest: 0 } })).toThrow(/keep.highest/);
    expect(() =>
      dicePool({ number: 2, faces: 6, keep: { highest: 1 }, drop: { lowest: 1 } }),
    ).toThrow(/not both/);
  });
});

describe('countSuccesses', () => {
  const roll = {
    dice: [
      {
        results: [
          { result: 6, active: true },
          { result: 1, active: true },
          { result: 5, active: false },
        ],
      },
      { results: [{ result: 5 }, { result: 3 }] },
    ],
  };

  it('counts active results at the target or above, across every die', () => {
    expect(countSuccesses(roll, 5)).toEqual({
      successes: 2,
      failures: 0,
      net: 2,
      results: [6, 1, 5, 3],
    });
  });

  it('subtracts failures at or below failAt', () => {
    expect(countSuccesses(roll, 5, { failAt: 1 })).toMatchObject({
      successes: 2,
      failures: 1,
      net: 1,
    });
  });

  it('is empty for a roll without dice', () => {
    expect(countSuccesses({}, 5)).toEqual({ successes: 0, failures: 0, net: 0, results: [] });
  });
});
