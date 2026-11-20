import type { Board, FieldSettings } from './types';

/** Stretch everything on a board by sx along the length and sy across. */
export function scaleBoardContents(board: Board, sx: number, sy: number): void {
  for (const p of board.players) {
    p.x *= sx;
    p.y *= sy;
  }
  board.ball.x *= sx;
  board.ball.y *= sy;
  for (const a of board.areas) {
    a.x *= sx;
    a.y *= sy;
    a.w *= sx;
    a.h *= sy;
    a.points = a.points.map((v, i) => (i % 2 === 0 ? v * sx : v * sy));
  }
  for (const r of board.arrows) {
    r.x1 *= sx;
    r.x2 *= sx;
    r.y1 *= sy;
    r.y2 *= sy;
  }
  for (const t of board.texts) {
    t.x *= sx;
    t.y *= sy;
  }
  for (const c of board.cones) {
    c.x *= sx;
    c.y *= sy;
  }
}

/** Keep a point on the field or its run-off (`pad` metres around it). */
export function clampToField(field: FieldSettings, pad: number, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(field.length + pad, Math.max(-pad, x)),
    y: Math.min(field.width + pad, Math.max(-pad, y)),
  };
}

export function round(value: number, step = 0.1): number {
  return Math.round(value / step) * step;
}

/** Round to 2 decimals, to keep the save file tidy. */
export function tidy(value: number): number {
  return Math.round(value * 100) / 100;
}
