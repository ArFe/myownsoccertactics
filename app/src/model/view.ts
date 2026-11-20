import { runoff } from './field';
import type { FieldSettings, Orientation } from './types';

/**
 * Maps metres on the field to pixels on the screen.
 * Horizontal: home goal on the left. Vertical: home goal at the bottom,
 * so the home team attacks up.
 */
export interface View {
  scale: number;
  pad: number;
  length: number;
  width: number;
  orientation: Orientation;
  /** Stage size in pixels. */
  stageWidth: number;
  stageHeight: number;
  /** Size unit for players, text and lines: 1 at a 1000 px stage. */
  unit: number;
}

export function makeView(field: FieldSettings, maxWidth: number, maxHeight = Infinity): View {
  const pad = runoff(field);
  const vertical = field.orientation === 'vertical';
  const spanX = (vertical ? field.width : field.length) + pad * 2;
  const spanY = (vertical ? field.length : field.width) + pad * 2;
  const scale = Math.max(0.1, Math.min(maxWidth / spanX, maxHeight / spanY));
  const stageWidth = Math.round(spanX * scale);
  const stageHeight = Math.round(spanY * scale);
  return {
    scale,
    pad,
    length: field.length,
    width: field.width,
    orientation: field.orientation,
    stageWidth,
    stageHeight,
    unit: Math.max(stageWidth, stageHeight) / 1000,
  };
}

export interface Point {
  x: number;
  y: number;
}

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function toScreen(v: View, x: number, y: number): Point {
  if (v.orientation === 'vertical') {
    return { x: (y + v.pad) * v.scale, y: (v.length - x + v.pad) * v.scale };
  }
  return { x: (x + v.pad) * v.scale, y: (y + v.pad) * v.scale };
}

export function toWorld(v: View, sx: number, sy: number): Point {
  if (v.orientation === 'vertical') {
    return { x: v.length - (sy / v.scale - v.pad), y: sx / v.scale - v.pad };
  }
  return { x: sx / v.scale - v.pad, y: sy / v.scale - v.pad };
}

/** Flat [x, y, x, y, ...] world list to a flat screen list. */
export function pointsToScreen(v: View, pts: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const p = toScreen(v, pts[i]!, pts[i + 1]!);
    out.push(p.x, p.y);
  }
  return out;
}

export function pointsToWorld(v: View, pts: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const p = toWorld(v, pts[i]!, pts[i + 1]!);
    out.push(p.x, p.y);
  }
  return out;
}

export function rectToScreen(v: View, r: ScreenRect): ScreenRect {
  if (v.orientation === 'vertical') {
    return {
      x: (r.y + v.pad) * v.scale,
      y: (v.length - r.x - r.w + v.pad) * v.scale,
      w: r.h * v.scale,
      h: r.w * v.scale,
    };
  }
  return { x: (r.x + v.pad) * v.scale, y: (r.y + v.pad) * v.scale, w: r.w * v.scale, h: r.h * v.scale };
}

export function rectToWorld(v: View, r: ScreenRect): ScreenRect {
  if (v.orientation === 'vertical') {
    const w = r.h / v.scale;
    return { x: v.length - (r.y / v.scale - v.pad) - w, y: r.x / v.scale - v.pad, w, h: r.w / v.scale };
  }
  return { x: r.x / v.scale - v.pad, y: r.y / v.scale - v.pad, w: r.w / v.scale, h: r.h / v.scale };
}

/** Normalise a rectangle dragged in any direction. */
export function normaliseRect(x1: number, y1: number, x2: number, y2: number): ScreenRect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

export function boundingBox(pts: number[]): ScreenRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]!);
    maxX = Math.max(maxX, pts[i]!);
    minY = Math.min(minY, pts[i + 1]!);
    maxY = Math.max(maxY, pts[i + 1]!);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
