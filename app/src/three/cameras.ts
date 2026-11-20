import type { FieldSettings } from '@/model/types';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Where the orbit camera starts: high on the side of the field, like a TV
 * camera, looking at the centre. A vertical board is seen from behind the
 * home goal instead, as it is drawn in 2D.
 */
export function orbitStart(field: Pick<FieldSettings, 'length' | 'width' | 'orientation'>): Vec3 {
  const L = field.length;
  if (field.orientation === 'vertical') return { x: -L * 1.05, y: L * 0.62, z: 0 };
  return { x: 0, y: L * 0.38, z: field.width / 2 + L * 0.38 };
}

/** Turning from a drag, in radians per pixel. */
export const LOOK_SPEED = 0.005;
/** How far up or down the player can look. */
export const MAX_PITCH = 1.2;

export interface Look {
  /** Turn around the vertical, 0 = looking along +x. */
  yaw: number;
  pitch: number;
}

/** The look that faces `target` from `eye`, level with the horizon. */
export function lookAt(eye: Vec3, target: Vec3): Look {
  return { yaw: Math.atan2(target.z - eye.z, target.x - eye.x), pitch: 0 };
}

export function turn(look: Look, dx: number, dy: number): Look {
  return {
    yaw: look.yaw + dx * LOOK_SPEED,
    pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, look.pitch - dy * LOOK_SPEED)),
  };
}

/** A point one metre ahead of the eye, along the look. */
export function lookTarget(eye: Vec3, look: Look): Vec3 {
  const c = Math.cos(look.pitch);
  return { x: eye.x + Math.cos(look.yaw) * c, y: eye.y + Math.sin(look.pitch), z: eye.z + Math.sin(look.yaw) * c };
}

/** Eye camera field of view, in degrees: smaller is more zoomed in. */
export const EYE_FOV = { start: 70, min: 15, max: 90 };

/**
 * Zooms the eye camera by narrowing or widening its view, like binoculars;
 * the player stays where they stand. `steps` > 0 zooms in.
 */
export function zoomFov(fov: number, steps: number): number {
  return Math.max(EYE_FOV.min, Math.min(EYE_FOV.max, fov * 0.85 ** steps));
}
