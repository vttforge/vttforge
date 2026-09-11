# Rolls

`postRoll()` posts a roll to chat as a card. It evaluates the roll if you have not, decides whether the first die came up a critical or a fumble, tags the card and the message flags with the outcome, and hands the rest to Foundry.

```js
import { postRoll } from '@vttforge/core';

const roll = new foundry.dice.Roll('1d20 + @abilities.str.mod', actor.getRollData());
await postRoll(roll, {
  actor,
  flavor: 'Strength check',
  crit: 20,
  fumble: 1,
});
```

The card is Foundry's own dice block inside a `div.vttf-roll`. On a critical the wrapper gets `vttf-roll--crit` and a tag reading "Critical"; on a fumble, `vttf-roll--fumble` and "Fumble". `@vttforge/styles` styles both. A plain roll gets neither.

## Options

| Option | What it does |
| --- | --- |
| `actor` | The speaker. `speaker` takes precedence when both are given. |
| `speaker` | A ready speaker object, as `ChatMessage.getSpeaker()` returns it. |
| `flavor` | Text in the message header, above the card. |
| `crit` | `true`: the first die shows its highest face. A number: the natural result is at least that. A function of the roll: your call. Left out, no roll is a critical. |
| `fumble` | `true`: the first die shows a 1. A number: the natural result is at most that. A function: your call. Left out, no roll is a fumble. |
| `labels` | `{ crit, fumble }` as localization keys or plain text. Defaults: "Critical" and "Fumble". |
| `messageMode` | A key of `CONFIG.ChatMessage.modes`: `public`, `gm`, `blind`, `self` or `ic`. Left out, the user's chat setting applies. |
| `scope` | The flag scope the outcome is stored under: your system or module id. Default: `game.system.id`. |
| `flags` | Extra flags for the message. The outcome is added under `scope` after them. |

A roll is never both. When the thresholds overlap, the critical wins.

The natural result is the first active result of the first die term. For `2d20kh1` that is the kept die. A roll with no dice, such as `3 + 2`, has no natural result and is never a critical or a fumble by threshold; a function still runs.

## What the message carries

The message is created with the roll in `rolls`, the dice sound, the speaker and the flavor, so Dice So Nice and the chat log treat it like any roll. The outcome sits in the flags, under your package's scope, because Foundry reads flags only from a scope that names a package:

```js
message.getFlag(game.system.id, 'vttforge.roll');
// { natural: 20, crit: true, fumble: false }
```

A module passes its own id as `scope` and reads it back the same way.

`postRoll` returns `{ message, outcome }`. `rollOutcome(roll, { crit, fumble })` gives the same decision without posting, and `naturalResult(roll)` the natural alone.

## Styling

The card classes are stable:

```css
.vttf-roll { }
.vttf-roll--crit { }
.vttf-roll--fumble { }
.vttf-roll__tag { }
```

The wrapper also carries `data-vttforge-roll="plain" | "crit" | "fumble"` for a hook that reads the DOM, such as `renderChatMessageHTML`.

## Dice pools and steps

Three helpers for table dice, on top of the modifiers Foundry's `Roll` already parses.

`dicePool(spec)` writes the formula:

```ts
import { dicePool } from '@vttforge/core';

dicePool({ number: 5, faces: 6, successAt: 5 });          // '5d6cs>=5'
dicePool({ number: 2, faces: 20, keep: { highest: 1 } });  // '2d20kh1'
dicePool({ number: 4, faces: 6, drop: { lowest: 1 } });    // '4d6dl1'
dicePool({ number: 3, faces: 6, explode: true, rerollAt: 1 }); // '3d6r<=1x'
```

| Key | Modifier | Meaning |
| --- | --- | --- |
| `keep: { highest: n }` / `{ lowest: n }` | `kh` / `kl` | keep only those dice |
| `drop: { highest: n }` / `{ lowest: n }` | `dh` / `dl` | drop those dice |
| `successAt` | `cs>=n` | the total becomes the number of dice at `n` or above |
| `failAt` | `df<=n` | each die at `n` or below takes 1 off the total |
| `explode` | `x` or `x>=n` | roll again on the highest face, or at `n` or above |
| `rerollAt` | `r<=n` | reroll once at `n` or below |
| `min`, `max` | `min`, `max` | floor and ceiling per die |

`stepDie(faces, steps, ladder?)` moves a die along a ladder and stays on its ends. The default ladder is d4, d6, d8, d10, d12:

```ts
stepDie(6, 1);   // 8
stepDie(12, 2);  // 12
stepDie(8, -1, [4, 6, 8, 10, 12, 20]); // 6
```

`countSuccesses(roll, target, { failAt })` counts on any evaluated roll, from the active results of every die, whatever the formula was:

```ts
const roll = new foundry.dice.Roll(dicePool({ number: 5, faces: 6 }));
await roll.evaluate();
countSuccesses(roll, 5);
// { successes: 2, failures: 0, net: 2, results: [6, 1, 5, 3, 2] }
```

A bad count or faces, a `keep` or `drop` above the number of dice, a die off the ladder, or `keep` together with `drop` is refused with [VTTF-0011](../errors/VTTF-0011).

