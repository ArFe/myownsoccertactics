import { describe, expect, it } from 'vitest';
import { SITE, watermark } from '@/export/watermark';

describe('watermark', () => {
  it('names the site in the bottom-right corner of the field', () => {
    const w = watermark(1600, 1000);
    expect(w.text).toBe(SITE);
    expect(w.align).toBe('right');
    expect(w.width).toBeLessThan(1600);
    expect(w.y + w.fontSize).toBeLessThan(1000);
    expect(w.y).toBeGreaterThan(900);
  });

  it('stays small and readable at every export size', () => {
    expect(watermark(800, 500).fontSize).toBe(11); // GIF
    expect(watermark(1280, 800).fontSize).toBe(17); // video
    expect(watermark(1600, 1000).fontSize).toBe(21); // PNG
    expect(watermark(4000, 2500).fontSize).toBe(22);
    expect(watermark(1600, 1000).opacity).toBeLessThan(1);
  });
});
