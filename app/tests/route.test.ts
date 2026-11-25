import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { pathForSport, sportFromPath } from '@/model/route';
import { useSaveStore } from '@/stores/save';
import { DEFAULT_SPORT, SPORT_IDS } from '@/model/sports';

describe('sportFromPath', () => {
  it('reads a sport from the address', () => {
    expect(sportFromPath('/soccer')).toBe('soccer');
    expect(sportFromPath('/soccer/')).toBe('soccer');
    expect(sportFromPath('/Soccer')).toBe('soccer');
    expect(sportFromPath('/volleyball')).toBe('volleyball');
  });

  it('every sport has a route, and back', () => {
    for (const id of SPORT_IDS) {
      expect(sportFromPath(`/${id}`)).toBe(id);
      expect(sportFromPath(pathForSport(id))).toBe(id);
    }
  });

  it('/ and unknown addresses land on the default sport', () => {
    for (const p of ['/', '', '/hockey', '/index.html', '/a/b']) expect(sportFromPath(p)).toBe(DEFAULT_SPORT);
    expect(pathForSport(DEFAULT_SPORT)).toBe('/soccer');
  });
});

describe('openSport', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('keeps the open board when it is already that sport', () => {
    const s = useSaveStore();
    s.addBoard('7v7');
    const open = s.board.id;
    s.openSport('soccer');
    expect(s.board.id).toBe(open);
    expect(s.save.boards).toHaveLength(2);
  });

  it('opens the first board of that sport, or makes one with its defaults', () => {
    const s = useSaveStore();
    // Pretend the open board is another sport.
    (s.board as { sport: string }).sport = 'other';
    s.openSport('soccer');
    expect(s.save.boards).toHaveLength(2);
    expect(s.board.sport).toBe('soccer');
    expect(s.board.field.preset).toBe('11v11');
    expect(s.board.players).toHaveLength(22);
  });
});
