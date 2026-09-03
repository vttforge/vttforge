/**
 * What the SDK does inside a real Foundry.
 *
 * Everything here is a claim the unit tests cannot make. They run against a
 * mocked `foundry` global, so they prove the SDK calls the right things; only
 * a real world proves Foundry accepted them.
 *
 * The one that matters most is the sheet key. `registerSheets` pins a class
 * name so the key Foundry persists survives a rebuild, and until now nothing
 * had ever read that key back out of a running Foundry.
 */
import { expect, test } from '@playwright/test';
import { baseUrl } from '../scripts/foundry.mjs';

/** Foundry refuses to lay out below 1024x700 and says so in a banner. */
test.use({ viewport: { width: 1600, height: 1000 } });

/** Console errors are collected for the whole file: a stray one fails the run. */
const consoleErrors = [];

test.beforeEach(async ({ page }) => {
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
});

/** Join as the Gamemaster the world created on launch, and wait for `ready`. */
async function joinWorld(page) {
  await page.goto(`${baseUrl()}/join`);
  await page.waitForSelector('select[name=userid]');
  await page.selectOption('select[name=userid]', { label: 'Gamemaster' });
  await page.click('button[name=join]');
  await page.waitForURL('**/game');
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 60_000 });
}

test('the system registers everything registerSystem was given', async ({ page }) => {
  await joinWorld(page);

  const registered = await page.evaluate(() => ({
    system: game.system.id,
    actorModels: Object.keys(CONFIG.Actor.dataModels ?? {}),
    itemModels: Object.keys(CONFIG.Item.dataModels ?? {}),
    initiative: CONFIG.Combat.initiative?.formula,
    legacyTransferral: CONFIG.ActiveEffect.legacyTransferral,
    settings: [...game.settings.settings.keys()].filter((key) =>
      key.startsWith('vttforge-example.'),
    ),
  }));

  expect(registered.system).toBe('vttforge-example');
  expect(registered.actorModels).toContain('character');
  expect(registered.itemModels).toContain('gear');
  expect(registered.initiative).toBe('1d20 + @abilities.dex.mod');
  // registerSystem turns this off by default; a system that still has it on
  // gets Active Effects applied twice.
  expect(registered.legacyTransferral).toBe(false);
  expect(registered.settings).toEqual(
    expect.arrayContaining(['vttforge-example.showTutorial', 'vttforge-example.schemaVersion']),
  );
});

test('each sheet is filed under the id it was given, not its class name', async ({ page }) => {
  await joinWorld(page);

  const keys = await page.evaluate(() => ({
    character: Object.keys(CONFIG.Actor.sheetClasses?.character ?? {}),
    gear: Object.keys(CONFIG.Item.sheetClasses?.gear ?? {}),
  }));

  // This is the key Foundry writes to `flags.core.sheetClass` on every
  // document whose owner picks the sheet. It is derived from the class name,
  // which a minifier renames between builds, so the whole point of passing an
  // `id` is that these two strings never move.
  expect(keys.character).toContain('vttforge-example.character');
  expect(keys.gear).toContain('vttforge-example.gear');
});

test('a character sheet renders its parts and its derived data', async ({ page }) => {
  await joinWorld(page);

  const sheet = await page.evaluate(async () => {
    const actor = await Actor.create({ name: 'End-to-end Hero', type: 'character' });
    await actor.createEmbeddedDocuments('Item', [
      { name: 'Rope', type: 'gear', system: { quantity: 2, kind: 'stowed' } },
    ]);
    await actor.sheet.render(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const element = actor.sheet.element;
    return {
      sheetClassName: actor.sheet.constructor.name,
      tabs: [...element.querySelectorAll('section.tab')].map((section) => section.dataset.tab),
      abilities: element.querySelectorAll('[data-ability]').length,
      gearRows: element.querySelectorAll('[data-item-id]').length,
      derived: {
        armorClass: actor.system.armorClass,
        initiative: actor.system.initiative,
        healthMax: actor.system.health.max,
        strMod: actor.system.abilities.str.mod,
      },
    };
  });

  // The class reports the pinned name even in the bundled build.
  expect(sheet.sheetClassName).toBe('character');
  expect(sheet.tabs).toEqual(['abilities', 'inventory', 'spells', 'biography']);
  expect(sheet.abilities).toBe(6);
  expect(sheet.gearRows).toBe(1);
  // prepareDerivedData ran: 10 + the dex modifier of a default 10.
  expect(sheet.derived.armorClass).toBe(10);
  expect(sheet.derived.initiative).toBe(0);
  // 10 + level 1 + the con modifier.
  expect(sheet.derived.healthMax).toBe(11);
  expect(sheet.derived.strMod).toBe(0);
});

test("another package's plain CSS cannot restyle the sheet", async ({ page }) => {
  await joinWorld(page);

  // An unlayered author rule beats every layered one, whatever the
  // specificity, and layer order is settled before specificity is consulted.
  // Foundry loads a system or module stylesheet unlayered unless the manifest
  // asks otherwise, so most packages on the page write plain CSS. Put the
  // components in a layer and a bare element selector from an unrelated
  // module wins.
  //
  // Two of ours stay layered on purpose. Tokens are custom properties a
  // consumer overrides with one plain declaration, and the reset touches bare
  // elements, so neither should outrank a real rule from the system around it.
  const ALLOWED = ['vttforge.tokens', 'vttforge.reset'];

  const cascade = await page.evaluate(async (allowed) => {
    const actor = await Actor.create({ name: 'Cascade Check', type: 'character' });
    await actor.sheet.render(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // The example system styles its sheet with its own classes, so nothing on
    // screen carries a `.vttf-` class. The element is planted; the stylesheet,
    // the page and the rival rule below are all real.
    const button = document.createElement('button');
    button.className = 'vttf-btn';
    actor.sheet.element.querySelector('.window-content').append(button);
    const before = getComputedStyle(button).borderRadius;

    // Stand in for a second module, loaded after ours, styling elements the
    // way modules commonly do: no layer, barely any specificity.
    const rival = document.createElement('style');
    rival.textContent = 'button { border-radius: 99px; }';
    document.head.append(rival);
    const after = getComputedStyle(button).borderRadius;

    // Walk every stylesheet and note which layer, if any, each of our rules
    // sits in. A cross-origin sheet throws on `cssRules`, so the count of
    // those is carried out for the failure message: it explains an empty
    // result that would otherwise look like a pass.
    const offenders = [];
    let unlayeredCount = 0;
    let unreadable = 0;

    const visit = (rules, layerName) => {
      for (const rule of rules) {
        if (rule instanceof CSSImportRule) {
          if (rule.styleSheet) visit(rule.styleSheet.cssRules, rule.layerName ?? layerName);
        } else if (rule instanceof CSSLayerBlockRule) {
          visit(rule.cssRules, rule.name || '(anonymous)');
        } else if (rule instanceof CSSGroupingRule) {
          visit(rule.cssRules, layerName);
        } else if (rule instanceof CSSStyleRule && rule.selectorText.includes('vttf-')) {
          if (layerName === null) unlayeredCount += 1;
          else if (!allowed.includes(layerName)) {
            offenders.push(`@layer ${layerName} { ${rule.selectorText} }`);
          }
        }
      }
    };

    for (const sheet of document.styleSheets) {
      try {
        visit(sheet.cssRules, null);
      } catch {
        unreadable += 1;
      }
    }

    rival.remove();
    button.remove();
    return { unreadable, unlayeredCount, offenders: offenders.slice(0, 10), before, after };
  }, ALLOWED);

  // Proves the walk actually read our stylesheet, so an empty `offenders` is
  // a real result and not a sheet it could not open.
  expect(
    cascade.unlayeredCount,
    `no unlayered VTTForge rules found; ${cascade.unreadable} stylesheets were unreadable`,
  ).toBeGreaterThan(50);
  expect(
    cascade.offenders,
    'these rules paint the sheet from inside a cascade layer, so plain CSS from any other module beats them',
  ).toEqual([]);

  // --vttf-radius-md, and it holds while the rival rule is on the page.
  expect(cascade.before).toBe('6px');
  expect(cascade.after).toBe('6px');
});

test('the module contributes a namespaced sub-type once enabled', async ({ page }) => {
  await joinWorld(page);

  // A module's sub-types are filed under `<module id>.<type>`; the bare name
  // never appears. Enabling it needs a world reload to take effect.
  await page.evaluate(async () => {
    const settings = game.settings.get('core', 'moduleConfiguration');
    await game.settings.set('core', 'moduleConfiguration', {
      ...settings,
      'vttforge-example-module': true,
    });
  });

  await joinWorld(page);

  const contributed = await page.evaluate(() => ({
    itemModels: Object.keys(CONFIG.Item.dataModels ?? {}),
    sheets: Object.keys(CONFIG.Item.sheetClasses?.['vttforge-example-module.note'] ?? {}),
    enrichers: (CONFIG.TextEditor.enrichers ?? []).map((entry) => entry.id).filter(Boolean),
    api: typeof game.modules.get('vttforge-example-module')?.api?.createNote,
  }));

  expect(contributed.itemModels).toContain('vttforge-example-module.note');
  expect(contributed.itemModels).not.toContain('note');
  expect(contributed.sheets).toContain('vttforge-example-module.note');
  expect(contributed.enrichers).toContain('vttforge-example-module.note');
  expect(contributed.api).toBe('function');
});

test.afterAll(() => {
  // Foundry logs a few of its own errors that have nothing to do with us
  // (a missing favicon, an audio context the browser blocks). Only ours fail.
  const ours = consoleErrors.filter((line) => /vttforge|VTTF-\d{4}/i.test(line));
  expect(ours, `console errors naming VTTForge:\n${ours.join('\n')}`).toEqual([]);
});
