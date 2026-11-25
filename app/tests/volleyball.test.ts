import { describe, expect, it } from 'vitest';
import { createField, sportMarkingAvailable } from '@/model/field';
import { createBoard } from '@/model/factory';
import { VOLLEYBALL } from '@/model/sports/volleyball';
import { NET_HEIGHT, drawVolleyballField } from '@/model/sports/volleyball/field';

const field = (preset: string) => createField(VOLLEYBALL, preset);

describe('volleyball court', () => {
  it('uses 18 x 9 m indoors, with a centre line and attack lines 3 m from the net', () => {
    const f = field('6v6');
    expect([f.length, f.width]).toEqual([18, 9]);
    const xs = drawVolleyballField(f)
      .lines.filter((l) => !l.dashed && l.points.length === 4)
      .map((l) => l.points[0]);
    expect(xs).toEqual([9, 6, 12]);
  });

  it('extends each attack line 1.75 m past the sidelines, dashed', () => {
    const dashed = drawVolleyballField(field('6v6')).lines.filter((l) => l.dashed);
    expect(dashed).toHaveLength(4);
    expect(dashed[0]!.points).toEqual([6, -1.75, 6, 0]);
  });

  it('uses 16 x 8 m on the beach, with no centre line or attack lines', () => {
    const f = field('2v2');
    expect([f.length, f.width]).toEqual([16, 8]);
    expect(sportMarkingAvailable(VOLLEYBALL, '2v2', 'attackLines')).toBe(false);
    expect(sportMarkingAvailable(VOLLEYBALL, '2v2', 'centreLine')).toBe(false);
    expect(drawVolleyballField(f).lines).toHaveLength(1);
  });

  it('always draws the net on the middle, posts 1 m outside the sidelines', () => {
    for (const p of ['6v6', '2v2']) {
      const f = field(p);
      const d = drawVolleyballField(f);
      expect(d.nets).toEqual([{ points: [f.length / 2, -1, f.length / 2, f.width + 1], height: NET_HEIGHT, depth: 1 }]);
      expect(d.goals).toHaveLength(0);
      expect(d.stripes).toHaveLength(0);
    }
  });
});

describe('volleyball teams', () => {
  it('starts indoor boards in a 5-1 with six a side, each team on its own half', () => {
    const b = createBoard('volleyball');
    expect(b.ball.style).toBe('volleyball');
    expect(b.teams.home.formation).toBe('5-1');
    const home = b.players.filter((p) => p.team === 'home');
    const away = b.players.filter((p) => p.team === 'away');
    expect(home).toHaveLength(6);
    for (const p of home) expect(p.x).toBeLessThan(9);
    for (const p of away) expect(p.x).toBeGreaterThan(9);
    expect(home.find((p) => p.number === 1)?.role).toBe('S');
  });

  it('starts beach boards with two a side', () => {
    const b = createBoard('volleyball', '2v2');
    expect(b.players.filter((p) => p.team === 'home')).toHaveLength(2);
  });
});
