/**
 * The socket helper, with two people in the world.
 *
 * Every other test here drives one browser. A socket cannot be proved that
 * way: the thing it does is carry a message from one client to another, and a
 * single context can only watch itself. So this file opens two, a Gamemaster
 * and a player, against the same running world.
 *
 * What one context could never show:
 *
 * - a message reaching the other client at all
 * - the sender's own copy running as well, which is what stops a lone GM from
 *   seeing nothing happen
 * - a player's message being dropped, because the check reads the sender id
 *   the server supplied rather than anything in the payload
 * - a player getting a world document written, which they have no permission
 *   to write themselves
 */
import { expect, test } from '@playwright/test';
import { baseUrl } from '../scripts/foundry.mjs';

const MODULE_ID = 'vttforge-example-module';
const PLAYER_NAME = 'Tester';

/** Foundry refuses to lay out below 1024x700 and says so in a banner. */
const VIEWPORT = { width: 1600, height: 1000 };

const consoleErrors = [];

/** Open a browser of its own and join the running world as `name`. */
async function join(browser, name) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`${name}: ${message.text()}`);
  });
  page.on('pageerror', (error) => consoleErrors.push(`${name}: ${String(error)}`));
  await page.goto(`${baseUrl()}/join`);
  await page.waitForSelector('form[name=join] input[name=username]');
  await page.fill('form[name=join] input[name=username]', name);
  await page.click('form[name=join] button[name=join]');
  await page.waitForURL('**/game');
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 90_000 });
  return page;
}

/**
 * The two clients, opened once for the whole file.
 *
 * Foundry allows a user one session: logging in again as the Gamemaster boots
 * the window that was already there. So the table is set up in `beforeAll`
 * and every test shares it, rather than each test joining again.
 */
let gm;
let player;

test.beforeAll(async ({ browser }) => {
  gm = await join(browser, 'Gamemaster');

  // Enabling a module needs a world reload before Foundry loads its scripts.
  const wasActive = await gm.evaluate(async (id) => {
    const configuration = game.settings.get('core', 'moduleConfiguration');
    if (configuration[id] === true) return true;
    await game.settings.set('core', 'moduleConfiguration', { ...configuration, [id]: true });
    return false;
  }, MODULE_ID);
  if (!wasActive) {
    await gm.context().close();
    gm = await join(browser, 'Gamemaster');
  }

  // The player has to exist before anyone can log in as them.
  await gm.evaluate(async (name) => {
    if (!game.users.find((user) => user.name === name)) {
      await User.implementation.create({ name, role: 1 });
    }
  }, PLAYER_NAME);

  player = await join(browser, PLAYER_NAME);
});

test.afterAll(async () => {
  await player?.context().close();
  await gm?.context().close();
});

/** Give the server a moment to relay, then read the marker the handler sets. */
async function announced(page) {
  await page.waitForTimeout(1500);
  return page.evaluate(() => globalThis.vttforgeExampleAnnounced);
}

test('the manifest declares the channel, and both clients agree on it', async () => {
  for (const page of [gm, player]) {
    const seen = await page.evaluate(
      (id) => ({
        active: game.modules.get(id)?.active,
        socket: game.modules.get(id)?.socket,
        api: Object.keys(game.modules.get(id)?.api ?? {}).sort(),
        query: typeof CONFIG.queries?.[`${id}.createNote`],
      }),
      MODULE_ID,
    );
    expect(seen.active).toBe(true);
    // Without this field Foundry accepts the emit and delivers nothing.
    expect(seen.socket).toBe(true);
    expect(seen.api).toEqual([
      'announce',
      'convertNotes',
      'countNotes',
      'createNote',
      'noteType',
      'requestNote',
    ]);
    // Requests live in one namespace shared by everything installed, so the
    // name carries the module id.
    expect(seen.query).toBe('function');
  }
});

test('a message from the Gamemaster reaches the player and the Gamemaster', async () => {
  await gm.evaluate((id) => game.modules.get(id).api.announce('rocks fall'), MODULE_ID);

  expect(await announced(player)).toBe('rocks fall');
  // The sender's own copy. Foundry does not deliver a message back to whoever
  // sent it, so without this a Gamemaster alone in a world sees nothing.
  expect(await announced(gm)).toBe('rocks fall');
});

test('the same message from a player is dropped, whatever the payload claims', async () => {
  await gm.evaluate(() => {
    globalThis.vttforgeExampleAnnounced = 'unchanged';
  });
  await player.evaluate((id) => game.modules.get(id).api.announce('players cannot'), MODULE_ID);
  expect(await announced(gm)).toBe('unchanged');

  // And by hand, straight down the channel, with a forged sender in the
  // payload. The server appends the real one as the second argument, and that
  // is the only one read.
  await player.evaluate((id) => {
    const gmUser = game.users.find((user) => user.isGM);
    game.socket.emit(`module.${id}`, {
      name: 'announce',
      payload: { text: 'forged', userId: gmUser.id },
    });
  }, MODULE_ID);
  expect(await announced(gm)).toBe('unchanged');
});

test('a player gets a world item written by asking the Gamemaster', async () => {
  const before = await gm.evaluate(() => game.items.size);
  const created = await player.evaluate(
    (id) => game.modules.get(id).api.requestNote('From a player', 'body'),
    MODULE_ID,
  );

  expect(created).toBeTruthy();
  await gm.waitForTimeout(800);
  expect(await gm.evaluate(() => game.items.size)).toBe(before + 1);

  const item = await gm.evaluate((itemId) => {
    const found = game.items.get(itemId);
    return { type: found?.type, body: found?.system?.body };
  }, created);
  expect(item.type).toBe(`${MODULE_ID}.note`);
  // The handler ran on the Gamemaster's client and was told who asked.
  expect(item.body).toBe(`body (asked for by ${PLAYER_NAME})`);
});

test('a player cannot write that item themselves', async () => {
  // The reason askGm exists. Foundry refuses the write, which is what a
  // module would otherwise discover from a bug report.
  const refused = await player.evaluate(async (id) => {
    try {
      await CONFIG.Item.documentClass.create({ name: 'Direct', type: `${id}.note` });
      return 'created';
    } catch (error) {
      return String(error.message ?? error).slice(0, 120);
    }
  }, MODULE_ID);
  expect(refused).not.toBe('created');
});

test.afterAll(() => {
  const ours = consoleErrors.filter((line) => /vttforge|VTTF-\d{4}/i.test(line));
  expect(ours, `console errors naming VTTForge:\n${ours.join('\n')}`).toEqual([]);
});
