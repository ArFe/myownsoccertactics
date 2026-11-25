import type { FieldSettings } from '../../types';
import { effectiveMarkings } from '../markings';
import type { FieldDrawing, FieldPresetDef, MarkingDef, Polyline } from '../types';

// Indoor: 18 x 9 m, the attack line 3 m from the net. Beach: 16 x 8 m, no
// centre line and no attack line.
export const VOLLEYBALL_PRESETS: FieldPresetDef[] = [
  { id: '6v6', label: 'Indoor 6v6', length: 18, width: 9, teamSize: 6, defaultFormations: { home: '5-1', away: '5-1' } },
  { id: '2v2', label: 'Beach 2v2', length: 16, width: 8, teamSize: 2, defaultFormations: { home: 'Side by side', away: 'Side by side' } },
];

export const VOLLEYBALL_MARKINGS: MarkingDef[] = [
  { key: 'centreLine', label: 'Centre line', default: true, notIn: ['2v2'] },
  { key: 'attackLines', label: 'Attack lines', default: true, notIn: ['2v2'] },
];

/** Top of the net (men's height; women play at 2.24 m). */
export const NET_HEIGHT = 2.43;
/** The net's posts stand this far outside the sidelines. */
export const POST_OFFSET = 1;
/** Dashed attack-line extensions past each sideline (5 × 15 cm, 20 cm gaps). */
const EXTENSION = 1.75;

export function volleyballRunoff(): number {
  return 3;
}

/** All volleyball court lines in metres, ready to be mapped to the screen. */
export function drawVolleyballField(field: FieldSettings): FieldDrawing {
  const L = field.length;
  const W = field.width;
  const m = effectiveMarkings(VOLLEYBALL_MARKINGS, field);
  const lines: Polyline[] = [{ points: [0, 0, L, 0, L, W, 0, W], closed: true }];

  if (m.centreLine) lines.push({ points: [L / 2, 0, L / 2, W] });

  if (m.attackLines) {
    // 3 m on an 18 m court: a sixth of the length, so custom courts keep the shape.
    for (const x of [L / 2 - L / 6, L / 2 + L / 6]) {
      lines.push({ points: [x, 0, x, W] });
      lines.push({ points: [x, -EXTENSION, x, 0], dashed: true });
      lines.push({ points: [x, W, x, W + EXTENSION], dashed: true });
    }
  }

  return {
    lines,
    goals: [],
    goalHeight: NET_HEIGHT,
    nets: [{ points: [L / 2, -POST_OFFSET, L / 2, W + POST_OFFSET], height: NET_HEIGHT, depth: 1 }],
    spots: [],
    stripes: [],
  };
}
