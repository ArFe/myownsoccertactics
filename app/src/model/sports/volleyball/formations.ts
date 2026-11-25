import type { Formation, FormationSpot } from '../types';

// Written for the home team on the left, the net at fx = 0.5. The top of the
// court (small fy) is the team's left side. Numbers follow the rotation
// zones: 1 back right, 2 front right, 3 front middle, 4 front left,
// 5 back left, 6 back middle.
const s = (role: string, number: number, fx: number, fy: number): FormationSpot => ({ role, number, fx, fy });
const FRONT = 0.42;
const BACK = 0.17;
const zones = (roles: [string, string, string, string, string, string]): FormationSpot[] => [
  s(roles[0], 1, BACK, 0.8),
  s(roles[1], 2, FRONT, 0.8),
  s(roles[2], 3, FRONT, 0.5),
  s(roles[3], 4, FRONT, 0.2),
  s(roles[4], 5, BACK, 0.2),
  s(roles[5], 6, BACK + 0.04, 0.5),
];

export const VOLLEYBALL_FORMATIONS: Formation[] = [
  // One setter, starting in zone 1; the libero is in for the back-row middle.
  { name: '5-1', size: 6, spots: zones(['S', 'OH', 'MB', 'OPP', 'OH', 'L']) },
  // Two setters opposite each other; the one in the front row sets.
  { name: '4-2', size: 6, spots: zones(['OH', 'S', 'MB', 'OH', 'S', 'MB']) },
  // Two setters opposite each other; the one in the back row sets.
  { name: '6-2', size: 6, spots: zones(['S', 'OH', 'MB', 'S', 'OH', 'MB']) },
  { name: 'Side by side', size: 2, spots: [s('L', 1, 0.25, 0.3), s('R', 2, 0.25, 0.7)] },
  { name: 'Block and defend', size: 2, spots: [s('B', 1, 0.44, 0.5), s('D', 2, 0.15, 0.5)] },
];
