/**
 * How a base factory reports what it returns.
 *
 * These factories mix VTTForge behaviour into a Foundry class resolved at
 * runtime. Two halves, and they are not equally knowable: what we add is
 * ours and can be typed exactly; what Foundry brings lives in a type package
 * that is not wired up yet.
 *
 * Returning `any` for the whole thing — which is what every factory did —
 * gives up on both. It costs more than it looks: a subclass cannot write
 * `override` on a member it really is overriding, and a call to a method
 * that does not exist passes silently. Both happened while porting a real
 * module onto the SDK, the second one shipping a broken call into a release.
 *
 * So: type our half, and let Foundry's half through an index signature. A
 * property we know about carries its real type; anything else is reachable
 * and `any`, the same as before. When `@vttforge/types` lands, the index
 * signature is what it replaces.
 */

/**
 * The part of an instance this SDK does not describe yet.
 *
 * Deliberately permissive. Narrowing it before the Foundry types exist would
 * only mean rejecting code that works.
 */
export interface UntypedFoundryMembers {
  // biome-ignore lint/suspicious/noExplicitAny: the Foundry surface is typed by fvtt-types / @vttforge/types, not here
  [member: string]: any;
}

/**
 * A class this SDK built on top of a Foundry one.
 *
 * `Added` is what the factory contributes. Everything else stays reachable.
 */
export type VttforgeClass<Added, Statics = unknown> = Statics & {
  // biome-ignore lint/suspicious/noExplicitAny: forwards Foundry's own constructor arity
  new (...args: any[]): Added & UntypedFoundryMembers;
};
