import type { BallStyleId, FieldSettings, SportId, TeamSide } from '../types';

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

/** Everything drawn on the surface, in metres. */
export interface FieldDrawing {
  lines: Polyline[];
  /**
   * Goals, hoops, nets: drawn filled, often outside the lines. In 3D, the
   * corners on the field's edge are the posts, `goalHeight` tall.
   */
  goals: Polyline[];
  goalHeight: number;
  spots: Spot[];
  /** Lighter bands on the surface (mown grass). */
  stripes: Rect[];
}

/** One place in a formation. fx and fy are fractions of the field (0 to 1). */
export interface FormationSpot {
  role: string;
  number: number;
  fx: number;
  fy: number;
}

/**
 * Written for the home team attacking right; the top of the field (small fy)
 * is the team's left side. The away team is turned around automatically.
 */
export interface Formation {
  name: string;
  /** Players on the field, keeper included. */
  size: number;
  spots: FormationSpot[];
}

export interface FieldPresetDef {
  id: string;
  label: string;
  length: number;
  width: number;
  teamSize: number;
  defaultFormations: Record<TeamSide, string>;
}

export interface MarkingDef {
  key: string;
  label: string;
  default: boolean;
  /** Presets that never have this marking, so it is not offered. */
  notIn?: string[];
}

/**
 * Everything the app needs to know about one sport. The rest of the app reads
 * from this instead of knowing the sport's rules itself.
 */
export interface SportDefinition {
  id: SportId;
  name: string;
  /** The first one is the default for new boards. */
  presets: FieldPresetDef[];
  /** Allowed custom sizes, in metres. */
  sizeLimits: { min: number; max: number };
  /** Space drawn around the field, in metres. */
  runoff(field: Pick<FieldSettings, 'length' | 'width'>): number;
  markings: MarkingDef[];
  surface: { label: string; color: string; lineColor: string };
  drawField(field: FieldSettings): FieldDrawing;
  formations: Formation[];
  /** The ball new boards start with. */
  ballStyle: BallStyleId;
}
