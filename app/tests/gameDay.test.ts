import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { cloneBoardWithNewIds, createBoard, createSave } from '@/model/factory';
import { WAVE_COLORS, createSub, createWave, ringColor, subsFor, teamSubs, tidySubs } from '@/model/gameDay';
import { parseSave, serializeSave } from '@/model/persistence';
import { useSaveStore } from '@/stores/save';

function planned() {
  const board = createBoard();
  const home = board.players.filter((p) => p.team === 'home');
  const w1 = createWave(board);
  board.waves.push(w1);
  const w2 = createWave(board);
  board.waves.push(w2);
  w1.minute = 35;
  w2.minute = 20;
  const a = createSub(board, home[9]!);
  board.subs.push(a);
  const b = createSub(board, home[9]!);
  board.subs.push(b);
  a.waveId = w1.id;
  b.waveId = w2.id;
  return { board, home, w1, w2, a, b };
}

describe('game day model', () => {
  it('gives new times their own colour and a later minute', () => {
    const board = createBoard();
    const w1 = createWave(board);
    board.waves.push(w1);
    const w2 = createWave(board);
    expect(w1).toMatchObject({ color: WAVE_COLORS[0], minute: 60 });
    expect(w2.color).toBe(WAVE_COLORS[1]);
    expect(w2.minute).toBe(75);
  });

  it('numbers a new sub after the team, and after earlier subs', () => {
    const { board, a, b } = planned();
    expect(a.number).toBe(12);
    expect(b.number).toBe(13);
    expect(board.subs.every((s) => s.name === '')).toBe(true);
  });

  it('orders subs by minute, and rings a player in the first time that takes them off', () => {
    const { board, home, w2, a, b } = planned();
    expect(subsFor(board, home[9]!.id).map((s) => s.id)).toEqual([b.id, a.id]);
    expect(teamSubs(board, 'home').map((s) => s.id)).toEqual([b.id, a.id]);
    expect(teamSubs(board, 'away')).toEqual([]);
    expect(ringColor(board, home[9]!.id)).toBe(w2.color);
    expect(ringColor(board, home[0]!.id)).toBeNull();
  });

  it('drops subs whose player has gone, and links to deleted times', () => {
    const { board, home, w2, a, b } = planned();
    board.waves = board.waves.filter((w) => w.id !== w2.id);
    tidySubs(board);
    expect(board.subs.find((s) => s.id === b.id)!.waveId).toBeNull();
    board.players = board.players.filter((p) => p.id !== home[9]!.id);
    tidySubs(board);
    expect(board.subs.map((s) => s.id)).not.toContain(a.id);
    expect(board.subs).toHaveLength(0);
  });

  it('a copied board keeps its plan, with the new ids', () => {
    const { board } = planned();
    const copy = cloneBoardWithNewIds(board);
    expect(copy.subs).toHaveLength(2);
    const ids = new Set(copy.players.map((p) => p.id));
    const waves = new Set(copy.waves.map((w) => w.id));
    expect(copy.subs.every((s) => ids.has(s.replaces) && waves.has(s.waveId!))).toBe(true);
    expect(copy.waves[0]!.id).not.toBe(board.waves[0]!.id);
  });
});

describe('game day in the save file', () => {
  it('round-trips', () => {
    const save = createSave();
    const { board } = planned();
    board.gameDay = { on: true, team: 'home', subsShown: 'both' };
    save.boards = [board];
    save.activeBoardId = board.id;
    const back = parseSave(serializeSave(save)).boards[0]!;
    expect(back.subs).toEqual(board.subs);
    expect(back.waves).toEqual(board.waves);
    expect(back.gameDay).toEqual(board.gameDay);
  });

  it('a version 5 save upgrades with game day off and no subs', () => {
    const v5 = createSave() as unknown as Record<string, any>;
    v5.version = 5;
    for (const k of ['subs', 'waves', 'gameDay']) delete v5.boards[0][k];
    const b = parseSave(JSON.stringify(v5)).boards[0]!;
    expect(b.subs).toEqual([]);
    expect(b.waves).toEqual([]);
    expect(b.gameDay).toEqual({ on: false, team: 'home', subsShown: 'bench' });
  });

  it('drops subs for unknown players, unknown times and bad values', () => {
    const save = createSave() as unknown as Record<string, any>;
    const b = save.boards[0];
    b.waves = [{ id: 'w1', color: 'red', minute: 999 }];
    b.subs = [
      { id: 's1', number: 14, name: 'Ana', replaces: b.players[0].id, waveId: 'nope' },
      { id: 's2', number: 15, name: 'Bo', replaces: 'ghost', waveId: 'w1' },
    ];
    b.gameDay = { on: 'yes', team: 'left', subsShown: 'everywhere' };
    const back = parseSave(JSON.stringify(save)).boards[0]!;
    expect(back.waves).toEqual([{ id: 'w1', color: '#2563EB', minute: 150 }]);
    expect(back.subs).toHaveLength(1);
    expect(back.subs[0]).toMatchObject({ id: 's1', waveId: null });
    expect(back.gameDay).toEqual({ on: false, team: 'home', subsShown: 'bench' });
  });
});

describe('game day in the store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('hides the other team, and shows it again when turned off', () => {
    const s = useSaveStore();
    s.setGameDay(true);
    expect(s.board.teams.away.visible).toBe(false);
    s.setGameDayTeam('away');
    expect(s.board.teams.away.visible).toBe(true);
    expect(s.board.teams.home.visible).toBe(false);
    s.setGameDay(false);
    expect(s.board.teams.home.visible).toBe(true);
    s.undo();
    expect(s.board.gameDay.on).toBe(true);
  });

  it('adds, edits and deletes times and subs, refusing bad edits', () => {
    const s = useSaveStore();
    const p = s.board.players.find((x) => x.team === 'home')!;
    const w = s.addWave()!;
    const sub = s.addSub(p.id)!;
    s.updateSub(sub, { name: 'Ana', waveId: w });
    s.updateSub(sub, { replaces: 'ghost' });
    s.updateSub(sub, { number: -3 });
    s.updateWave(w, { minute: 200 });
    expect(s.board.subs[0]).toMatchObject({ name: 'Ana', waveId: w, replaces: p.id, number: 12 });
    expect(s.board.waves[0]!.minute).toBe(150);
    s.deleteWave(w);
    expect(s.board.subs[0]!.waveId).toBeNull();
    s.deleteSub(sub);
    expect(s.board.subs).toHaveLength(0);
    expect(s.addSub('ghost')).toBeNull();
  });

  it('a smaller team takes the subs of players who left with it', () => {
    const s = useSaveStore();
    const home = s.board.players.filter((x) => x.team === 'home');
    s.addSub(home[0]!.id);
    s.addSub(home[10]!.id);
    s.setPreset('7v7');
    expect(s.board.subs).toHaveLength(1);
    expect(s.board.subs[0]!.replaces).toBe(home[0]!.id);
  });
});
