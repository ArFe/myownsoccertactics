import type { Formation, SportDefinition } from './sports/types';
import type { TeamSide } from './types';

export function getFormation(sport: SportDefinition, name: string): Formation | undefined {
  return sport.formations.find((f) => f.name === name);
}

export function formationsOfSize(sport: SportDefinition, size: number): Formation[] {
  return sport.formations.filter((f) => f.size === size);
}

/** Formations grouped by team size, biggest first, for a picker. */
export function formationGroups(sport: SportDefinition): { size: number; items: Formation[] }[] {
  const sizes = [...new Set(sport.formations.map((f) => f.size))].sort((a, b) => b - a);
  return sizes.map((size) => ({ size, items: formationsOfSize(sport, size) }));
}

export interface PlacedSpot {
  role: string;
  number: number;
  x: number;
  y: number;
}

/**
 * Formation spots in metres. The away team is turned 180 degrees, so it
 * attacks left and its left side is at the bottom.
 */
export function placeFormation(formation: Formation, side: TeamSide, length: number, width: number): PlacedSpot[] {
  return formation.spots.map((sp) => {
    const fx = side === 'home' ? sp.fx : 1 - sp.fx;
    const fy = side === 'home' ? sp.fy : 1 - sp.fy;
    return { role: sp.role, number: sp.number, x: fx * length, y: fy * width };
  });
}
