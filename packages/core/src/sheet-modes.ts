/**
 * Play and edit modes for a sheet.
 *
 * A sheet in play is read: the numbers, the buttons that roll, the tabs. A
 * sheet in edit is written: every field open. Most systems end up with the
 * two, and each writes the same toggle, the same class on the root, the same
 * `disabled` on every input. This is that once.
 *
 * Opt in with `static MODES = { initial: 'play' }` on a sheet built on one of
 * the bases. Without it a sheet behaves as before: always in edit, no header
 * control, no field touched.
 *
 * What the opt-in gives:
 *
 * - A header control, "Edit mode" in play and "Play mode" in edit, shown to
 *   users who can edit the document. Its action is `vttforgeToggleMode`.
 * - `sheet.mode`, `sheet.isEditMode`, `sheet.isPlayMode`, and
 *   `sheet.toggleMode(mode?)`, which re-renders.
 * - `context.mode`, `context.isEditMode` and `context.isPlayMode` for the
 *   templates.
 * - The class `vttforge-mode-play` or `vttforge-mode-edit` on the sheet
 *   element after every render.
 * - In play, every form field inside the window content is `disabled`, except
 *   those inside an element that carries `data-vttforge-edit-in-play`. A roll
 *   button is not a form field; it keeps working.
 *
 * The mode lives on the sheet instance, so it resets when the window is
 * closed and opened again. That is what a player expects from a toggle, and
 * it keeps the sheet out of the settings.
 */

export type SheetMode = 'play' | 'edit';

/** The opt-in. `static MODES = {}` is enough; both fields have defaults. */
export interface SheetModesConfig {
  /** The mode a fresh sheet opens in. Default `'play'`. */
  readonly initial?: SheetMode;
  /**
   * Labels for the header control, as localization keys or plain text. The
   * `play` label is shown while in edit (it leads to play), and the reverse.
   * Defaults: `'Play mode'` and `'Edit mode'`.
   */
  readonly labels?: { readonly play?: string; readonly edit?: string };
}

/** The action name the header control dispatches. */
export const TOGGLE_MODE_ACTION = 'vttforgeToggleMode';

/** Class put on the sheet element for the current mode. */
export const MODE_CLASS: Readonly<Record<SheetMode, string>> = {
  play: 'vttforge-mode-play',
  edit: 'vttforge-mode-edit',
};

/**
 * Form fields disabled in play. Foundry's own elements are included; a
 * `<button>` is not, so actions keep working.
 */
const FIELD_SELECTOR =
  'input, select, textarea, prose-mirror, file-picker, color-picker, range-picker, string-tags, multi-select, multi-checkbox, formula-input';

/** Fields inside an element with this attribute stay editable in play. */
export const EDIT_IN_PLAY_ATTRIBUTE = 'data-vttforge-edit-in-play';

const current = new WeakMap<object, SheetMode>();

interface SheetLike {
  readonly constructor: { readonly MODES?: SheetModesConfig };
  readonly isEditable?: boolean;
  readonly element?: HTMLElement;
  render?: (options?: unknown) => unknown;
}

function modesConfig(sheet: object): SheetModesConfig | undefined {
  const config = (sheet as SheetLike).constructor.MODES;
  return config && typeof config === 'object' ? config : undefined;
}

/** The sheet's mode. A sheet without `MODES` is always in edit. */
export function currentMode(sheet: object): SheetMode {
  const config = modesConfig(sheet);
  if (!config) return 'edit';
  return current.get(sheet) ?? config.initial ?? 'play';
}

function setMode(sheet: object, mode: SheetMode): void {
  current.set(sheet, mode);
}

/** The context keys templates read. */
export function modeContext(sheet: object): {
  mode: SheetMode;
  isEditMode: boolean;
  isPlayMode: boolean;
} {
  const mode = currentMode(sheet);
  return { mode, isEditMode: mode === 'edit', isPlayMode: mode === 'play' };
}

/**
 * The header control entry for `DEFAULT_OPTIONS.window.controls`. Its label
 * is fixed here; `decorateHeaderControls` swaps it for the current mode.
 */
export function toggleModeControl(): {
  icon: string;
  label: string;
  action: string;
  visible: (this: unknown) => boolean;
} {
  return {
    icon: 'fa-solid fa-pen-to-square',
    label: 'Edit mode',
    action: TOGGLE_MODE_ACTION,
    visible(this: unknown) {
      const sheet = this as SheetLike;
      return modesConfig(sheet) !== undefined && Boolean(sheet.isEditable);
    },
  };
}

/** Give the toggle control the label and icon for where it leads. */
export function decorateHeaderControls<T extends { action?: string }>(
  sheet: object,
  controls: readonly T[],
): T[] {
  const config = modesConfig(sheet);
  return controls.map((control) => {
    if (control.action !== TOGGLE_MODE_ACTION || !config) return control;
    const toPlay = currentMode(sheet) === 'edit';
    return {
      ...control,
      icon: toPlay ? 'fa-solid fa-dice-d20' : 'fa-solid fa-pen-to-square',
      label: toPlay ? (config.labels?.play ?? 'Play mode') : (config.labels?.edit ?? 'Edit mode'),
    };
  });
}

/** Class on the root, fields disabled in play. Called after every render. */
export function applyMode(sheet: object): void {
  const element = (sheet as SheetLike).element;
  if (!element || !modesConfig(sheet)) return;
  const mode = currentMode(sheet);
  element.classList.toggle(MODE_CLASS.play, mode === 'play');
  element.classList.toggle(MODE_CLASS.edit, mode === 'edit');
  if (mode !== 'play') return;
  const content = element.querySelector<HTMLElement>('.window-content') ?? element;
  for (const field of content.querySelectorAll<HTMLElement & { disabled?: boolean }>(
    FIELD_SELECTOR,
  )) {
    if (field.closest(`[${EDIT_IN_PLAY_ATTRIBUTE}]`)) continue;
    field.disabled = true;
    field.setAttribute('disabled', '');
  }
}

/** Flip the mode (or set the one given) and re-render. */
export async function toggleMode(sheet: object, mode?: SheetMode): Promise<void> {
  if (!modesConfig(sheet)) return;
  const next = mode ?? (currentMode(sheet) === 'play' ? 'edit' : 'play');
  setMode(sheet, next);
  const render = (sheet as SheetLike).render;
  if (typeof render === 'function') await render.call(sheet);
}
