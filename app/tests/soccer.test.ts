import { describe, expect, it } from 'vitest';
import { clampSize, createField, sportMarkingAvailable } from '@/model/field';
import { getFormation, placeFormation } from '@/model/formations';
import { SOCCER } from '@/model/sports/soccer';
import { drawSoccerField, markingDims } from '@/model/sports/soccer/field';
import { SOCCER_FORMATIONS } from '@/model/sports/soccer/formations';

const field = (preset: string) => createField(SOCCER, preset);

describe('soccer field presets', () => {
  it('uses the official 11v11 size and markings', () => {
    const f = field('11v11');
    expect([f.length, f.width]).toEqual([105, 68]);
    const d = markingDims(f);
    expect(d.penaltyDepth).toBe(16.5);
    expect(d.penaltyWidth).toBeCloseTo(40.32);
    expect(d.circleRadius).toBe(9.15);
    expect(f.markings.buildOutLines).toBe(false);
  });

  it('uses 55 x 36 m for 7v7, with a 6 x 18 m box and a 6 m circle', () => {
    const f = field('7v7');
    expect([f.length, f.width]).toEqual([55, 36]);
    const d = markingDims(f);
    expect([d.goalAreaDepth, d.goalAreaWidth, d.circleRadius]).toEqual([6, 18, 6]);
    expect(f.markings.penaltyAreas).toBe(false);
    expect(f.markings.buildOutLines).toBe(false);
  });

  it('does not offer a penalty area or build-out lines for 7v7', () => {
    expect(sportMarkingAvailable(SOCCER, '7v7', 'penaltyAreas')).toBe(false);
    expect(sportMarkingAvailable(SOCCER, '7v7', 'buildOutLines')).toBe(false);
    expect(sportMarkingAvailable(SOCCER, '7v7', 'goalAreas')).toBe(true);
    expect(sportMarkingAvailable(SOCCER, 'custom', 'buildOutLines')).toBe(true);
    expect(sportMarkingAvailable(SOCCER, '11v11', 'netLine')).toBe(false);
  });

  it('scales custom markings down to fit a small field', () => {
    const d = markingDims({ preset: 'custom', length: 40, width: 25 });
    expect(d.penaltyWidth).toBeLessThanOrEqual(25 * 0.9);
    expect(d.penaltyDepth).toBeLessThan(11);
    expect(d.goalAreaWidth).toBeLessThan(d.penaltyWidth);
  });

  it('never scales custom markings up', () => {
    expect(markingDims({ preset: 'custom', length: 120, width: 80 }).penaltyDepth).toBe(16.5);
  });

  it('clamps sizes to the soccer range', () => {
    expect(clampSize(SOCCER, 5)).toBe(20);
    expect(clampSize(SOCCER, 500)).toBe(130);
    expect(clampSize(SOCCER, Number.NaN)).toBe(20);
    expect(clampSize(SOCCER, 60)).toBe(60);
  });

  it('has more run-off around big fields', () => {
    expect(SOCCER.runoff({ length: 105, width: 68 })).toBeGreaterThan(SOCCER.runoff({ length: 55, width: 36 }));
  });
});

describe('soccer field drawing', () => {
  it('draws the 7v7 field as one box per end, no penalty area, spot or arc', () => {
    const f = field('7v7');
    // Even if an old save has them turned on, 7v7 never draws them.
    f.markings.penaltyAreas = true;
    f.markings.buildOutLines = true;
    const d = drawSoccerField(f);
    expect(d.lines.filter((l) => l.dashed)).toHaveLength(0);
    expect(d.spots).toHaveLength(1); // centre spot only
    // outline, halfway, centre circle, 2 boxes, 4 corner arcs
    expect(d.lines).toHaveLength(9);
    const box = d.lines.find((l) => l.points.length === 8 && l.points[0] === 0 && !l.closed)!;
    expect(box.points).toEqual([0, 9, 6, 9, 6, 27, 0, 27]);
  });

  it('draws build-out lines on custom fields only when turned on', () => {
    const f = { ...field('7v7'), preset: 'custom' };
    f.markings.penaltyAreas = true;
    expect(drawSoccerField(f).lines.filter((l) => l.dashed)).toHaveLength(0);
    f.markings.buildOutLines = true;
    const dashed = drawSoccerField(f).lines.filter((l) => l.dashed);
    expect(dashed).toHaveLength(2);
    // Halfway between the penalty area (11 m) and the halfway line (27.5 m).
    expect(dashed[0]!.points[0]).toBeCloseTo((11 + 27.5) / 2);
  });

  it('starts and ends the penalty arc on the penalty-area line', () => {
    const f = field('11v11');
    const d = markingDims(f);
    const arcs = drawSoccerField(f).lines.filter((l) => !l.closed && l.points.length > 20 && l.points.length < 60);
    const left = arcs.find((a) => a.points[0]! < 52.5)!;
    expect(left.points[0]).toBeCloseTo(d.penaltyDepth);
    expect(left.points.at(-2)).toBeCloseTo(d.penaltyDepth);
  });

  it('drops markings that are turned off', () => {
    const f = field('11v11');
    const full = drawSoccerField(f).lines.length;
    f.markings.penaltyAreas = false;
    f.markings.goalAreas = false;
    f.markings.centreCircle = false;
    // 2 boxes + 2 arcs + 2 goal boxes + circle
    expect(drawSoccerField(f).lines.length).toBe(full - 7);
  });

  it('makes an even number of stripes so both ends match', () => {
    for (const length of [30, 55, 77, 105, 130]) {
      const f = { ...field('11v11'), preset: 'custom', length };
      const sw = drawSoccerField(f).stripes[0]!.w;
      expect(Math.round(length / sw) % 2).toBe(0);
    }
    const f = field('11v11');
    f.markings.stripes = false;
    expect(drawSoccerField(f).stripes).toHaveLength(0);
  });

  it('puts goals outside the field', () => {
    const [left, right] = drawSoccerField(field('11v11')).goals;
    expect(Math.min(...left!.points.filter((_, i) => i % 2 === 0))).toBeLessThan(0);
    expect(Math.max(...right!.points.filter((_, i) => i % 2 === 0))).toBeGreaterThan(105);
  });
});

describe('soccer formations', () => {
  it('has the six 11v11 and four 7v7 shapes we promised', () => {
    expect(SOCCER_FORMATIONS.filter((f) => f.size === 11).map((f) => f.name)).toEqual(['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '3-4-3']);
    expect(SOCCER_FORMATIONS.filter((f) => f.size === 7).map((f) => f.name)).toEqual(['2-3-1', '3-2-1', '2-1-2-1', '3-1-2']);
  });

  it.each(SOCCER_FORMATIONS.map((f) => [f.name, f] as const))('%s has one keeper and matches its name', (_n, f) => {
    expect(f.spots.filter((s) => s.role === 'GK')).toHaveLength(1);
    // Home team stays in its own half. E.g. 4-3-3 = 10 outfield players.
    for (const s of f.spots) expect(s.fx).toBeLessThan(0.5);
    const outfield = f.name.split('-').map(Number).reduce((a, b) => a + b, 0);
    expect(outfield).toBe(f.size - 1);
  });

  it('turns the away team around', () => {
    const f = getFormation(SOCCER, '4-3-3')!;
    const home = placeFormation(f, 'home', 100, 60);
    const away = placeFormation(f, 'away', 100, 60);
    home.forEach((h, i) => {
      expect(away[i]!.x).toBeCloseTo(100 - h.x);
      expect(away[i]!.y).toBeCloseTo(60 - h.y);
    });
    expect(home[0]!.x).toBeLessThan(10);
    expect(away[0]!.x).toBeGreaterThan(90);
  });
});
