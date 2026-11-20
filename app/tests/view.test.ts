import { describe, expect, it } from 'vitest';
import { createField } from '@/model/field';
import { makeView, normaliseRect, pointsToScreen, pointsToWorld, rectToScreen, rectToWorld, toScreen, toWorld, boundingBox } from '@/model/view';

const horizontal = makeView(createField('11v11'), 1130);
const vField = { ...createField('11v11'), orientation: 'vertical' as const };
const vertical = makeView(vField, 760);

describe('view', () => {
  it('fits the field and its run-off into the width', () => {
    expect(horizontal.stageWidth).toBe(1130);
    expect(horizontal.scale).toBeCloseTo(10); // 105 + 2 * 4 = 113 m
    expect(horizontal.stageHeight).toBe(760);
  });

  it('respects the height limit', () => {
    const v = makeView(createField('11v11'), 2000, 380);
    expect(v.stageHeight).toBeLessThanOrEqual(380);
    expect(v.stageWidth).toBeLessThan(2000);
  });

  it('turns the field upright in vertical mode', () => {
    expect(vertical.stageHeight).toBeGreaterThan(vertical.stageWidth);
    // The home goal (x = 0) is at the bottom.
    expect(toScreen(vertical, 0, 34).y).toBeGreaterThan(toScreen(vertical, 105, 34).y);
  });

  it.each([
    ['horizontal', horizontal],
    ['vertical', vertical],
  ] as const)('round-trips points and rects (%s)', (_n, v) => {
    const s = toScreen(v, 12.5, 40);
    const w = toWorld(v, s.x, s.y);
    expect(w.x).toBeCloseTo(12.5);
    expect(w.y).toBeCloseTo(40);

    const pts = [1, 2, 30, 4, 50, 60];
    pointsToWorld(v, pointsToScreen(v, pts)).forEach((n, i) => expect(n).toBeCloseTo(pts[i]!));

    const r = { x: 72, y: 22.7, w: 16.5, h: 22.6 };
    const back = rectToWorld(v, rectToScreen(v, r));
    expect(back.x).toBeCloseTo(r.x);
    expect(back.y).toBeCloseTo(r.y);
    expect(back.w).toBeCloseTo(r.w);
    expect(back.h).toBeCloseTo(r.h);
  });

  it('puts a rect in the same place as its corners', () => {
    const r = { x: 10, y: 5, w: 20, h: 8 };
    const s = rectToScreen(vertical, r);
    const corners = [toScreen(vertical, r.x, r.y), toScreen(vertical, r.x + r.w, r.y + r.h)];
    expect(s.x).toBeCloseTo(Math.min(corners[0]!.x, corners[1]!.x));
    expect(s.y).toBeCloseTo(Math.min(corners[0]!.y, corners[1]!.y));
  });

  it('normalises rects dragged in any direction', () => {
    expect(normaliseRect(50, 40, 10, 20)).toEqual({ x: 10, y: 20, w: 40, h: 20 });
    expect(boundingBox([5, 1, 2, 9, 7, 4])).toEqual({ x: 2, y: 1, w: 5, h: 8 });
  });
});
