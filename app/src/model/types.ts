// All positions are in metres. (0, 0) is the top-left corner of the field
// when it is drawn horizontally; x runs along the length, y across the width.
// The home team attacks towards x = length.

export type TeamSide = 'home' | 'away';
export type Orientation = 'horizontal' | 'vertical';

/** Sports the app knows. Each one has a definition in model/sports. */
export type SportId = 'soccer';

/** A preset id from the board's sport (e.g. "11v11"), or "custom". */
export type FieldPreset = string;
export const CUSTOM_PRESET = 'custom';

/** Which field markings are turned on, by key. The sport lists the keys. */
export type Markings = Record<string, boolean>;

export interface FieldSettings {
  preset: FieldPreset;
  length: number;
  width: number;
  orientation: Orientation;
  surfaceColor: string;
  lineColor: string;
  markings: Markings;
}

export interface Team {
  name: string;
  shirtColor: string;
  numberColor: string;
  formation: string;
  showNames: boolean;
  visible: boolean;
}

export interface Player {
  id: string;
  team: TeamSide;
  number: number;
  name: string;
  role: string;
  x: number;
  y: number;
}

export interface Ball {
  x: number;
  y: number;
  visible: boolean;
}

export type AreaShape = 'rect' | 'ellipse' | 'polygon';
export type AreaBorder = 'solid' | 'dashed' | 'none';
export type AreaLabel = 'top-left' | 'centre' | 'hidden';

export interface Area {
  id: string;
  name: string;
  shape: AreaShape;
  /** Bounding box for rect and ellipse. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Flat [x1, y1, x2, y2, ...] list, used by polygons only. */
  points: number[];
  color: string;
  /** 0 to 1. */
  opacity: number;
  border: AreaBorder;
  label: AreaLabel;
  note: string;
}

export type ArrowKind = 'pass' | 'run';

export interface Arrow {
  id: string;
  kind: ArrowKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface TextNote {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  /** Font size in metres, so text scales with the field. */
  size: number;
}

export interface Cone {
  id: string;
  x: number;
  y: number;
  color: string;
}

export interface Board {
  id: string;
  name: string;
  sport: SportId;
  field: FieldSettings;
  teams: Record<TeamSide, Team>;
  players: Player[];
  ball: Ball;
  areas: Area[];
  arrows: Arrow[];
  texts: TextNote[];
  cones: Cone[];
  updatedAt: string;
}

export const APP_ID = 'myownsoccertactics';
/**
 * Version history:
 * 1. First version (soccer only).
 * 2. Boards have a `sport`; `field.grassColor` became `field.surfaceColor`.
 */
export const SAVE_VERSION = 2;

export interface SaveFile {
  app: typeof APP_ID;
  version: typeof SAVE_VERSION;
  name: string;
  activeBoardId: string;
  boards: Board[];
  updatedAt: string;
}
