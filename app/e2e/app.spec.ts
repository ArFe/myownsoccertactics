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
    // Headless Chromium reads WebGL canvases back to draw the page, and its GPU
    // driver logs that as a "GL Driver Message". It is not the app's doing.
    if (m.text().includes('GL Driver Message')) return;
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
  await expect(page.getByLabel('Board name', { exact: true })).toHaveValue('Board 1');
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
  await page.getByLabel('Board name', { exact: true }).fill('Build-out line');
  await expect(page.locator('.boards li')).toHaveCount(2);

  // Switch back to the first board.
  await page.locator('.boards').getByRole('button', { name: /Board 1/ }).click();
  await expect(page.getByLabel('Board name', { exact: true })).toHaveValue('Board 1');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download save' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^my-tactics_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.tactics\.json$/);
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
  await page.getByLabel('Board name', { exact: true }).fill('Build-up vs 4-4-2');
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PNG' }).click(),
  ]);
  expect(png.suggestedFilename()).toMatch(/^build-up-vs-4-4-2_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/);
  const bytes = await readFile(await png.path());
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1600); // width from the PNG header

  await page.getByRole('button', { name: 'New 11v11 board' }).click();
  await page.getByRole('button', { name: 'My tactics' }).click();
  const [zip] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PNGs (.zip)' }).click(),
  ]);
  expect(zip.suggestedFilename()).toMatch(/^my-tactics-images_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.zip$/);
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

test('records a play in steps, plays it back, and shows a cone on one step only', async ({ page }) => {
  const bar = page.getByTestId('plays');
  await bar.getByRole('button', { name: 'New play' }).click();
  await bar.getByRole('button', { name: 'Add step' }).click();

  // Move a player on step 2; the board as drawn keeps the old place.
  const p = (await state(page)).board.players[5]!;
  await dragWorld(page, [p.x, p.y], [p.x + 15, p.y]);
  const plays = () =>
    page.evaluate(() => {
      const s = (window as any).__tactics.store;
      return JSON.parse(JSON.stringify({ play: s.openPlay, frame: s.frame, playTime: s.playTime }));
    });
  let { play, frame } = await plays();
  expect(play.steps).toHaveLength(2);
  expect(play.steps[1].players[p.id].x).toBeCloseTo(p.x + 15, 0);
  expect((await state(page)).board.players[5]!.x).toBe(p.x);
  expect(frame.players[5].x).toBeCloseTo(p.x + 15, 0);

  // A cone placed now shows on every step until told otherwise.
  await page.getByRole('button', { name: 'Cone' }).click();
  const at = await screenPoint(page, 30, 20);
  await page.mouse.click(at.x, at.y);
  await page.getByRole('button', { name: 'Select' }).click();
  await page.mouse.click(at.x, at.y - 2);
  await page.getByTestId('step-visibility').getByRole('button', { name: 'Only step 2' }).click();
  await bar.getByRole('button', { name: 'Step 1', exact: true }).click();
  ({ frame } = await plays());
  expect(frame.cones).toHaveLength(0);

  // Play from step 1: it moves, then stops on the last step.
  await bar.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(bar.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 6000 });
  ({ frame } = await plays());
  expect(frame.players[5].x).toBeCloseTo(p.x + 15, 0);
  expect(frame.cones).toHaveLength(1);
  await expect(bar.getByRole('button', { name: 'Step 2', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // The play is in the save.
  await page.waitForTimeout(700);
  await page.reload();
  await bar.getByLabel('Play').selectOption({ label: 'Play 1 · 2 steps' });
  ({ play } = await plays());
  expect(play.steps[1].hidden).toHaveLength(0);
  expect(play.steps[0].hidden).toHaveLength(1);
});

test('downloads a play as GIF, WebM and MP4', async ({ page }) => {
  const bar = page.getByTestId('plays');
  await bar.getByRole('button', { name: 'New play' }).click();
  await bar.getByRole('button', { name: 'Add step' }).click();
  const p = (await state(page)).board.players[5]!;
  await dragWorld(page, [p.x, p.y], [p.x + 15, p.y]);
  await bar.getByLabel('Seconds to get to step 2').fill('0.5');
  await bar.getByLabel('Seconds to get to step 2').press('Tab');

  const magic: Record<string, (b: Buffer) => boolean> = {
    GIF: (b) => b.subarray(0, 6).toString('latin1') === 'GIF89a',
    WebM: (b) => b.readUInt32BE(0) === 0x1a45dfa3,
    MP4: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp',
  };
  const made: string[] = [];
  for (const label of ['GIF', 'WebM', 'MP4']) {
    const button = bar.getByRole('button', { name: label, exact: true });
    // GIF works everywhere; the videos need WebCodecs with that codec.
    if (label !== 'GIF' && (await button.isDisabled())) continue;
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), button.click()]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`^board-1-play-1_\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}\\.${label.toLowerCase()}$`));
    const bytes = await readFile((await download.path())!);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(magic[label]!(bytes), `${label} header`).toBe(true);
    made.push(label);
  }
  console.log('made', made.join(', '));
  expect(made).toContain('WebM');
});

test('shows the board in 3D, with an orbit and a player’s-eye camera, and plays a play there', async ({ page }) => {
  const bar = page.getByTestId('plays');
  await bar.getByRole('button', { name: 'New play' }).click();
  await bar.getByRole('button', { name: 'Add step' }).click();
  const p = (await state(page)).board.players[5]!;
  await dragWorld(page, [p.x, p.y], [p.x + 10, p.y]);
  await bar.getByLabel('Seconds to get to step 2').fill('0.5');
  await bar.getByLabel('Seconds to get to step 2').press('Tab');

  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: '3D' }).click();
  const view = page.getByTestId('pitch-3d');
  const canvas = view.getByRole('img', { name: '3D view of the board' });
  await expect(canvas).toBeVisible();
  expect((await canvas.boundingBox())!.width).toBeGreaterThan(300);
  await expect(page.getByTestId('pitch')).toHaveCount(0);

  // Orbit: drag to turn, then reset.
  const box = (await canvas.boundingBox())!;
  await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: box.x + box.width / 2 + 120, y: box.y + box.height / 2 });
  await view.getByRole('button', { name: 'Reset view' }).click();

  // Player's eye: pick a player and look around.
  await view.getByRole('button', { name: "Player's eye" }).click();
  await view.getByLabel('Eye of player').selectOption({ label: 'Away 9' });
  await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: box.x + box.width / 2 - 80, y: box.y + box.height / 2 + 20 });
  // Zoom: the wheel and the buttons, down to the limit.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  const zoomIn = view.getByRole('button', { name: 'Zoom in' });
  for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) await zoomIn.click();
  await expect(zoomIn).toBeDisabled();
  await view.getByRole('button', { name: 'Zoom out' }).click();
  await expect(zoomIn).toBeEnabled();

  // The play runs in 3D too.
  await bar.getByRole('button', { name: 'Step 1', exact: true }).click();
  await bar.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(bar.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 6000 });
  await expect(bar.getByRole('button', { name: 'Step 2', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: '2D' }).click();
  await expect(page.getByTestId('pitch')).toBeVisible();
});

/** Width and height of a PNG, from its header. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('zooms the field with the buttons, the keys and Ctrl + wheel, and dragging still works', async ({ page }) => {
  const canvasWidth = async () => (await page.locator('[data-testid="pitch"] .konvajs-content').boundingBox())!.width;
  const fit = await canvasWidth();
  const zoom = page.getByRole('group', { name: 'Zoom' });
  await zoom.getByRole('button', { name: 'Zoom in' }).click();
  await zoom.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoom.getByRole('button', { name: 'Fit the field' })).toHaveText('150%');
  expect(await canvasWidth()).toBeCloseTo(fit * 1.5, -1);

  // Drag the player nearest the middle, which stays in view.
  const { board } = await state(page);
  const mid = [...board.players].sort((a, b) => Math.hypot(a.x - 52.5, a.y - 34) - Math.hypot(b.x - 52.5, b.y - 34))[0]!;
  await dragWorld(page, [mid.x, mid.y], [mid.x + 3, mid.y + 2]);
  const moved = (await state(page)).board.players.find((p) => p.id === mid.id)!;
  expect(moved.x).toBeCloseTo(mid.x + 3, 0);
  expect(moved.y).toBeCloseTo(mid.y + 2, 0);

  await page.keyboard.press('0');
  await expect(zoom.getByRole('button', { name: 'Fit the field' })).toHaveText('100%');
  await page.keyboard.press('+');
  await expect(zoom.getByRole('button', { name: 'Fit the field' })).toHaveText('125%');
  await page.keyboard.press('-');
  await expect(zoom.getByRole('button', { name: 'Zoom out' })).toBeDisabled();

  const box = (await page.getByTestId('stage-host').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect(zoom.getByRole('button', { name: 'Fit the field' })).toHaveText('125%');
});

test('puts the board name as a title on the PNG when asked, and remembers it', async ({ page }) => {
  const download = async () => {
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PNG' }).click()]);
    return pngSize(await readFile((await d.path())!));
  };
  const plain = await download();
  await page.getByRole('button', { name: 'PNG options' }).click();
  await page.getByLabel('Board name as a title').check();
  await page.keyboard.press('Escape');
  const titled = await download();
  expect(titled.width).toBe(plain.width);
  expect(titled.height).toBeGreaterThan(plain.height + 40);

  await page.reload();
  await page.getByRole('button', { name: 'PNG options' }).click();
  await expect(page.getByLabel('Board name as a title')).toBeChecked();
});

test('game day: one team, times with colours, subs on the bench and in the PNG', async ({ page }) => {
  const canvasHeight = async () => (await page.locator('[data-testid="pitch"] .konvajs-content').boundingBox())!.height;
  const before = await canvasHeight();
  await page.getByRole('button', { name: 'Game day: off' }).click();
  let { board } = await state(page);
  expect(board.gameDay.on).toBe(true);
  expect(board.teams.away.visible).toBe(false);
  // The bench sits under the field.
  expect(await canvasHeight()).toBeGreaterThan(before - 1);

  const card = page.getByTestId('game-day');
  await card.getByRole('button', { name: 'Add a time' }).click();
  await card.getByLabel('Minute of time 1').fill('20');
  await card.getByLabel('Minute of time 1').press('Tab');
  await card.getByRole('button', { name: 'Add a sub' }).click();
  const sub = card.getByTestId('sub-12');
  await sub.getByLabel('Sub name').fill('Ana');
  await sub.getByLabel('Comes on for').selectOption({ label: 'for 9' });
  await sub.getByLabel('Time').selectOption({ label: "20'" });
  await card.getByRole('group', { name: 'Show subs' }).getByRole('button', { name: 'Both' }).click();

  ({ board } = await state(page));
  const nine = board.players.find((p) => p.team === 'home' && p.number === 9)!;
  expect(board.waves).toMatchObject([{ minute: 20 }]);
  expect(board.subs).toMatchObject([{ number: 12, name: 'Ana', replaces: nine.id, waveId: board.waves[0]!.id }]);
  expect(board.gameDay.subsShown).toBe('both');

  // The PNG has the bench too: taller than the field alone.
  const pngHeight = async () => {
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PNG' }).click()]);
    return pngSize(await readFile((await d.path())!)).height;
  };
  const withBench = await pngHeight();
  await page.getByRole('button', { name: 'Game day: on' }).click();
  ({ board } = await state(page));
  expect(board.teams.away.visible).toBe(true);
  expect(board.subs).toHaveLength(1); // the plan is kept
  expect(withBench).toBeGreaterThan(await pngHeight());
});
