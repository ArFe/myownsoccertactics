import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMATIONS, FORMATIONS, getFormation, placeFormation } from '@/model/formations';

describe('formations', () => {
  it.each(FORMATIONS.map((f) => [f.name, f] as const))('%s is a valid formation', (_name, f) => {
    expect(f.spots).toHaveLength(f.size);
    const numbers = f.spots.map((s) => s.number);
    expect(new Set(numbers).size).toBe(f.size);
    expect(f.spots.filter((s) => s.role === 'GK')).toHaveLength(1);
    for (const s of f.spots) {
      // Home team stays in its own half and on the field.
      expect(s.fx).toBeGreaterThan(0);
      expect(s.fx).toBeLessThan(0.5);
      expect(s.fy).toBeGreaterThan(0);
      expect(s.fy).toBeLessThan(1);
    }
    // The outfield line count matches the name, e.g. 4-3-3 = 10 outfield players.
    const outfield = f.name.split('-').map(Number).reduce((a, b) => a + b, 0);
    expect(outfield).toBe(f.size - 1);
  });

  it('has the six 11v11 and four 7v7 shapes we promised', () => {
    expect(FORMATIONS.filter((f) => f.size === 11).map((f) => f.name)).toEqual(['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '3-4-3']);
    expect(FORMATIONS.filter((f) => f.size === 7).map((f) => f.name)).toEqual(['2-3-1', '3-2-1', '2-1-2-1', '3-1-2']);
  });

  it('has defaults that exist', () => {
    for (const size of [7, 11] as const) {
      expect(getFormation(DEFAULT_FORMATIONS[size].home)?.size).toBe(size);
      expect(getFormation(DEFAULT_FORMATIONS[size].away)?.size).toBe(size);
    }
  });

  it('turns the away team around', () => {
    const f = getFormation('4-3-3')!;
    const home = placeFormation(f, 'home', 100, 60);
    const away = placeFormation(f, 'away', 100, 60);
    home.forEach((h, i) => {
      expect(away[i]!.x).toBeCloseTo(100 - h.x);
      expect(away[i]!.y).toBeCloseTo(60 - h.y);
    });
    // Home keeper near the left goal, away keeper near the right goal.
    expect(home[0]!.x).toBeLessThan(10);
    expect(away[0]!.x).toBeGreaterThan(90);
  });
});
