/**
 * Foundry runtime globals, typed by `@vttforge/types`.
 *
 * An ambient declaration, so it lives in a `.d.ts` and `include` picks it up.
 * Nothing imports it.
 *
 * Two `declare global` blocks naming one global have to agree on two things,
 * and both matter here because `@vttforge/testing` declares the same ones.
 *
 * `var`, not `const`. `const` is block-scoped, so a second one is a
 * redeclaration and `tsc` stops with TS2451.
 *
 * The same type, from the same package. Two structurally identical interfaces
 * are still two types, and `tsc` stops with TS2403 saying a variable "must be
 * of type 'FoundryNamespace', but here has type 'FoundryNamespace'", which
 * reads like a riddle. So `FoundryNamespace` is imported rather than written
 * out here.
 *
 * Reaching a member it does not describe is a cast. Write the cast rather than
 * widening the global to `any`: a typo in a namespaced path only shows up at
 * runtime, in front of a player.
 */
import type {
  ChatMessageConstructor,
  FoundryConfig,
  FoundryConstants,
  FoundryNamespace,
  Game,
  HooksApi,
  RollConstructor,
  UiApi,
} from '@vttforge/types';

declare global {
  var game: Game;
  var CONFIG: FoundryConfig;
  var CONST: FoundryConstants;
  var Hooks: HooksApi;
  var ui: UiApi;
  var foundry: FoundryNamespace;
  var Roll: RollConstructor;
  var ChatMessage: ChatMessageConstructor;
}
