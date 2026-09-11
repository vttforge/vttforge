/**
 * Chat, dice, combat, scenes, tokens and the canvas, pinned.
 *
 * Asserted on leaves: these types recurse (a combatant names its combat,
 * which names its combatants) and `expectTypeOf` walks structurally.
 */
import { describe, expectTypeOf, it } from 'vitest';
import type { BaseActorSheet } from '../base-actor-sheet.js';
import type {
  ApplicationHeaderControlsEntry,
  ApplicationRenderOptions,
  CanvasApi,
  ChatMessageLike,
  CombatLike,
  Game,
  RollLike,
  SceneLike,
  TokenDocumentLike,
} from '../index.js';

declare const roll: RollLike;
declare const message: ChatMessageLike;
declare const combat: CombatLike;
declare const scene: SceneLike;
declare const token: TokenDocumentLike;
declare const canvas: CanvasApi;
declare const game: Game;
declare const sheet: InstanceType<ReturnType<typeof BaseActorSheet>>;

describe('a roll', () => {
  it('has no total before it is evaluated', () => {
    expectTypeOf(roll.total).toEqualTypeOf<number | undefined>();
    expectTypeOf(roll.formula).toEqualTypeOf<string>();
    expectTypeOf(roll.dice[0]?.faces).toEqualTypeOf<number | undefined>();
  });

  it('resolves evaluate to itself', () => {
    expectTypeOf(roll.evaluate()).resolves.toExtend<RollLike>();
  });

  it('takes messageMode, and rollMode only as the deprecated name', () => {
    expectTypeOf(roll.toMessage).parameter(1).toExtend<{ messageMode?: string } | undefined>();
  });
});

describe('chat and combat', () => {
  it('types a message', () => {
    expectTypeOf(message.alias).toEqualTypeOf<string>();
    expectTypeOf(message.rolls[0]?.total).toEqualTypeOf<number | undefined>();
    expectTypeOf(message.speaker.alias).toEqualTypeOf<string>();
  });

  it('types the tracker', () => {
    expectTypeOf(combat.round).toEqualTypeOf<number>();
    expectTypeOf(combat.combatant?.initiative).toEqualTypeOf<number | null | undefined>();
    expectTypeOf(combat.combatants.filter(() => true)[0]?.name).toEqualTypeOf<string | undefined>();
    // Both return arrays since v14.
    expectTypeOf(combat.getCombatantsByActor).returns.toExtend<readonly unknown[]>();
  });

  it('puts the active encounter on game', () => {
    expectTypeOf(game.combat?.round).toEqualTypeOf<number | undefined>();
    expectTypeOf(game.messages.contents[0]?.alias).toEqualTypeOf<string | undefined>();
  });
});

describe('scene, token and canvas', () => {
  it('puts the background on a level, not the scene', () => {
    expectTypeOf(scene.levels.filter(() => true)[0]?.background.src).toEqualTypeOf<
      string | null | undefined
    >();
    expectTypeOf(scene.grid.distance).toEqualTypeOf<number>();
  });

  it('gives a token its v14 position', () => {
    expectTypeOf(token.elevation).toEqualTypeOf<number>();
    expectTypeOf(token.depth).toEqualTypeOf<number>();
    expectTypeOf(token.level).toEqualTypeOf<string>();
    expectTypeOf(token.actor?.name).toEqualTypeOf<string | undefined>();
  });

  it('types the canvas a package reads', () => {
    expectTypeOf(canvas.scene?.name).toEqualTypeOf<string | undefined>();
    expectTypeOf(canvas.tokens.controlled[0]?.center.x).toEqualTypeOf<number | undefined>();
    expectTypeOf(canvas.level?.elevation.top).toEqualTypeOf<number | undefined>();
  });
});

describe('the sheet render surface', () => {
  it('types the context and the header controls', () => {
    expectTypeOf(sheet._prepareContext).parameter(0).toEqualTypeOf<ApplicationRenderOptions>();
    expectTypeOf(sheet._getHeaderControls()).toEqualTypeOf<ApplicationHeaderControlsEntry[]>();
  });
});
