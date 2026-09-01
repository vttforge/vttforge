/**
 * The reload handlers.
 *
 * Foundry ships an equivalent dispatcher, but it is unreachable: the socket
 * handler is a private method, and the `hotReload` hook fired inside it is a
 * veto — returning `false` cancels the reload. Calling that hook from outside
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
  | { applied: true; kind: 'css' | 'html' | 'json' }
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
  // Escape the path before it becomes a pattern — a stylesheet name is not
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
  renderOpenApplications(env);
  return { applied: true, kind: 'html' };
}

/**
 * Merge a language file into the active translations.
 *
 * Only the file matching the user's current language is worth applying —
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

/** Re-render every open window, both application generations. */
function renderOpenApplications(env: FoundryEnv): void {
  for (const app of Object.values(env.ui?.windows ?? {})) app.render();
  for (const app of env.applicationInstances()) app.render();
}

/**
 * The Foundry surface this module touches, named explicitly.
 *
 * Passing it in rather than reaching for globals is what makes the handlers
 * testable without booting Foundry — and it documents the whole dependency
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
  ui?: { windows?: Record<string, { render: () => void }> };
  applicationInstances: () => Iterable<{ render: () => void }>;
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
 * unknown extension is a no-op rather than an error — the sender may watch
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
