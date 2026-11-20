import { describe, expect, it } from 'vitest';
import { ZOOM_STEPS, anchoredScroll, stepZoom, useFieldZoom } from '@/composables/zoom';
import { titleBand } from '@/export/title';

describe('field zoom', () => {
  it('steps through the levels and stops at both ends', () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1.25, -1)).toBe(1);
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(ZOOM_STEPS.at(-1)!, 1)).toBe(ZOOM_STEPS.at(-1));
  });

  it('keeps the point under the mouse still', () => {
    // A point 100 px into the view, scrolled 50 px: content point 150. At 2x
    // it is at 300, so scroll 200 to keep it 100 px into the view.
    expect(anchoredScroll(50, 100, 2)).toBe(200);
    expect(anchoredScroll(0, 100, 0.5)).toBe(0); // never below 0
  });

  it('remembers the anchor for one zoom only', () => {
    const z = useFieldZoom();
    z.resetZoom();
    z.zoomBy(1, { x: 10, y: 20 });
    expect(z.zoom.value).toBe(1.25);
    expect(z.takeAnchor()).toEqual({ x: 10, y: 20 });
    expect(z.takeAnchor()).toBeNull();
    z.resetZoom();
  });
});

describe('PNG title band', () => {
  it('scales with the image, within limits', () => {
    expect(titleBand(1600)).toEqual({ height: 96, fontSize: 48, pad: 38 });
    expect(titleBand(200).fontSize).toBe(18);
    expect(titleBand(5000).fontSize).toBe(56);
  });
});
