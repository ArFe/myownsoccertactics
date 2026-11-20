import type { SportId } from '../types';
import type { SportDefinition } from './types';
import { SOCCER } from './soccer';

/** All sports. Add a new one here, then the sports test checks it. */
export const SPORTS: Record<SportId, SportDefinition> = {
  soccer: SOCCER,
};

export const SPORT_IDS = Object.keys(SPORTS) as SportId[];
export const DEFAULT_SPORT: SportId = 'soccer';

export function getSport(id: SportId): SportDefinition {
  return SPORTS[id] ?? SPORTS[DEFAULT_SPORT];
}

export type * from './types';
