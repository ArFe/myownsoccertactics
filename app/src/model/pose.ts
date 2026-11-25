import type { ArmPose, PlayerSpot } from './types';

/** How a player stands: arms up or down, and metres off the ground. Shown in 3D only. */
export interface Pose {
  arms: ArmPose;
  lift: number;
}

/** The highest jump, in metres. */
export const MAX_LIFT = 1.5;

export function clampLift(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_LIFT, Math.max(0, n));
}

/** The pose of a player or a step spot; missing fields are the defaults. */
export function poseOf(x: { arms?: ArmPose; lift?: number }): Pose {
  return { arms: x.arms === 'up' ? 'up' : 'down', lift: clampLift(x.lift ?? 0) };
}

/** Sets a pose on a player or spot, leaving out the defaults so files stay small. */
export function setPose(target: { arms?: ArmPose; lift?: number }, pose: Partial<Pose>): void {
  const next = { ...poseOf(target), ...pose };
  if (next.arms === 'up') target.arms = 'up';
  else delete target.arms;
  const lift = clampLift(next.lift);
  if (lift > 0) target.lift = lift;
  else delete target.lift;
}

/** A step spot: the place and the pose, defaults left out. */
export function spotOf(x: { x: number; y: number; arms?: ArmPose; lift?: number }): PlayerSpot {
  const spot: PlayerSpot = { x: x.x, y: x.y };
  setPose(spot, poseOf(x));
  return spot;
}
