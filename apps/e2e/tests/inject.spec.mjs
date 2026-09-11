/**
 * Putting a module's own UI inside an application it does not own.
 *
 * The failure worth catching is the repeat: Foundry re-renders a directory
 * whenever its contents change, so an injection that does not clean up after
 * itself ends up with one button per render. A unit test can show that with a
 * fake hook; only a real world shows it with real re-renders, triggered the
 * way a user triggers them.
 */
import { expect, test } from '@playwright/test';
import { baseUrl } from '../scripts/foundry.mjs';

const MODULE_ID = 'vttforge-example-module';
const BUTTON = '.vttforge-example-new-note';

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

test('the button is in the sidebar, once, and stays once across re-renders', async ({ page }) => {
  await joinWithModule(page);

  const counts = await page.evaluate(async () => {
    const directory = ui.items;
    const count = () => directory.element.querySelectorAll('.vttforge-example-new-note').length;

    await directory.render({ force: true });
    await new Promise((resolve) => setTimeout(resolve, 400));
    const first = count();

    // What a user does. Every creation re-renders the directory.
    for (let i = 0; i < 3; i += 1) {
      await Item.implementation.create({ name: `Churn ${i}`, type: 'gear' });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return {
      first,
      afterChurn: count(),
      marker: directory.element
        .querySelector('.vttforge-example-new-note')
        ?.getAttribute('data-vttforge-injection'),
    };
  });

  expect(counts.first).toBe(1);
  // Three more renders, still one button.
  expect(counts.afterChurn).toBe(1);
  expect(counts.marker).toBe(`${MODULE_ID}.newNote`);
});

test('the button creates a note through the module api', async ({ page }) => {
  await joinWithModule(page);

  const before = await page.evaluate(async () => {
    // Two things stand between the button and a click. The sidebar starts
    // collapsed to a 48px rail, which leaves the tab bodies off the right
    // edge of the window: the button is in the DOM and reports itself
    // visible, and it still cannot be clicked. And the sidebar renders every
    // tab at once but shows one, so the items tab has to be in front.
    ui.sidebar.expand();
    ui.sidebar.changeTab('items', 'primary');
    await new Promise((resolve) => setTimeout(resolve, 600));
    return game.items.filter((item) => item.name === 'New note').length;
  });

  await page.click(BUTTON);
  await page.waitForTimeout(1200);

  const after = await page.evaluate(
    (id) =>
      game.items.filter((item) => item.type === `${id}.note` && item.name === 'New note').length,
    MODULE_ID,
  );
  expect(after).toBe(before + 1);
});
