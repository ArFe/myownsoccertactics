import type { SportId } from './types';
import { DEFAULT_SPORT, SPORT_IDS } from './sports';

/**
 * The sport a page address asks for: `/soccer` (or `/soccer/`) → 'soccer'.
 * Any other address, `/` included, lands on the default sport.
 */
export function sportFromPath(pathname: string): SportId {
  const first = pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  return SPORT_IDS.find((id) => id === first) ?? DEFAULT_SPORT;
}

/** The address for a sport: 'soccer' → `/soccer`. */
export function pathForSport(id: SportId): string {
  return `/${id}`;
}
