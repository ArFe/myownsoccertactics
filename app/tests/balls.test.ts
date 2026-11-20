import { describe, expect, it } from 'vitest';
import { BALL_STYLES, BALL_STYLE_IDS, SIZES, defaultBallColors, sizeScale } from '@/model/balls';

describe.each(BALL_STYLE_IDS.map((id) => [id, BALL_STYLES[id]] as const))('ball style: %s', (id, style) => {
  it('is registered under its own id', () => {
    expect(style.id).toBe(id);
  });

  it('only uses its own colour slots, with valid default colours', () => {
    const keys = style.colors.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain(style.body);
    for (const c of style.colors) expect(c.default).toMatch(/^#[0-9A-F]{6}$/i);
    for (const part of style.parts) expect(keys).toContain(part.color);
    expect(Object.keys(defaultBallColors(id))).toEqual(keys);
  });

  it('has paths made only of M, L, Q, Z and numbers, all close to the ball', () => {
    expect(style.parts.length).toBeGreaterThan(0);
    for (const part of style.parts) {
      expect(part.path).toMatch(/^[MLQZ0-9.\- ]+$/);
      for (const n of part.path.match(/-?\d*\.?\d+/g)!.map(Number)) expect(Math.abs(n)).toBeLessThanOrEqual(1.5);
    }
  });
});

describe('ball styles', () => {
  it('has the four looks, with blue, yellow and white for volleyball', () => {
    expect(BALL_STYLE_IDS).toEqual(['soccer', 'volleyball', 'basketball', 'football']);
    expect(defaultBallColors('volleyball')).toEqual({ panel1: '#FFFFFF', panel2: '#1E5AA8', panel3: '#FFD23F' });
    expect(BALL_STYLES.football.shape).toBe('oval');
  });

  it('draws the soccer ball with six patches and their seams', () => {
    const patches = BALL_STYLES.soccer.parts.filter((p) => !p.line);
    expect(patches).toHaveLength(6);
    expect(BALL_STYLES.soccer.parts.filter((p) => p.line)).toHaveLength(1);
  });

  it('has sizes that grow from S to XL, with M as 1', () => {
    expect(SIZES.map((s) => s.id)).toEqual(['s', 'm', 'l', 'xl']);
    const scales = SIZES.map((s) => s.scale);
    expect([...scales].sort((a, b) => a - b)).toEqual(scales);
    expect(sizeScale('m')).toBe(1);
  });
});
