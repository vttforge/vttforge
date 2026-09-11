/**
 * `foundry.dice`: rolls, terms and what a roll leaves in chat.
 *
 * The members Foundry documents for v13+ and v14. `evaluate()` is always
 * awaited; `roll()` is an async alias of it and nothing more.
 */

/** One die result inside a term. */
export interface DiceTermResult {
  result: number;
  active?: boolean;
  discarded?: boolean;
  rerolled?: boolean;
  exploded?: boolean;
  success?: boolean;
  failure?: boolean;
  count?: number;
}

/** One term of a parsed formula. */
export interface RollTermLike {
  readonly expression: string;
  readonly total: number | string | undefined;
  readonly formula: string;
  readonly isDeterministic: boolean;
  readonly flavor: string;
  options: Record<string, unknown>;
  toJSON(): Record<string, unknown>;
}

/** A `Die` term, the one a system reaches for. */
export interface DieTermLike extends RollTermLike {
  number: number;
  faces: number;
  readonly results: DiceTermResult[];
  readonly values: number[];
  readonly denomination: string;
}

export interface RollEvaluateOptions {
  minimize?: boolean;
  maximize?: boolean;
  allowStrings?: boolean;
  allowInteractive?: boolean;
}

/**
 * How a message reaches chat.
 *
 * `messageMode` is a key of `CONFIG.ChatMessage.modes`: `public`, `gm`,
 * `blind`, `self`, `ic`. Leave it out and Foundry reads the user's own
 * `core.messageMode` setting. `rollMode` is the v13 name, deprecated in v14
 * and gone in v16.
 */
export interface ToMessageOptions {
  messageMode?: string;
  /** @deprecated since Foundry v14. Pass `messageMode`. */
  rollMode?: string;
  create?: boolean;
}

/** `foundry.dice.Roll`. */
export interface RollLike {
  readonly formula: string;
  readonly result: string;
  /** Undefined until the roll is evaluated. */
  readonly total: number | undefined;
  readonly dice: DieTermLike[];
  readonly terms: RollTermLike[];
  readonly isDeterministic: boolean;
  readonly data: Record<string, unknown>;
  options: Record<string, unknown>;

  /** Always await this. Nothing reads `total` before it resolves. */
  evaluate(options?: RollEvaluateOptions): Promise<this>;
  /** Only for a deterministic roll: pass `minimize` or `maximize`. */
  evaluateSync(options?: RollEvaluateOptions & { strict?: boolean }): this;
  /** An async alias of `evaluate`. */
  roll(options?: RollEvaluateOptions): Promise<this>;
  reroll(options?: RollEvaluateOptions): Promise<this>;
  alter(multiply: number, add: number, options?: { multiplyNumeric?: boolean }): this;
  clone(): this;
  resetFormula(): string;
  render(options?: { flavor?: string; template?: string; isPrivate?: boolean }): Promise<string>;
  getTooltip(): Promise<string>;
  toMessage(messageData?: Record<string, unknown>, options?: ToMessageOptions): Promise<unknown>;
  toAnchor(options?: {
    attrs?: Record<string, string>;
    dataset?: Record<string, string>;
    classes?: readonly string[];
    label?: string;
    icon?: string;
  }): HTMLAnchorElement;
  toJSON(): Record<string, unknown>;
}

/** The `Roll` class itself, as `foundry.dice.Roll`. */
export interface RollConstructor {
  new (
    formula?: string,
    data?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): RollLike;
  create(
    formula: string,
    data?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): RollLike;
  readonly defaultImplementation: RollConstructor;
  getFormula(terms: readonly RollTermLike[]): string;
  safeEval(expression: string): number;
  simplifyTerms(terms: readonly RollTermLike[]): RollTermLike[];
  simulate(formula: string, n?: number): Promise<number[]>;
  parse(formula?: string, data?: Record<string, unknown>): RollTermLike[];
  replaceFormulaData(
    formula: string,
    data: Record<string, unknown>,
    options?: { missing?: string; warn?: boolean },
  ): string;
  validate(formula: string): boolean;
  fromJSON(json: string): RollLike;
  fromTerms(terms: readonly RollTermLike[], options?: Record<string, unknown>): RollLike;
  /** Map a v13 `rollMode` onto a v14 `messageMode`. */
  _mapLegacyRollMode(rollMode: string): string;
}
