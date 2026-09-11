/**
 * The ApplicationV2 render surface: options, context, parts and tabs.
 *
 * Application v1 is not here. It goes away in v16, and nothing new should
 * reach for it.
 */

/** Where a window sits and how big it is. */
export interface ApplicationPosition {
  top: number;
  left: number;
  width: number | 'auto';
  height: number | 'auto';
  scale: number;
  zIndex: number;
}

/** One button in a window's header. */
export interface ApplicationHeaderControlsEntry {
  icon: string;
  /** `name` was the v13 spelling and warns since v14. */
  label: string;
  action: string;
  /** A boolean, or a function called with the application as `this`. */
  visible?: boolean | (() => boolean);
  onClick?: (event: PointerEvent) => unknown;
}

export interface ApplicationWindowConfiguration {
  frame?: boolean;
  positioned?: boolean;
  title?: string;
  icon?: string | false;
  controls?: ApplicationHeaderControlsEntry[];
  minimizable?: boolean;
  resizable?: boolean;
  contentTag?: string;
  contentClasses?: string[];
}

/** What a form-tagged application does on submit. */
export interface ApplicationFormConfiguration {
  handler?: (
    event: SubmitEvent | Event,
    form: HTMLFormElement,
    formData: { object: Record<string, unknown> },
  ) => Promise<unknown> | unknown;
  submitOnChange?: boolean;
  closeOnSubmit?: boolean;
}

/** A `data-action` handler, called with the application as `this`. */
export type ApplicationClickAction = (
  event: PointerEvent,
  target: HTMLElement,
) => Promise<unknown> | unknown;

/** `static DEFAULT_OPTIONS`. */
export interface ApplicationConfiguration {
  id?: string;
  uniqueId?: string;
  classes?: string[];
  tag?: string;
  window?: ApplicationWindowConfiguration;
  form?: ApplicationFormConfiguration;
  position?: Partial<ApplicationPosition>;
  actions?: Record<string, ApplicationClickAction>;
  [key: string]: unknown;
}

/** What `render()` and the render hooks are handed. */
export interface ApplicationRenderOptions {
  force?: boolean;
  position?: Partial<ApplicationPosition>;
  window?: Partial<ApplicationWindowConfiguration>;
  /** Render only these parts. */
  parts?: string[];
  isFirstRender?: boolean;
  tab?: Record<string, string> | string;
  [key: string]: unknown;
}

/** What `_prepareContext` returns and the template reads. */
export type ApplicationRenderContext = Record<string, unknown>;

/** One tab, as `context.tabs.<group>` carries it. */
export interface ApplicationTab {
  id: string;
  group: string;
  active: boolean;
  cssClass: string;
  label?: string;
  icon?: string;
  tooltip?: string;
}

/** `static TABS`, keyed by group. */
export interface ApplicationTabsConfiguration {
  tabs: {
    id: string;
    group?: string;
    label?: string;
    icon?: string;
    tooltip?: string;
  }[];
  initial?: string;
  labelPrefix?: string;
}

/** One entry of `static PARTS`. */
export interface HandlebarsTemplatePart {
  template: string;
  id?: string;
  classes?: string[];
  templates?: string[];
  scrollable?: string[];
  /** Which form fields this part is allowed to submit. */
  forms?: Record<string, ApplicationFormConfiguration>;
  root?: boolean;
}
