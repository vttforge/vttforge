import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { naturalResult, type PostableRoll, postRoll, rollOutcome } from '../chat.js';

const create = vi.fn(async (data: Record<string, unknown>, _options?: Record<string, unknown>) => ({
  id: 'm1',
  ...data,
}));
const getSpeaker = vi.fn((options?: { actor?: object }) => ({ actor: options?.actor ?? null }));

beforeEach(() => {
  create.mockClear();
  getSpeaker.mockClear();
  (globalThis as Record<string, unknown>).CONFIG = {
    ChatMessage: { documentClass: { create, getSpeaker } },
    sounds: { dice: 'sounds/dice.wav' },
  };
  (globalThis as Record<string, unknown>).game = {
    system: { id: 'my-system' },
    i18n: { localize: (key: string) => (key === 'X.Crit' ? 'Natural twenty' : key) },
  };
});

afterEach(() => {
  (globalThis as Record<string, unknown>).CONFIG = undefined;
  (globalThis as Record<string, unknown>).game = undefined;
});

function fakeRoll(
  results: number[],
  faces = 20,
  evaluated = true,
): PostableRoll & { evaluate: ReturnType<typeof vi.fn> } {
  const roll = {
    _evaluated: evaluated,
    evaluate: vi.fn(async () => {
      roll._evaluated = true;
      return roll;
    }),
    render: async () => '<div class="dice-roll">rendered</div>',
    dice: [{ faces, results: results.map((result, i) => ({ result, active: i === 0 })) }],
    total: results[0],
  };
  return roll;
}

describe('rollOutcome', () => {
  it('reads the first active result of the first die', () => {
    expect(naturalResult(fakeRoll([7, 20]))).toBe(7);
    expect(naturalResult({ evaluate: async () => {}, render: async () => '' })).toBeUndefined();
  });

  it('decides nothing unless asked', () => {
    expect(rollOutcome(fakeRoll([20]))).toEqual({ natural: 20, crit: false, fumble: false });
  });

  it('takes true as the die edges, a number as a threshold, a function as is', () => {
    expect(rollOutcome(fakeRoll([20]), { crit: true, fumble: true }).crit).toBe(true);
    expect(rollOutcome(fakeRoll([1]), { crit: true, fumble: true }).fumble).toBe(true);
    expect(rollOutcome(fakeRoll([6], 6), { crit: true }).crit).toBe(true);
    expect(rollOutcome(fakeRoll([19]), { crit: 19 }).crit).toBe(true);
    expect(rollOutcome(fakeRoll([18]), { crit: 19 }).crit).toBe(false);
    expect(rollOutcome(fakeRoll([2]), { fumble: 2 }).fumble).toBe(true);
    const total = (roll: PostableRoll) => (roll.total ?? 0) >= 15;
    expect(rollOutcome(fakeRoll([15]), { crit: total }).crit).toBe(true);
  });

  it('never marks both; the critical wins', () => {
    const outcome = rollOutcome(fakeRoll([10]), { crit: 5, fumble: 15 });
    expect(outcome).toEqual({ natural: 10, crit: true, fumble: false });
  });
});

describe('postRoll', () => {
  it('evaluates an unevaluated roll once and creates the message', async () => {
    const roll = fakeRoll([12], 20, false);
    const { message, outcome } = await postRoll(roll, { actor: { id: 'a1' }, flavor: 'Str' });
    expect(roll.evaluate).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ natural: 12, crit: false, fumble: false });
    expect(getSpeaker).toHaveBeenCalledWith({ actor: { id: 'a1' } });
    expect(create).toHaveBeenCalledTimes(1);
    const [data, options] = create.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(data.rolls).toEqual([roll]);
    expect(data.flavor).toBe('Str');
    expect(data.sound).toBe('sounds/dice.wav');
    expect(data.speaker).toEqual({ actor: { id: 'a1' } });
    expect(data.content).toBe(
      '<div class="vttf-roll" data-vttforge-roll="plain"><div class="dice-roll">rendered</div></div>',
    );
    expect(data.flags).toEqual({ 'my-system': { vttforge: { roll: outcome } } });
    expect(options).toEqual({});
    expect(message).toMatchObject({ id: 'm1' });
  });

  it('does not evaluate twice, keeps the given speaker, and passes the mode and flags', async () => {
    const roll = fakeRoll([20]);
    await postRoll(roll, {
      speaker: { alias: 'Narrator' },
      crit: 20,
      labels: { crit: 'X.Crit' },
      messageMode: 'gm',
      scope: 'my-module',
      flags: { 'my-module': { a: 1 }, other: { b: 2 } },
    });
    expect(roll.evaluate).not.toHaveBeenCalled();
    expect(getSpeaker).not.toHaveBeenCalled();
    const [data, options] = create.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(data.speaker).toEqual({ alias: 'Narrator' });
    expect(data.content).toContain('class="vttf-roll vttf-roll--crit" data-vttforge-roll="crit"');
    expect(data.content).toContain('<span class="vttf-roll__tag">Natural twenty</span>');
    expect(data.flags).toEqual({
      'my-module': { a: 1, vttforge: { roll: { natural: 20, crit: true, fumble: false } } },
      other: { b: 2 },
    });
    expect(options).toEqual({ messageMode: 'gm' });
  });

  it('tags a fumble and escapes the label', async () => {
    await postRoll(fakeRoll([1]), { fumble: true, labels: { fumble: '<b>' } });
    const [data] = create.mock.calls[0] as [Record<string, unknown>];
    expect(data.content).toContain('vttf-roll--fumble');
    expect(data.content).toContain('<span class="vttf-roll__tag">&lt;b&gt;</span>');
  });

  it('fails plainly outside Foundry', async () => {
    (globalThis as Record<string, unknown>).game = undefined;
    await expect(postRoll(fakeRoll([1]))).rejects.toThrow(/needs a flag scope/);
    (globalThis as Record<string, unknown>).CONFIG = undefined;
    await expect(postRoll(fakeRoll([1]))).rejects.toThrow(/CONFIG\.ChatMessage\.documentClass/);
  });
});
