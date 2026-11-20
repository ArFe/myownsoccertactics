import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSaveStore } from '@/stores/save';
import { createSave } from '@/model/factory';
import { STORAGE_KEY } from '@/model/persistence';

function freshStore() {
  setActivePinia(createPinia());
  return useSaveStore();
}

const home = (s: ReturnType<typeof useSaveStore>) => s.board.players.filter((p) => p.team === 'home');

describe('save store', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it('starts with one 11v11 board in 4-3-3 vs 4-4-2', () => {
    const s = freshStore();
    expect(s.save.boards).toHaveLength(1);
    expect(s.board.field.preset).toBe('11v11');
    expect(s.board.teams.home.formation).toBe('4-3-3');
    expect(s.board.teams.away.formation).toBe('4-4-2');
    expect(s.board.players).toHaveLength(22);
  });

  it('adds, duplicates and deletes boards, but keeps one', () => {
    const s = freshStore();
    const first = s.board.id;
    s.addBoard('7v7');
    expect(s.save.boards).toHaveLength(2);
    expect(s.board.players).toHaveLength(14);
    const copy = s.duplicateBoard(s.board.id)!;
    expect(s.board.id).toBe(copy);
    expect(s.save.boards).toHaveLength(3);
    // The copy has its own ids.
    const ids = new Set(s.save.boards[1]!.players.map((p) => p.id));
    expect(s.board.players.some((p) => ids.has(p.id))).toBe(false);
    s.deleteBoard(copy);
    s.deleteBoard(s.save.boards[1]!.id);
    expect(s.deleteBoard(first)).toBe(false);
    expect(s.save.boards).toHaveLength(1);
  });

  it('changes formation and keeps the names', () => {
    const s = freshStore();
    const gk = home(s)[0]!;
    s.updatePlayer(gk.id, { name: 'Keller' });
    s.applyFormation('home', '3-5-2');
    expect(s.board.teams.home.formation).toBe('3-5-2');
    expect(home(s)[0]!.name).toBe('Keller');
    expect(home(s).map((p) => p.role)).toContain('LWB');
  });

  it('switches 11v11 to 7v7 with smaller teams and keeps names in order', () => {
    const s = freshStore();
    s.updatePlayer(home(s)[1]!.id, { name: 'Brandt' });
    s.setPreset('7v7');
    expect(s.board.field.length).toBe(55);
    expect(home(s)).toHaveLength(7);
    expect(s.board.teams.home.formation).toBe('2-3-1');
    expect(home(s)[1]!.name).toBe('Brandt');
    for (const p of s.board.players) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(55);
    }
  });

  it('stretches everything with a custom size', () => {
    const s = freshStore();
    s.addArea({ shape: 'rect', x: 50, y: 30, w: 10, h: 10 });
    const before = { ...home(s)[0]! };
    s.setFieldSize(52.5, 34);
    expect(s.board.field.preset).toBe('custom');
    expect(home(s)[0]!.x).toBeCloseTo(before.x / 2);
    expect(s.board.areas[0]!.w).toBeCloseTo(5);
  });

  it('keeps a field size inside the limits', () => {
    const s = freshStore();
    s.setFieldSize(1000, 2);
    expect(s.board.field.length).toBe(130);
    expect(s.board.field.width).toBe(20);
  });

  it('keeps dragged players on the field and snaps with Shift', () => {
    const s = freshStore();
    const id = home(s)[0]!.id;
    s.movePlayer(id, -50, 500);
    expect(home(s)[0]!.x).toBe(-4);
    expect(home(s)[0]!.y).toBe(72);
    s.movePlayer(id, 10.4, 20.6, true);
    expect([home(s)[0]!.x, home(s)[0]!.y]).toEqual([10, 21]);
  });

  it('undoes and redoes changes, and merges typing', () => {
    const s = freshStore();
    s.renameBoard('B');
    s.renameBoard('Bu');
    s.renameBoard('Build');
    s.addArea({ shape: 'ellipse', x: 1, y: 1, w: 5, h: 5 });
    expect(s.canUndo).toBe(true);
    s.undo();
    expect(s.board.areas).toHaveLength(0);
    s.undo();
    expect(s.board.name).toBe('Board 1');
    s.redo();
    expect(s.board.name).toBe('Build');
    expect(s.canRedo).toBe(true);
  });

  it('does not count switching boards as a change', () => {
    const s = freshStore();
    const first = s.board.id;
    s.addBoard('11v11');
    s.setActiveBoard(first);
    s.undo(); // undoes the added board, not the switch
    expect(s.save.boards).toHaveLength(1);
    expect(s.board.id).toBe(first);
  });

  it('adds, edits and deletes areas, arrows, text and cones', () => {
    const s = freshStore();
    const a = s.addArea({ shape: 'polygon', points: [1, 1, 10, 1, 5, 8] });
    expect(s.selection).toEqual({ kind: 'area', id: a });
    s.updateArea(a, { name: 'Box', opacity: 0.5, w: -3 });
    expect(s.board.areas[0]).toMatchObject({ name: 'Box', opacity: 0.5, w: 0.5 });
    s.moveAreaBy(a, 2, 3);
    expect(s.board.areas[0]!.points).toEqual([3, 4, 12, 4, 7, 11]);
    s.duplicateArea(a);
    expect(s.board.areas).toHaveLength(2);
    s.deleteSelected();
    expect(s.board.areas).toHaveLength(1);

    s.arrowKind = 'run';
    const r = s.addArrow(0, 0, 10, 10);
    expect(s.board.arrows[0]).toMatchObject({ kind: 'run', color: '#FDE047' });
    s.updateArrow(r, { kind: 'pass' });
    expect(s.board.arrows[0]!.color).toBe('#FFFFFF');

    const t = s.addText(5, 5);
    s.updateText(t, { text: 'Press here' });
    expect(s.board.texts[0]!.text).toBe('Press here');
    s.addCone(3, 3);
    expect(s.board.cones).toHaveLength(1);

    s.select({ kind: 'player', id: home(s)[0]!.id });
    s.deleteSelected();
    expect(home(s)).toHaveLength(11); // players are never deleted
    s.select({ kind: 'ball', id: 'ball' });
    s.deleteSelected();
    expect(s.board.ball.visible).toBe(false);
  });

  it('imports by adding boards with new ids, or by replacing', () => {
    const s = freshStore();
    const incoming = createSave('Other');
    incoming.boards[0]!.name = 'Imported';
    s.importSave(incoming, 'add');
    expect(s.save.boards).toHaveLength(2);
    expect(s.board.name).toBe('Imported');
    expect(s.board.id).not.toBe(incoming.boards[0]!.id);
    s.importSave(incoming, 'replace');
    expect(s.save.name).toBe('Other');
    expect(s.save.boards).toHaveLength(1);
    s.undo();
    expect(s.save.boards).toHaveLength(2);
  });

  it('autosaves to the browser shortly after a change', () => {
    vi.useFakeTimers();
    const s = freshStore();
    s.renameBoard('Autosaved');
    return Promise.resolve().then(() => {
      vi.advanceTimersByTime(1000);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.boards[0].name).toBe('Autosaved');
      expect(s.lastSavedAt).not.toBeNull();
    });
  });

  it('loads the stored save on start', () => {
    const save = createSave('From before');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    const s = freshStore();
    expect(s.save.name).toBe('From before');
    expect(s.canUndo).toBe(false);
  });
});

describe('saved positions in the store', () => {
  beforeEach(() => localStorage.clear());

  it('saves, loads onto another board, renames and deletes, with undo', () => {
    const s = freshStore();
    s.movePlayer(home(s)[0]!.id, 30, 30);
    s.moveBall(52.5, 34);
    const id = s.savePositions('  Build-up shape ', ['home', 'away'])!;
    expect(s.positionSets.map((p) => p.name)).toEqual(['Build-up shape']);
    expect(s.savePositions('   ', ['home'])).toBeNull();

    s.addBoard('11v11');
    s.moveBall(10, 10);
    expect(home(s)[0]!.x).not.toBe(30);
    s.loadPositions(id, [{ from: 'home', to: 'home' }], { withNames: false, withBall: true });
    expect(s.board.ball).toMatchObject({ x: 52.5, y: 34 });
    expect([home(s)[0]!.x, home(s)[0]!.y]).toEqual([30, 30]);
    s.undo();
    expect(home(s)[0]!.x).not.toBe(30);

    s.renamePositions(id, 'Shape A');
    expect(s.positionSets[0]!.name).toBe('Shape A');
    s.deletePositions(id);
    expect(s.positionSets).toHaveLength(0);
    s.undo();
    expect(s.positionSets).toHaveLength(1);
  });

  it('adds saved positions from an uploaded file only once', () => {
    const s = freshStore();
    const other = createSave('Other');
    other.savedPositions.push({ id: 'set1', name: 'Corner', sport: 'soccer', home: [{ fx: 0.9, fy: 0.1, number: 9, name: '', role: 'ST' }], createdAt: '' });
    s.importSave(other, 'add');
    s.importSave(other, 'add');
    expect(s.save.savedPositions.map((p) => p.name)).toEqual(['Corner']);
  });
});

describe('ball and player sizes in the store', () => {
  beforeEach(() => localStorage.clear());

  it('changes the ball style with its default colours, then one colour, size, and undo', () => {
    const s = freshStore();
    expect(s.board.ball).toMatchObject({ style: 'soccer', size: 'm' });
    s.setBallStyle('volleyball');
    expect(s.board.ball.colors).toEqual({ panel1: '#FFFFFF', panel2: '#1E5AA8', panel3: '#FFD23F' });
    s.setBallColor('panel2', '#123456');
    s.setBallColor('patches', '#000000'); // not a volleyball slot: ignored
    expect(s.board.ball.colors).toEqual({ panel1: '#FFFFFF', panel2: '#123456', panel3: '#FFD23F' });
    s.setBallSize('xl');
    expect(s.board.ball.size).toBe('xl');
    s.undo();
    s.undo();
    expect(s.board.ball).toMatchObject({ style: 'volleyball', size: 'm' });
    expect(s.board.ball.colors.panel2).toBe('#1E5AA8');
  });

  it('sets one player size for the board', () => {
    const s = freshStore();
    expect(s.board.playerSize).toBe('m');
    s.setPlayerSize('s');
    expect(s.board.playerSize).toBe('s');
    s.addBoard('7v7');
    expect(s.board.playerSize).toBe('m'); // new boards start at M
  });

  it('keeps the ball look when the ball is moved', () => {
    const s = freshStore();
    s.setBallStyle('basketball');
    s.moveBall(10, 10);
    expect(s.board.ball).toMatchObject({ x: 10, y: 10, style: 'basketball' });
  });
});
