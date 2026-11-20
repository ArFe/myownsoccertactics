import type { FieldPreset, FieldSettings, Markings } from './types';

export const PRESET_SIZES: Record<Exclude<FieldPreset, 'custom'>, { length: number; width: number }> = {
  '11v11': { length: 105, width: 68 },
  '7v7': { length: 55, width: 36 },
};

/** Limits for custom sizes, in metres. */
export const MIN_SIZE = 20;
export const MAX_SIZE = 130;

export interface MarkingDims {
  penaltyDepth: number;
  penaltyWidth: number;
  goalAreaDepth: number;
  goalAreaWidth: number;
  circleRadius: number;
  spotDistance: number;
  goalWidth: number;
  goalDepth: number;
  cornerRadius: number;
}

const DIMS_11: MarkingDims = {
  penaltyDepth: 16.5,
  penaltyWidth: 40.32,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  circleRadius: 9.15,
  spotDistance: 11,
  goalWidth: 7.32,
  goalDepth: 1.6,
  cornerRadius: 1,
};

// 7v7: one 6 x 18 m box at each end and a 6 m centre circle. There is no
// penalty area, spot or arc. The penalty values below are only used by small
// custom fields when the penalty areas are turned on.
const DIMS_7: MarkingDims = {
  penaltyDepth: 11,
  penaltyWidth: 24,
  goalAreaDepth: 6,
  goalAreaWidth: 18,
  circleRadius: 6,
  spotDistance: 8,
  goalWidth: 5.5,
  goalDepth: 1.2,
  cornerRadius: 0.7,
};

/** Markings a preset never has, so the Field panel does not offer them. */
const NOT_IN_PRESET: Record<FieldPreset, (keyof Markings)[]> = {
  '11v11': [],
  '7v7': ['penaltyAreas', 'buildOutLines'],
  custom: [],
};

export function markingAvailable(preset: FieldPreset, key: keyof Markings): boolean {
  return !NOT_IN_PRESET[preset].includes(key);
}

/** The markings that are drawn: turned on, and possible for the preset. */
export function effectiveMarkings(field: Pick<FieldSettings, 'preset' | 'markings'>): Markings {
  const m = { ...field.markings };
  for (const key of NOT_IN_PRESET[field.preset]) m[key] = false;
  return m;
}

export function defaultMarkings(preset: FieldPreset): Markings {
  return effectiveMarkings({
    preset,
    markings: { penaltyAreas: true, goalAreas: true, centreCircle: true, buildOutLines: false, stripes: true },
  });
}

export function createField(preset: Exclude<FieldPreset, 'custom'>): FieldSettings {
  const size = PRESET_SIZES[preset];
  return {
    preset,
    length: size.length,
    width: size.width,
    orientation: 'horizontal',
    grassColor: '#2E7D43',
    lineColor: '#FFFFFF',
    markings: defaultMarkings(preset),
  };
}

export function clampSize(value: number): number {
  if (!Number.isFinite(value)) return MIN_SIZE;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, value));
}

/**
 * Marking sizes for a field. Presets use their official sizes. Custom fields
 * start from the closest preset and scale down (never up) to fit.
 */
export function markingDims(field: Pick<FieldSettings, 'preset' | 'length' | 'width'>): MarkingDims {
  if (field.preset === '11v11') return { ...DIMS_11 };
  if (field.preset === '7v7') return { ...DIMS_7 };

  const small = field.length < 80;
  const base = small ? DIMS_7 : DIMS_11;
  const baseSize = small ? PRESET_SIZES['7v7'] : PRESET_SIZES['11v11'];
  const s = Math.min(1, field.length / baseSize.length, field.width / baseSize.width);
  const scaled = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v * s])) as unknown as MarkingDims;
  scaled.penaltyWidth = Math.min(scaled.penaltyWidth, field.width * 0.9);
  scaled.goalAreaWidth = Math.min(scaled.goalAreaWidth, scaled.penaltyWidth * 0.8);
  scaled.penaltyDepth = Math.min(scaled.penaltyDepth, field.length * 0.3);
  return scaled;
}

/** Space drawn around the field, in metres. */
export function runoff(field: Pick<FieldSettings, 'length'>): number {
  return field.length >= 80 ? 4 : 3;
}

export interface Polyline {
  points: number[];
  closed?: boolean;
  dashed?: boolean;
}

export interface Spot {
  x: number;
  y: number;
  r: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FieldDrawing {
  lines: Polyline[];
  goals: Polyline[];
  spots: Spot[];
  stripes: Rect[];
}

function arc(cx: number, cy: number, r: number, from: number, to: number, steps = 24): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return pts;
}

/** All field lines in metres, ready to be mapped to the screen. */
export function buildFieldDrawing(field: FieldSettings): FieldDrawing {
  const L = field.length;
  const W = field.width;
  const cy = W / 2;
  const d = markingDims(field);
  const m = effectiveMarkings(field);
  const lines: Polyline[] = [];
  const spots: Spot[] = [];
  const spotR = Math.max(0.15, d.circleRadius * 0.035);

  lines.push({ points: [0, 0, L, 0, L, W, 0, W], closed: true });
  lines.push({ points: [L / 2, 0, L / 2, W] });
  spots.push({ x: L / 2, y: cy, r: spotR });

  if (m.centreCircle) {
    lines.push({ points: arc(L / 2, cy, d.circleRadius, 0, Math.PI * 2, 64), closed: true });
  }

  const box = (depth: number, width: number): void => {
    const top = cy - width / 2;
    const bottom = cy + width / 2;
    lines.push({ points: [0, top, depth, top, depth, bottom, 0, bottom] });
    lines.push({ points: [L, top, L - depth, top, L - depth, bottom, L, bottom] });
  };

  if (m.penaltyAreas) {
    box(d.penaltyDepth, d.penaltyWidth);
    spots.push({ x: d.spotDistance, y: cy, r: spotR }, { x: L - d.spotDistance, y: cy, r: spotR });
    const dx = d.penaltyDepth - d.spotDistance;
    if (d.circleRadius > dx) {
      const t = Math.acos(dx / d.circleRadius);
      lines.push({ points: arc(d.spotDistance, cy, d.circleRadius, -t, t) });
      lines.push({ points: arc(L - d.spotDistance, cy, d.circleRadius, Math.PI - t, Math.PI + t) });
    }
  }

  if (m.goalAreas) box(d.goalAreaDepth, d.goalAreaWidth);

  if (m.buildOutLines) {
    const x = (d.penaltyDepth + L / 2) / 2;
    lines.push({ points: [x, 0, x, W], dashed: true });
    lines.push({ points: [L - x, 0, L - x, W], dashed: true });
  }

  const r = d.cornerRadius;
  lines.push({ points: arc(0, 0, r, 0, Math.PI / 2, 8) });
  lines.push({ points: arc(L, 0, r, Math.PI / 2, Math.PI, 8) });
  lines.push({ points: arc(L, W, r, Math.PI, Math.PI * 1.5, 8) });
  lines.push({ points: arc(0, W, r, Math.PI * 1.5, Math.PI * 2, 8) });

  const gTop = cy - d.goalWidth / 2;
  const gBottom = cy + d.goalWidth / 2;
  const goals: Polyline[] = [
    { points: [0, gTop, -d.goalDepth, gTop, -d.goalDepth, gBottom, 0, gBottom], closed: true },
    { points: [L, gTop, L + d.goalDepth, gTop, L + d.goalDepth, gBottom, L, gBottom], closed: true },
  ];

  const stripes: Rect[] = [];
  if (m.stripes) {
    let count = Math.max(6, Math.round(L / 7.5));
    if (count % 2 === 1) count += 1;
    const sw = L / count;
    for (let i = 0; i < count; i += 2) stripes.push({ x: i * sw, y: 0, w: sw, h: W });
  }

  return { lines, goals, spots, stripes };
}
