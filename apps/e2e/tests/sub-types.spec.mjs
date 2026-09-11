/**
 * Getting a module's documents out before the module goes away.
 *
 * A module's sub-types travel with the module. Switch it off and every
 * document using one is invalid; uninstall it and they are stranded. The
 * conversion that rescues them is one update, and its shape is not guessable,
 * so this file checks the shape against a running Foundry rather than against
 * what the documentation describes.
 *
 * The claim under test is that a converted document keeps everything except
 * its type: the same id, the same flags, the same embedded documents.
 */
import { expect, test } from '@playwright/test';
import { baseUrl } from '../scripts/foundry.mjs';

const MODULE_ID = 'vttforge-example-module';
const NOTE_TYPE = `${MODULE_ID}.note`;

test.use({ viewport: { width: 1600, height: 1000 } });

const consoleErrors = [];

test.beforeEach(async ({ page }) => {
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
});

async function joinWithModule(page) {
  const join = async () => {
    await page.goto(`${baseUrl()}/join`);
    await page.waitForSelector('form[name=join] input[name=username]');
    await page.fill('form[name=join] input[name=username]', 'Gamemaster');
    await page.click('form[name=join] button[name=join]');
    await page.waitForURL('**/game');
    await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 90_000 });
  };
  await join();
  if (await page.evaluate((id) => game.modules.get(id)?.active === true, MODULE_ID)) return;
  await page.evaluate(async (id) => {
    const configuration = game.settings.get('core', 'moduleConfiguration');
    await game.settings.set('core', 'moduleConfiguration', { ...configuration, [id]: true });
  }, MODULE_ID);
  await join();
}

test('a type change without the replacement operator is refused, and takes the rest with it', async ({
  page,
}) => {
  await joinWithModule(page);

  const refused = await page.evaluate(async (type) => {
    const item = await Item.implementation.create({ name: 'Untouched', type });
    try {
      await item.update({ type: 'base', name: 'Renamed' });
    } catch {
      // Foundry rejects it inside the update; the throw is not the point.
    }
    return { type: item.type, name: item.name };
  }, NOTE_TYPE);

  // The reason convertSubTypes exists. Not only did the type not change, the
  // rename in the same call was dropped too.
  expect(refused.type).toBe(NOTE_TYPE);
  expect(refused.name).toBe('Untouched');
});

test('converting keeps the id, the flags and the embedded documents', async ({ page }) => {
  await joinWithModule(page);

  const before = await page.evaluate(
    async ({ moduleId, type }) => {
      for (const item of [...game.items]) await item.delete();
      const note = await Item.implementation.create({
        name: 'Player Handbook',
        type,
        system: { body: 'chapter one' },
      });
      await note.setFlag(moduleId, 'origin', 'imported');
      return {
        id: note.id,
        count: game.items.size,
        counted: game.modules.get(moduleId).api.countNotes(),
      };
    },
    { moduleId: MODULE_ID, type: NOTE_TYPE },
  );

  expect(before.counted).toBe(1);

  const after = await page.evaluate(async (moduleId) => {
    const result = await game.modules.get(moduleId).api.convertNotes();
    const item = game.items.contents[0];
    return {
      result,
      count: game.items.size,
      id: item.id,
      name: item.name,
      type: item.type,
      system: { ...item.system },
      flag: item.getFlag(moduleId, 'origin'),
      counted: game.modules.get(moduleId).api.countNotes(),
    };
  }, MODULE_ID);

  expect(after.result).toEqual({ converted: 1, failed: [] });
  // Converted in place: one document before, one after, same id.
  expect(after.count).toBe(before.count);
  expect(after.id).toBe(before.id);
  expect(after.type).toBe('base');
  expect(after.name).toBe('Player Handbook');
  // A core type stores system as a plain object, so the data survives even
  // though nothing reads it any more.
  expect(after.system).toMatchObject({ body: 'chapter one' });
  expect(after.flag).toBe('imported');
  // And nothing is left to strand.
  expect(after.counted).toBe(0);
});

test('an actor keeps the items it carries', async ({ page }) => {
  await joinWithModule(page);

  const kept = await page.evaluate(async (type) => {
    const actorType = Object.keys(CONFIG.Actor.dataModels)[0];
    const actor = await Actor.implementation.create({ name: 'Carrier', type: actorType });
    await actor.createEmbeddedDocuments('Item', [{ name: 'carried note', type }]);
    const id = actor.id;
    await actor.update({ type: 'base', system: _replace({ rescued: true }) });
    return {
      sameId: actor.id === id,
      type: actor.type,
      items: actor.items.size,
      system: { ...actor.system },
    };
  }, NOTE_TYPE);

  expect(kept.sameId).toBe(true);
  expect(kept.type).toBe('base');
  expect(kept.items).toBe(1);
  expect(kept.system).toEqual({ rescued: true });
});

test.afterAll(() => {
  // The refusal above is logged by Foundry as an error, and it is the
  // behaviour under test rather than a fault of ours.
  const ours = consoleErrors.filter(
    (line) => /vttforge|VTTF-\d{4}/i.test(line) && !/ForcedReplacement/.test(line),
  );
  expect(ours, `console errors naming VTTForge:\n${ours.join('\n')}`).toEqual([]);
});
