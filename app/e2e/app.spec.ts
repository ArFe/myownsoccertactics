import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { makeView, toScreen } from '../src/model/view';
import { getSport } from '../src/model/sports';
import type { Board, SaveFile } from '../src/model/types';

// ---------- helpers ----------

async function state(page: Page): Promise<{ save: SaveFile; board: Board }> {
  return page.evaluate(() => {
    const store = (window as any).__tactics.store;
    return JSON.parse(JSON.stringify({ save: store.save, board: store.board }));
  });
}

/** Page coordinates of a point on the field (in metres). */
async function screenPoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = (await page.locator('[data-testid="pitch"] .konvajs-content').boundingBox())!;
  const { board } = await state(page);
  const view = makeView(board.field, getSport(board.sport).runoff(board.field), box.width + 0.5, box.height + 0.5);
  const p = toScreen(view, x, y);
  return { x: box.x + p.x, y: box.y + p.y };
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

async function dragWorld(page: Page, a: [number, number], b: [number, number]): Promise<void> {
  await drag(page, await screenPoint(page, ...a), await screenPoint(page, ...b));
}

let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  await page.goto('/');
  await expect(page.locator('[data-testid="pitch"] canvas').first()).toBeVisible();
});

test.afterEach(() => {
  expect(consoleErrors, 'console errors or warnings').toEqual([]);
});

// ---------- tests ----------

test('opens with one 11v11 board, 4-3-3 against 4-4-2', async ({ page }) => {
  await expect(page.getByLabel('Board name')).toHaveValue('Board 1');
  await expect(page.getByText('11v11 · 105 × 68 m')).toBeVisible();
  const { board } = await state(page);
  expect(board.players).toHaveLength(22);
  expect(board.teams.home.formation).toBe('4-3-3');
});

test('drags a player, and the move survives a reload', async ({ page }) => {
  const gk = (await state(page)).board.players[0]!;
  await dragWorld(page, [gk.x, gk.y], [gk.x + 10, gk.y + 5]);
  const moved = (await state(page)).board.players[0]!;
  expect(moved.x).toBeCloseTo(gk.x + 10, 0);
  expect(moved.y).toBeCloseTo(gk.y + 5, 0);

  await page.waitForTimeout(700); // autosave delay
  await page.reload();
  const after = (await state(page)).board.players[0]!;
  expect(after.x).toBeCloseTo(moved.x, 1);
});

test('double-clicking a player lets you type their name', async ({ page }) => {
  const gk = (await state(page)).board.players[0]!;
  const p = await screenPoint(page, gk.x, gk.y);
  await page.mouse.dblclick(p.x, p.y);
  const name = page.getByPlaceholder('Name');
  await expect(name).toBeFocused();
  await page.keyboard.type('Keller');
  expect((await state(page)).board.players[0]!.name).toBe('Keller');
});

test('draws a rectangle area and edits it', async ({ page }) => {
  await page.getByRole('button', { name: 'Rectangle' }).click();
  await dragWorld(page, [72, 22.7], [88.5, 45.3]);
  let { board } = await state(page);
  expect(board.areas).toHaveLength(1);
  expect(board.areas[0]!.w).toBeCloseTo(16.5, 0);
  expect(board.areas[0]!.h).toBeCloseTo(22.6, 0);

  // The Selection panel opens for the new area.
  await expect(page.getByRole('tab', { name: 'Selection' })).toHaveAttribute('aria-selected', 'true');
  const name = page.locator('#panel-selection').getByLabel('Name', { exact: true });
  await name.fill('Zone 14');
  await page.getByRole('button', { name: 'Red', exact: true }).click();
  ({ board } = await state(page));
  expect(board.areas[0]).toMatchObject({ name: 'Zone 14', color: '#EF4444' });

  // Move it by dragging inside.
  const before = board.areas[0]!;
  await dragWorld(page, [80, 40], [70, 40]);
  ({ board } = await state(page));
  expect(board.areas[0]!.x).toBeCloseTo(before.x - 10, 0);

  // Delete removes it.
  await page.keyboard.press('Delete');
  expect((await state(page)).board.areas).toHaveLength(0);
});

test('draws a polygon with clicks and Enter', async ({ page }) => {
  await page.keyboard.press('p');
  for (const [x, y] of [
    [60, 5],
    [80, 5],
    [70, 20],
  ] as const) {
    const s = await screenPoint(page, x, y);
    await page.mouse.click(s.x, s.y); // quick clicks, like a real user
  }
  await page.keyboard.press('Enter');
  const { board } = await state(page);
  expect(board.areas).toHaveLength(1);
  expect(board.areas[0]!.shape).toBe('polygon');
  expect(board.areas[0]!.points).toHaveLength(6);
});

test('draws pass and run arrows, places a cone and a note', async ({ page }) => {
  await page.getByRole('button', { name: 'Arrow' }).click();
  await dragWorld(page, [40, 30], [60, 15]);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await dragWorld(page, [60, 55], [85, 45]);
  let { board } = await state(page);
  expect(board.arrows.map((a) => a.kind)).toEqual(['pass', 'run']);

  await page.keyboard.press('c');
  const c = await screenPoint(page, 30, 60);
  await page.mouse.click(c.x, c.y);
  await page.keyboard.press('t');
  const t = await screenPoint(page, 20, 5);
  await page.mouse.click(t.x, t.y);
  await page.locator('#panel-selection textarea').fill('Press here');
  ({ board } = await state(page));
  expect(board.cones).toHaveLength(1);
  expect(board.texts[0]!.text).toBe('Press here');
});

test('undo and redo from the keyboard and the buttons', async ({ page }) => {
  await page.getByRole('button', { name: 'Ellipse' }).click();
  await dragWorld(page, [10, 10], [20, 20]);
  expect((await state(page)).board.areas).toHaveLength(1);
  await page.keyboard.press('ControlOrMeta+z');
  expect((await state(page)).board.areas).toHaveLength(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  expect((await state(page)).board.areas).toHaveLength(1);
});

test('switches to 7v7 and to a vertical field', async ({ page }) => {
  await page.getByRole('tab', { name: 'Field' }).click();
  await page.getByRole('button', { name: /7v7/ }).first().click();
  let { board } = await state(page);
  expect(board.players).toHaveLength(14);
  await expect(page.getByText('7v7 · 55 × 36 m')).toBeVisible();

  await page.getByRole('button', { name: 'Vertical' }).click();
  const box = (await page.locator('[data-testid="pitch"] .konvajs-content').boundingBox())!;
  expect(box.height).toBeGreaterThan(box.width);

  // Dragging still lands in the right place when the field is upright.
  const gk = board.players[0]!;
  await dragWorld(page, [gk.x, gk.y], [gk.x + 6, gk.y - 4]);
  ({ board } = await state(page));
  expect(board.players[0]!.x).toBeCloseTo(gk.x + 6, 0);
  expect(board.players[0]!.y).toBeCloseTo(gk.y - 4, 0);
});

test('custom field size stretches the board', async ({ page }) => {
  await page.getByRole('tab', { name: 'Field' }).click();
  const length = page.getByLabel('Length (m)');
  await length.fill('80');
  await length.press('Enter');
  await expect(page.getByText('Custom · 80 × 68 m')).toBeVisible();
});

test('keeps many boards in one save, downloads and uploads it', async ({ page }) => {
  await page.getByRole('button', { name: 'New 7v7 board' }).click();
  await page.getByLabel('Board name').fill('Build-out line');
  await expect(page.locator('.boards li')).toHaveCount(2);

  // Switch back to the first board.
  await page.locator('.boards').getByRole('button', { name: /Board 1/ }).click();
  await expect(page.getByLabel('Board name')).toHaveValue('Board 1');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download save' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('my-tactics.tactics.json');
  const file = await download.path();
  const saved = JSON.parse(await readFile(file, 'utf8')) as SaveFile;
  expect(saved.boards.map((b) => b.name)).toEqual(['Board 1', 'Build-out line']);

  // Upload it back, adding its boards.
  await page.getByRole('button', { name: 'My tactics' }).click();
  await page.getByTestId('upload-input').setInputFiles(file);
  await expect(page.getByText('Added 2 boards.')).toBeVisible();
  expect((await state(page)).save.boards).toHaveLength(4);
});

test('rejects a file that is not a save', async ({ page }) => {
  await page.getByRole('button', { name: 'My tactics' }).click();
  await page.getByTestId('upload-input').setInputFiles({
    name: 'other.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello": 1}'),
  });
  await expect(page.getByRole('alert')).toHaveText('This file is not a Tactics Board save.');
});

test('downloads the board as a PNG and all boards as a zip', async ({ page }) => {
  await page.getByLabel('Board name').fill('Build-up vs 4-4-2');
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PNG' }).click(),
  ]);
  expect(png.suggestedFilename()).toBe('build-up-vs-4-4-2.png');
  const bytes = await readFile(await png.path());
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1600); // width from the PNG header

  await page.getByRole('button', { name: 'New 11v11 board' }).click();
  await page.getByRole('button', { name: 'My tactics' }).click();
  const [zip] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PNGs (.zip)' }).click(),
  ]);
  expect(zip.suggestedFilename()).toBe('my-tactics-images.zip');
  const zipBytes = await readFile(await zip.path());
  expect(zipBytes.subarray(0, 2).toString()).toBe('PK');
});

test('saves starting positions and loads them on another board, even after a reload', async ({ page }) => {
  const gk = (await state(page)).board.players[0]!;
  await dragWorld(page, [gk.x, gk.y], [gk.x + 20, gk.y]);
  const moved = (await state(page)).board.players[0]!;

  // Dragging selected the keeper, which opened the Selection tab.
  await page.getByRole('tab', { name: 'Teams' }).click();
  const card = page.getByTestId('positions');
  await card.getByLabel('Save current positions as').fill('Build-up shape');
  await card.getByRole('group', { name: 'Teams to save' }).getByRole('button', { name: 'Home' }).click();
  await card.getByRole('button', { name: 'Save positions' }).click();
  await expect(page.getByText('Saved "Build-up shape".')).toBeVisible();

  await page.waitForTimeout(700); // autosave
  await page.reload();
  await page.getByRole('button', { name: 'New 11v11 board' }).click();
  await page.getByRole('tab', { name: 'Teams' }).click();

  // Home onto Home: the keeper goes back where it was saved.
  await expect(card.getByLabel('Saved positions', { exact: true })).toContainText('Build-up shape · home · 11 players · ball');
  await expect(card.getByLabel('Also move the ball')).toBeChecked();
  await card.getByRole('button', { name: 'Load positions' }).click();
  let { board } = await state(page);
  expect(board.players.find((p) => p.team === 'home')!.x).toBeCloseTo(moved.x, 1);
  expect(board.teams.home.formation).toBe('Build-up shape');
  await expect(page.locator('[data-testid="team-home"] select')).toHaveValue('Build-up shape');

  // Home onto Away: turned around.
  await card.getByRole('group', { name: 'Load onto' }).getByRole('button', { name: 'Away' }).click();
  await card.getByRole('button', { name: 'Load positions' }).click();
  ({ board } = await state(page));
  const awayGk = board.players.find((p) => p.team === 'away')!;
  expect(awayGk.x).toBeCloseTo(105 - moved.x, 1);

  // The ball was saved too, and turned with the team.
  expect(board.ball.x).toBeCloseTo(105 - 52.5, 1);
  expect(board.ball.visible).toBe(true);

  // Undo brings the away team back.
  await page.getByRole('button', { name: 'Undo' }).click();
  ({ board } = await state(page));
  expect(board.players.find((p) => p.team === 'away')!.x).toBeGreaterThan(95);
});

test('changes player size, ball style, colour and size, and the styled ball can still be dragged', async ({ page }) => {
  const card = page.getByTestId('players-and-ball');
  await card.getByRole('group', { name: 'Player size' }).getByRole('button', { name: 'Extra large' }).click();
  await card.getByLabel('Ball style').selectOption({ label: 'Volleyball' });
  await card.getByLabel('Ball colour: Panel 2').fill('#ff0000');
  await card.getByRole('group', { name: 'Ball size' }).getByRole('button', { name: 'Large', exact: true }).click();
  let { board } = await state(page);
  expect(board.playerSize).toBe('xl');
  expect(board.ball).toMatchObject({ style: 'volleyball', size: 'l' });
  expect(board.ball.colors.panel2).toBe('#ff0000');

  // Drag the ball by its body; the click selects it and opens its settings.
  await dragWorld(page, [board.ball.x, board.ball.y], [board.ball.x + 8, board.ball.y + 6]);
  ({ board } = await state(page));
  expect(board.ball.x).toBeCloseTo(52.5 + 8, 0);
  expect(board.ball.y).toBeCloseTo(34 + 6, 0);
  await expect(page.locator('#panel-selection').getByLabel('Ball style')).toHaveValue('volleyball');
});
