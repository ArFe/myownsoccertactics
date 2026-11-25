import { describe, expect, it } from 'vitest';
import { SPORTS, SPORT_IDS, getSport } from '@/model/sports';
import { createField } from '@/model/field';
import { getFormation } from '@/model/formations';
import { createBoard } from '@/model/factory';
import { BALL_STYLES } from '@/model/balls';

// Rules every sport definition must follow. Adding a sport to SPORTS runs it
// through all of these.
describe.each(SPORT_IDS.map((id) => [id, SPORTS[id]] as const))('sport: %s', (id, sport) => {
  it('is registered under its own id', () => {
    expect(sport.id).toBe(id);
    expect(getSport(id)).toBe(sport);
  });

  it('has presets that fit its size limits', () => {
    expect(sport.presets.length).toBeGreaterThan(0);
    expect(new Set(sport.presets.map((p) => p.id)).size).toBe(sport.presets.length);
    for (const p of sport.presets) {
      expect(p.id).not.toBe('custom');
      for (const v of [p.length, p.width]) {
        expect(v).toBeGreaterThanOrEqual(sport.sizeLimits.min);
        expect(v).toBeLessThanOrEqual(sport.sizeLimits.max);
      }
    }
  });

  it('has default formations that exist and match each preset team size', () => {
    for (const p of sport.presets) {
      for (const side of ['home', 'away'] as const) {
        expect(getFormation(sport, p.defaultFormations[side])?.size).toBe(p.teamSize);
      }
    }
  });

  it('has valid formations', () => {
    expect(new Set(sport.formations.map((f) => f.name)).size).toBe(sport.formations.length);
    for (const f of sport.formations) {
      expect(f.spots).toHaveLength(f.size);
      expect(new Set(f.spots.map((s) => s.number)).size).toBe(f.size);
      for (const s of f.spots) {
        expect(s.fx).toBeGreaterThan(0);
        expect(s.fx).toBeLessThan(1);
        expect(s.fy).toBeGreaterThan(0);
        expect(s.fy).toBeLessThan(1);
      }
    }
  });

  it('has unique marking keys that only skip its own presets', () => {
    const keys = sport.markings.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    const presetIds = sport.presets.map((p) => p.id);
    for (const m of sport.markings) for (const p of m.notIn ?? []) expect(presetIds).toContain(p);
  });

  it('draws every preset with the outline inside the run-off', () => {
    for (const p of sport.presets) {
      const field = createField(sport, p.id);
      const pad = sport.runoff(field);
      const d = sport.drawField(field);
      expect(d.lines.length).toBeGreaterThan(0);
      for (const line of [...d.lines, ...d.goals, ...d.nets]) {
        line.points.forEach((v, i) => {
          const max = i % 2 === 0 ? field.length : field.width;
          expect(v).toBeGreaterThanOrEqual(-pad);
          expect(v).toBeLessThanOrEqual(max + pad);
        });
      }
    }
  });

  it('starts boards with a ball style that exists', () => {
    expect(BALL_STYLES[sport.ballStyle]).toBeDefined();
    expect(createBoard(id).ball.style).toBe(sport.ballStyle);
  });

  it('makes a board for every preset', () => {
    for (const p of sport.presets) {
      const b = createBoard(id, p.id);
      expect(b.sport).toBe(id);
      expect(b.field.preset).toBe(p.id);
      expect(b.players.filter((x) => x.team === 'home')).toHaveLength(p.teamSize);
      expect(b.players.filter((x) => x.team === 'away')).toHaveLength(p.teamSize);
    }
  });
});
