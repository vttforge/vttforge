/**
 * The reload handlers.
 *
 * Foundry ships an equivalent dispatcher, but it is unreachable: the socket
 * handler is a private method, and the `hotReload` hook fired inside it is a
 * veto: returning `false` cancels the reload. Calling that hook from outside
 * notifies listeners and nothing else.
 *
 * So the work is reimplemented here. It is a small surface and uses only
 * public API. Behaviour is kept deliberately identical to core's, including
 * firing the veto hook first, so a module that suppresses Foundry's own hot
 * reload suppresses this one too.
 */

/** The payload shape Foundry's own hot reload uses. */
export interface HotReloadData {
  packageType: 'system' | 'module' | 'world';
  packageId: string;
  /** Full file contents, already read by the sender. */
  content: string;
  /** Path as Foundry serves it, e.g. `systems/my-system/styles/main.css`. */
  path: string;
  /** Lowercase, no dot: `css`, `hbs`, `html`, `json`. */
  extension: string;
}

/** What a reload attempt did, so callers can log something truthful. */
export type ReloadOutcome =
  | {
      applied: true;
      kind: 'css' | 'html' | 'json';
      /** How many applications were targeted, when the change could be attributed. */
      scoped?: number;
    }
  | { applied: false; reason: 'vetoed' | 'unsupported-extension' | 'no-match' | 'parse-error' };

/**
 * Swap a stylesheet in place by cache-busting its href.
 *
 * Falls back to rewriting an `@import` inside a `<style>` block, which is how
 * a bundled stylesheet pulled in by another one shows up in the document.
 */
function reloadCss(path: string, doc: Document, now: number): ReloadOutcome {
  for (const link of doc.querySelectorAll('link')) {
    if (linkPointsAt(link, path)) {
      link.setAttribute('href', `${path}?${now}`);
      return { applied: true, kind: 'css' };
    }
  }
  // Escape the path before it becomes a pattern; a stylesheet name is not
  // a trusted regular expression.
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const importRe = new RegExp(`@import "${escaped}(?:\\?[^"]+)?"`);
  for (const style of doc.querySelectorAll('style')) {
    const [match] = style.textContent?.match(importRe) ?? [];
    if (match) {
      style.textContent = (style.textContent ?? '').replace(match, `@import "${path}?${now}"`);
      return { applied: true, kind: 'css' };
    }
  }
  return { applied: false, reason: 'no-match' };
}

/**
 * Does this `<link>` serve the file at `path`?
 *
 * The payload carries a root-relative path (`systems/x/styles/main.css`)
 * while `HTMLLinkElement.href` always reads back as a fully resolved URL.
 * Comparing those two directly never matches, so this checks the authored
 * attribute as well as the resolved pathname and accepts either. Both are
 * compared with any cache-buster stripped, so re-reloading the same file
 * keeps matching instead of matching only once.
 */
function linkPointsAt(link: HTMLLinkElement, path: string): boolean {
  const target = path.replace(/^\//, '');
  const authored = (link.getAttribute('href') ?? '').split('?')[0]?.replace(/^\//, '');
  if (authored === target) return true;
  try {
    const resolved = new URL(link.href, 'http://localhost').pathname.replace(/^\//, '');
    return resolved === target;
  } catch {
    return false;
  }
}

/** Recompile a template, re-register it, and re-render what is open. */
function reloadHtml(data: HotReloadData, env: FoundryEnv): ReloadOutcome {
  let template: unknown;
  try {
    template = env.Handlebars.compile(data.content);
  } catch {
    return { applied: false, reason: 'parse-error' };
  }
  env.Handlebars.registerPartial(data.path, template);

  const targets = findRenderTargets(data.path, env);
  if (targets.length > 0) {
    for (const target of targets) target.render();
    return { applied: true, kind: 'html', scoped: targets.length };
  }
  // Nothing claimed the file. It may be a partial nobody declares, so redraw
  // everything rather than leave a stale sheet on screen.
  renderOpenApplications(env);
  return { applied: true, kind: 'html' };
}

/**
 * Merge a language file into the active translations.
 *
 * Only the file matching the user's current language is worth applying;
 * merging another language's strings would replace the visible ones.
 */
function reloadJson(data: HotReloadData, env: FoundryEnv): ReloadOutcome {
  const currentLang = env.game.i18n.lang;
  const pkg =
    data.packageType === 'system' ? env.game.system : env.game.modules?.get(data.packageId);
  const declared = pkg?.languages?.some((l) => l.path === data.path && l.lang === currentLang);
  if (!declared) return { applied: false, reason: 'no-match' };

  let translations: object;
  try {
    translations = JSON.parse(data.content);
  } catch {
    return { applied: false, reason: 'parse-error' };
  }
  env.mergeObject(env.game.i18n.translations, translations);
  renderOpenApplications(env);
  return { applied: true, kind: 'json' };
}

/**
 * One open window of either generation. Only the shape this module reads.
 */
interface AppV1Like {
  render: (force?: boolean) => void;
  options?: { template?: string };
}

export interface AppV2Like {
  render: (options?: { parts?: string[] }) => void;
}

/** One entry of a sheet's `static PARTS`, as far as this module reads it. */
interface PartDescriptor {
  template?: string;
  templates?: string[];
}

/** An open application and, when known, the parts the change touched. */
interface RenderTarget {
  render: () => void;
}

/**
 * Find the applications a changed template actually feeds.
 *
 * A sheet declares its templates in `static PARTS`, so the mapping is right
 * there on the open window; no build-time graph needed. Each part names a
 * primary `template` and may list further `templates`, which is where a
 * partial it pulls in shows up.
 *
 * Returns an empty array when nothing claims the file. That is not a failure:
 * a template can be reached through `{{> partial}}` without any part naming
 * it, and the caller falls back to re-rendering everything rather than
 * quietly updating nothing.
 */
function findRenderTargets(path: string, env: FoundryEnv): RenderTarget[] {
  const targets: RenderTarget[] = [];

  for (const app of Object.values(env.ui?.windows ?? {})) {
    if (app.options?.template === path) targets.push({ render: () => app.render(true) });
  }

  for (const app of env.applicationInstances()) {
    // PARTS is a static on the sheet class and may be absent; it is probed,
    // not required, so it stays out of the interface above, which describes
    // only what this module calls.
    const parts =
      (app as { constructor?: { PARTS?: Record<string, PartDescriptor> } }).constructor?.PARTS ??
      {};
    const affected = Object.entries(parts)
      .filter(([, part]) => part?.template === path || part?.templates?.includes(path))
      .map(([id]) => id);
    if (affected.length > 0) {
      // Re-render only the parts that changed. Redrawing the whole sheet
      // would throw away scroll position and focus in every other part.
      targets.push({ render: () => app.render({ parts: affected }) });
    }
  }

  return targets;
}

/** Re-render every open window, both application generations. */
function renderOpenApplications(env: FoundryEnv): void {
  for (const app of Object.values(env.ui?.windows ?? {})) app.render();
  for (const app of env.applicationInstances()) app.render();
}

/**
 * The Foundry surface this module touches, named explicitly.
 *
 * Passing it in rather than reaching for globals is what makes the handlers
 * testable without booting Foundry, and it documents the whole dependency
 * in one place.
 */
export interface FoundryEnv {
  Handlebars: {
    compile: (input: string) => unknown;
    registerPartial: (name: string, template: unknown) => void;
  };
  game: {
    i18n: { lang: string; translations: object };
    system?: { languages?: Array<{ path: string; lang: string }> };
    modules?: {
      get: (id: string) => { languages?: Array<{ path: string; lang: string }> } | undefined;
    };
  };
  ui?: { windows?: Record<string, AppV1Like> };
  applicationInstances: () => Iterable<AppV2Like>;
  mergeObject: (target: object, source: object) => object;
  /** Fires the veto hook; a `false` return cancels the reload. */
  callHook: (name: string, data: HotReloadData) => boolean;
  document: Document;
  now: () => number;
}

/**
 * Apply one hot reload payload.
 *
 * Mirrors core's dispatch: veto hook first, then switch on extension. An
 * unknown extension is a no-op rather than an error; the sender may watch
 * more file types than the client knows how to apply in place.
 */
export function applyHotReload(data: HotReloadData, env: FoundryEnv): ReloadOutcome {
  if (env.callHook('hotReload', data) === false) {
    return { applied: false, reason: 'vetoed' };
  }
  switch (data.extension) {
    case 'css':
      return reloadCss(data.path, env.document, env.now());
    case 'html':
    case 'hbs':
      return reloadHtml(data, env);
    case 'json':
      return reloadJson(data, env);
    default:
      return { applied: false, reason: 'unsupported-extension' };
  }
}
