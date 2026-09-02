/**
 * The shape a `ColorField` hands back.
 *
 * Foundry initializes the field into one of its own `Color` instances (a
 * boxed 24-bit integer with derived accessors) rather than the CSS string it
 * stores. Described structurally here rather than imported, because the
 * inference surface deliberately does not depend on the Foundry type package.
 *
 * Members mirror the documented public accessors. `toString(radix)` is
 * included because a colour is routinely interpolated straight into markup.
 */
export interface Color {
  /** False when the underlying value is not a valid colour. */
  readonly valid: boolean;
  /** CSS hexadecimal string, e.g. `#ff0000`. */
  readonly css: string;
  /** Normalized `[r, g, b]`, each 0–1. */
  readonly rgb: [number, number, number];
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** The largest of the three channels. */
  readonly maximum: number;
  /** The smallest of the three channels. */
  readonly minimum: number;
  /** Byte order flipped, for APIs that want BGR. */
  readonly littleEndian: number;
  readonly hsv: [number, number, number];
  readonly hsl: [number, number, number];
  /** The colour in linear space, for shader work. */
  readonly linear: Color;
  toString: (radix?: number) => string;
  valueOf: () => number;
}
