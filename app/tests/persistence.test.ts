import { beforeEach, describe, expect, it } from 'vitest';
import { createSave } from '@/model/factory';
import { BROKEN_KEY, STORAGE_KEY, SaveFormatError, loadFromStorage, parseSave, serializeSave, writeToStorage } from '@/model/persistence';

describe('parseSave', () => {
  it('round-trips a save', () => {
    const save = createSave('Team A');
    save.boards[0]!.areas.push({
      id: 'a1', name: 'Zone 14', shape: 'rect', x: 72, y: 22.7, w: 16.5, h: 22.6, points: [],
      color: '#EF4444', opacity: 0.28, border: 'solid', label: 'top-left', note: 'Overload',
    });
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it('rejects files that are not JSON', () => {
    expect(() => parseSave('not json')).toThrow(SaveFormatError);
  });

  it('rejects other JSON files', () => {
    expect(() => parseSave('{"hello": 1}')).toThrow(/not a Tactics Board save/);
  });

  it('rejects saves from a newer version', () => {
    const save = { ...createSave(), version: 99 };
    expect(() => parseSave(JSON.stringify(save))).toThrow(/newer version/);
  });

  it('rejects saves with no boards', () => {
    const save = { ...createSave(), boards: [] };
    expect(() => parseSave(JSON.stringify(save))).toThrow(/no boards/);
  });

  it('repairs bad values instead of failing', () => {
    const save = createSave() as unknown as Record<string, any>;
    const b = save.boards[0];
    b.field.length = 'long';
    b.field.width = 9999;
    b.field.surfaceColor = 'javascript:alert(1)';
    b.teams.home.shirtColor = 'red; background: url(x)';
    b.areas = [{ shape: 'blob', opacity: 7 }, { shape: 'polygon', points: [1, 2] }, 'junk'];
    const out = parseSave(JSON.stringify(save)).boards[0]!;
    expect(out.field.length).toBe(105);
    expect(out.field.width).toBe(130);
    expect(out.field.surfaceColor).toBe('#2E7D43');
    expect(out.teams.home.shirtColor).toBe('#1D4ED8');
    // The bad-shape area becomes a rect; the 1-point polygon is dropped.
    expect(out.areas).toHaveLength(1);
    expect(out.areas[0]!.shape).toBe('rect');
    expect(out.areas[0]!.opacity).toBe(1);
  });

  it('upgrades a version 1 save: soccer boards, grassColor becomes surfaceColor', () => {
    const v2 = createSave('Old');
    const b = v2.boards[0]! as unknown as Record<string, any>;
    delete b.sport;
    b.field.grassColor = '#123456';
    delete b.field.surfaceColor;
    const v1 = { ...v2, version: 1 };
    const out = parseSave(JSON.stringify(v1));
    expect(out.version).toBe(2);
    expect(out.boards[0]!.sport).toBe('soccer');
    expect(out.boards[0]!.field.surfaceColor).toBe('#123456');
    expect('grassColor' in out.boards[0]!.field).toBe(false);
    // Everything else comes through unchanged.
    expect(out.boards[0]!.players).toEqual(v2.boards[0]!.players);
  });

  it('reads an unknown sport or preset as the defaults, and drops unknown markings', () => {
    const save = createSave() as unknown as Record<string, any>;
    save.boards[0].sport = 'curling';
    save.boards[0].field.preset = '5v5';
    save.boards[0].field.markings.hogLine = true;
    const out = parseSave(JSON.stringify(save)).boards[0]!;
    expect(out.sport).toBe('soccer');
    expect(out.field.preset).toBe('11v11');
    expect(out.field.markings).not.toHaveProperty('hogLine');
  });

  it('keeps a custom preset', () => {
    const save = createSave();
    save.boards[0]!.field.preset = 'custom';
    expect(parseSave(JSON.stringify(save)).boards[0]!.field.preset).toBe('custom');
  });

  it('fixes duplicate board ids and a missing active board', () => {
    const save = createSave();
    save.boards.push(structuredClone(save.boards[0]!));
    save.activeBoardId = 'gone';
    const out = parseSave(JSON.stringify(save));
    expect(new Set(out.boards.map((b) => b.id)).size).toBe(2);
    expect(out.activeBoardId).toBe(out.boards[0]!.id);
  });
});

describe('browser storage', () => {
  beforeEach(() => localStorage.clear());

  it('starts a new save when nothing is stored', () => {
    const r = loadFromStorage(localStorage);
    expect(r.save.boards).toHaveLength(1);
    expect(r.warning).toBeUndefined();
  });

  it('loads what was written', () => {
    const save = createSave('Stored');
    expect(writeToStorage(localStorage, save)).toBe(true);
    expect(loadFromStorage(localStorage).save.name).toBe('Stored');
  });

  it('keeps unreadable data aside and warns', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    const r = loadFromStorage(localStorage);
    expect(r.warning).toMatch(/could not be read/);
    expect(localStorage.getItem(BROKEN_KEY)).toBe('{broken');
    expect(r.save.boards).toHaveLength(1);
  });

  it('reports a full or blocked storage', () => {
    const full = { setItem: () => { throw new Error('QuotaExceeded'); } } as unknown as Storage;
    expect(writeToStorage(full, createSave())).toBe(false);
  });
});
