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

test("the sheet styles compose with the system's own CSS, and yield to modules", async ({
  page,
}) => {
  await joinWorld(page);

  // Foundry puts a system's stylesheet in `@layer system` and a module's in
  // `@layer modules`. The manifest's `styles` entry takes an optional `layer`
  // and the server fills one in when it is left out, so this file is layered
  // before anyone here gets a say.
  //
  // That settles two different questions, and this test holds both.
  const cascade = await page.evaluate(async () => {
    const actor = await Actor.create({ name: 'Cascade Check', type: 'character' });
    await actor.sheet.render(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // The example system styles its sheet with its own classes, so nothing on
    // screen carries a `.vttf-` class. The element is planted; the stylesheet,
    // the page and the rival rules are all real.
    const button = document.createElement('button');
    button.className = 'vttf-btn';
    actor.sheet.element.querySelector('.window-content').append(button);

    const withRival = (css) => {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.append(style);
      const radius = getComputedStyle(button).borderRadius;
      style.remove();
      return radius;
    };

    const alone = getComputedStyle(button).borderRadius;
    // The system's own stylesheet, which lands in the same layer as ours.
    const versusSystem = withRival('@layer system { button { border-radius: 55px; } }');
    // A module, which Foundry sorts after every system.
    const versusModule = withRival('@layer modules { button { border-radius: 99px; } }');

    button.remove();
    return { alone, versusSystem, versusModule };
  });

  const seen = `alone ${cascade.alone}, against the system ${cascade.versusSystem}, against a module ${cascade.versusModule}`;

  // --vttf-radius-md, applied.
  expect(cascade.alone, seen).toBe('6px');

  // The point of leaving components unlayered: inside Foundry's `system`
  // layer, a bare `button` selector of the system's own no longer outranks
  // `.vttf-btn` for free. Specificity decides, and `.vttf-btn` has more of it.
  expect(cascade.versusSystem, seen).toBe('6px');

  // And the point of not fighting the platform: a module still wins, because
  // Foundry orders `system` before `modules` so that modules can override
  // systems. This fails if anyone sets `"layer": null` on the manifest entry
  // to jump that queue.
  expect(cascade.versusModule, seen).toBe('99px');
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
