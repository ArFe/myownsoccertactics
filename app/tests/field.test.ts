import { describe, expect, it } from 'vitest';
import { buildFieldDrawing, createField, markingAvailable, markingDims, runoff, clampSize, MAX_SIZE, MIN_SIZE } from '@/model/field';

describe('field presets', () => {
  it('uses the official 11v11 size and markings', () => {
    const f = createField('11v11');
    expect([f.length, f.width]).toEqual([105, 68]);
    const d = markingDims(f);
    expect(d.penaltyDepth).toBe(16.5);
    expect(d.penaltyWidth).toBeCloseTo(40.32);
    expect(d.circleRadius).toBe(9.15);
    expect(f.markings.buildOutLines).toBe(false);
  });

  it('uses 55 x 36 m for 7v7, with a 6 x 18 m box and a 6 m circle', () => {
    const f = createField('7v7');
    expect([f.length, f.width]).toEqual([55, 36]);
    const d = markingDims(f);
    expect([d.goalAreaDepth, d.goalAreaWidth, d.circleRadius]).toEqual([6, 18, 6]);
    expect(f.markings.penaltyAreas).toBe(false);
    expect(f.markings.buildOutLines).toBe(false);
  });

  it('does not offer a penalty area or build-out lines for 7v7', () => {
    expect(markingAvailable('7v7', 'penaltyAreas')).toBe(false);
    expect(markingAvailable('7v7', 'buildOutLines')).toBe(false);
    expect(markingAvailable('7v7', 'goalAreas')).toBe(true);
    expect(markingAvailable('custom', 'buildOutLines')).toBe(true);
  });

  it('scales custom markings down to fit a small field', () => {
    const d = markingDims({ preset: 'custom', length: 40, width: 25 });
    expect(d.penaltyWidth).toBeLessThanOrEqual(25 * 0.9);
    expect(d.penaltyDepth).toBeLessThan(11);
    expect(d.goalAreaWidth).toBeLessThan(d.penaltyWidth);
  });

  it('never scales custom markings up', () => {
    const d = markingDims({ preset: 'custom', length: 120, width: 80 });
    expect(d.penaltyDepth).toBe(16.5);
  });

  it('clamps sizes to the allowed range', () => {
    expect(clampSize(5)).toBe(MIN_SIZE);
    expect(clampSize(500)).toBe(MAX_SIZE);
    expect(clampSize(Number.NaN)).toBe(MIN_SIZE);
    expect(clampSize(60)).toBe(60);
  });

  it('has more run-off around big fields', () => {
    expect(runoff({ length: 105 })).toBeGreaterThan(runoff({ length: 55 }));
  });
});

describe('buildFieldDrawing', () => {
  it('draws the 7v7 field as one box per end, no penalty area, spot or arc', () => {
    const f = createField('7v7');
    // Even if an old save has them turned on, 7v7 never draws them.
    f.markings.penaltyAreas = true;
    f.markings.buildOutLines = true;
    const d = buildFieldDrawing(f);
    expect(d.lines.filter((l) => l.dashed)).toHaveLength(0);
    expect(d.spots).toHaveLength(1); // centre spot only
    // outline, halfway, centre circle, 2 boxes, 4 corner arcs
    expect(d.lines).toHaveLength(9);
    const box = d.lines.find((l) => l.points.length === 8 && l.points[0] === 0 && !l.closed)!;
    expect(box.points).toEqual([0, 9, 6, 9, 6, 27, 0, 27]);
  });

  it('draws build-out lines on custom fields only when turned on', () => {
    const f = { ...createField('7v7'), preset: 'custom' as const };
    f.markings.penaltyAreas = true;
    expect(buildFieldDrawing(f).lines.filter((l) => l.dashed)).toHaveLength(0);
    f.markings.buildOutLines = true;
    const dashed = buildFieldDrawing(f).lines.filter((l) => l.dashed);
    expect(dashed).toHaveLength(2);
    // Halfway between the penalty area (11 m) and the halfway line (27.5 m).
    expect(dashed[0]!.points[0]).toBeCloseTo((11 + 27.5) / 2);
  });

  it('starts and ends the penalty arc on the penalty-area line', () => {
    const f = createField('11v11');
    const d = markingDims(f);
    const arcs = buildFieldDrawing(f).lines.filter((l) => !l.closed && l.points.length > 20 && l.points.length < 60);
    const left = arcs.find((a) => a.points[0]! < 52.5)!;
    expect(left.points[0]).toBeCloseTo(d.penaltyDepth);
    expect(left.points.at(-2)).toBeCloseTo(d.penaltyDepth);
  });

  it('drops markings that are turned off', () => {
    const f = createField('11v11');
    const full = buildFieldDrawing(f).lines.length;
    f.markings.penaltyAreas = false;
    f.markings.goalAreas = false;
    f.markings.centreCircle = false;
    // 2 boxes + 2 arcs + 2 goal boxes + circle
    expect(buildFieldDrawing(f).lines.length).toBe(full - 7);
  });

  it('makes an even number of stripes so both ends match', () => {
    for (const length of [30, 55, 77, 105, 130]) {
      const f = { ...createField('11v11'), preset: 'custom' as const, length };
      const stripes = buildFieldDrawing(f).stripes;
      const sw = stripes[0]!.w;
      expect(Math.round(length / sw) % 2).toBe(0);
    }
    const f = createField('11v11');
    f.markings.stripes = false;
    expect(buildFieldDrawing(f).stripes).toHaveLength(0);
  });

  it('puts goals outside the field', () => {
    const f = createField('11v11');
    const [left, right] = buildFieldDrawing(f).goals;
    expect(Math.min(...left!.points.filter((_, i) => i % 2 === 0))).toBeLessThan(0);
    expect(Math.max(...right!.points.filter((_, i) => i % 2 === 0))).toBeGreaterThan(105);
  });
});
