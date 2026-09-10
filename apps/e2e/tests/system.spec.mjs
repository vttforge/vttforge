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

/**
 * So are deprecation warnings. Foundry names the replacement and prints the
 * stack, so a warning whose stack runs through our code means the SDK or the
 * example is on borrowed time, and that should fail here rather than in v16.
 */
const deprecations = [];

test.beforeEach(async ({ page }) => {
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') consoleErrors.push(text);
    if (/deprecated since/i.test(text)) deprecations.push(text);
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
});

/** Join as the Gamemaster the world created on launch, and wait for `ready`. */
async function joinWorld(page) {
  await page.goto(`${baseUrl()}/join`);
  // v14 asks for the user's name in a text field; v13 offered a select.
  await page.waitForSelector('form[name=join] input[name=username]');
  await page.fill('form[name=join] input[name=username]', 'Gamemaster');
  await page.click('form[name=join] button[name=join]');
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
    settings: [...game.settings.settings.keys()].filter((key) =>
      key.startsWith('vttforge-example.'),
    ),
  }));

  expect(registered.system).toBe('vttforge-example');
  expect(registered.actorModels).toContain('character');
  expect(registered.itemModels).toContain('gear');
  expect(registered.initiative).toBe('1d20 + @abilities.dex.mod');
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

test('a sheet with MODES opens in play, locks its fields, and edit opens them again', async ({
  page,
}) => {
  await joinWorld(page);

  const result = await page.evaluate(async () => {
    const actor = await Actor.create({ name: 'End-to-end Mode Hero', type: 'character' });
    await actor.sheet.render(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const sheet = actor.sheet;
    const read = () => {
      const element = sheet.element;
      const content = element.querySelector('.window-content');
      return {
        mode: sheet.mode,
        classes: [...element.classList].filter((c) => c.startsWith('vttforge-mode-')),
        nameDisabled: content.querySelector('input[name="name"]').disabled,
        hpDisabled: content.querySelector('input[name="system.health.value"]').disabled,
        rollDisabled: content.querySelector('[data-action="rollAbility"]').disabled,
      };
    };
    const play = read();
    const control = sheet._getHeaderControls().find((c) => c.action === 'vttforgeToggleMode');
    const controlInPlay = { label: control.label, visible: control.visible.call(sheet) };
    await sheet.toggleMode();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const edit = read();
    const controlInEdit = sheet
      ._getHeaderControls()
      .find((c) => c.action === 'vttforgeToggleMode').label;
    // The header control is what the user clicks; drive it through the action.
    await sheet.element.querySelector('[data-action="vttforgeToggleMode"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { play, controlInPlay, edit, controlInEdit, afterClick: read().mode };
  });

  expect(result.play.mode).toBe('play');
  expect(result.play.classes).toEqual(['vttforge-mode-play']);
  expect(result.play.nameDisabled).toBe(true);
  // Hit points sit inside a data-vttforge-edit-in-play wrapper.
  expect(result.play.hpDisabled).toBe(false);
  expect(result.play.rollDisabled).toBe(false);
  expect(result.controlInPlay).toEqual({
    label: 'VTTFORGE_EXAMPLE.Sheet.Mode.edit',
    visible: true,
  });

  expect(result.edit.mode).toBe('edit');
  expect(result.edit.classes).toEqual(['vttforge-mode-edit']);
  expect(result.edit.nameDisabled).toBe(false);
  expect(result.controlInEdit).toBe('VTTFORGE_EXAMPLE.Sheet.Mode.play');
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

test('a keyword enriches in chat with its tooltip, and the GM has the keywords journal', async ({
  page,
}) => {
  await joinWorld(page);

  const seen = await page.evaluate(async () => {
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    const enriched = await TextEditor.enrichHTML(
      'Keep it @Keyword[stowed] or @Keyword[equipped]{in hand}. @Keyword[unknown] stays.',
    );
    const holder = document.createElement('div');
    holder.innerHTML = enriched;
    const spans = [...holder.querySelectorAll('.vttf-keyword')].map((span) => ({
      id: span.dataset.vttforgeKeyword,
      text: span.textContent,
      tooltip: span.dataset.tooltip,
    }));

    const message = await ChatMessage.create({ content: 'A @Keyword[stowed] blade.' });
    await new Promise((resolve) => setTimeout(resolve, 500));
    const inChat = document.querySelector(
      `#chat .message[data-message-id="${message.id}"] .vttf-keyword`,
    );

    // The journal was written on ready, before this test joined.
    const journal = game.journal.find(
      (entry) => entry.getFlag(game.system.id, 'vttforge.keywords') === true,
    );
    const pageContent = journal?.pages.contents[0]?.text.content ?? '';
    return {
      spans,
      unknownKept: holder.textContent.includes('@Keyword[unknown]'),
      inChat: inChat && {
        text: inChat.textContent,
        underline: getComputedStyle(inChat).textDecorationStyle,
      },
      journal: journal && {
        name: journal.name,
        pages: journal.pages.size,
        headings: [
          ...new DOMParser().parseFromString(pageContent, 'text/html').querySelectorAll('h2'),
        ].map((h) => h.textContent),
        terms: [
          ...new DOMParser().parseFromString(pageContent, 'text/html').querySelectorAll('dt'),
        ].map((dt) => dt.textContent),
      },
      journalsWithFlag: game.journal.filter(
        (entry) => entry.getFlag(game.system.id, 'vttforge.keywords') === true,
      ).length,
    };
  });

  expect(seen.spans).toEqual([
    { id: 'stowed', text: 'Stowed', tooltip: 'Packed away. Drawing it takes an action.' },
    { id: 'equipped', text: 'in hand', tooltip: 'In hand or worn, and ready to use.' },
  ]);
  expect(seen.unknownKept).toBe(true);
  expect(seen.inChat).toEqual({ text: 'Stowed', underline: 'dotted' });
  expect(seen.journal).toEqual({
    name: 'VTTForge Example System keywords',
    pages: 1,
    headings: ['Gear'],
    terms: ['Initiative', 'Equipped', 'Stowed'],
  });
  // One journal, however many times ready has fired.
  expect(seen.journalsWithFlag).toBe(1);
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

  const ourDeprecations = deprecations.filter((line) => /vttforge/i.test(line));
  expect(
    ourDeprecations,
    `deprecation warnings whose stack runs through VTTForge:\n${ourDeprecations.join('\n')}`,
  ).toEqual([]);
});
