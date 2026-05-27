/**
 * {{TITLE}} — entry point.
 *
 * Demonstrates the typical Foundry module lifecycle:
 *
 * - `Hooks.once("init")` — register settings (here via `SystemConfig` from
 *   `@vttforge/core` for typed access) and expose the public API on
 *   `game.modules.get(MODULE_ID).api`.
 * - `Hooks.once("ready")` — surface a one-shot notification if the user
 *   opted in via settings.
 * - `Hooks.on("renderActorSheetV2", ...)` — example hook listener that
 *   tags any actor sheet with a discreet `.{{ID}}-badge` so you can verify
 *   the module is actually attached without hunting through devtools.
 */
import './foundry-globals.js';
import { SystemConfig } from '@vttforge/core';

const MODULE_ID = '{{ID}}';
const settings = new SystemConfig(MODULE_ID);

interface ModuleApi {
  greet(name: string): string;
  getSetting<T>(key: string): T;
}

Hooks.once('init', () => {
  settings.register('showWelcome', {
    name: '{{LOCALE_PREFIX}}.Settings.showWelcome.name',
    hint: '{{LOCALE_PREFIX}}.Settings.showWelcome.hint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  const api: ModuleApi = {
    greet(name: string): string {
      return `Hello, ${name}!`;
    },
    getSetting<T>(key: string): T {
      return settings.get(key) as T;
    },
  };

  const moduleHandle = game.modules.get(MODULE_ID);
  if (moduleHandle) {
    moduleHandle.api = api;
  }
});

Hooks.once('ready', () => {
  const shouldWelcome = settings.get<boolean>('showWelcome');
  if (shouldWelcome) {
    ui.notifications?.info(game.i18n.localize('{{LOCALE_PREFIX}}.Welcome'));
  }
});

Hooks.on('renderActorSheetV2', (_app: unknown, element: HTMLElement) => {
  // Decorative: tag the rendered sheet so it's obvious the module is
  // active. Remove or replace with real behaviour once you start shipping
  // module features.
  const header = element.querySelector('.window-header .window-title');
  if (header && !header.querySelector(`.{{ID}}-badge`)) {
    const badge = document.createElement('span');
    badge.className = '{{ID}}-badge';
    // Double-quoted because `vttforge init` rejects `"` and `\` in the
    // title — apostrophes in titles like "Daisy's Module" stay intact.
    badge.textContent = "{{TITLE}}";
    header.appendChild(badge);
  }
});
