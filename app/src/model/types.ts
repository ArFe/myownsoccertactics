import type { BallStyleId, SizeId } from './balls';

export type { BallStyleId, SizeId };

// All positions are in metres. (0, 0) is the top-left corner of the field
// when it is drawn horizontally; x runs along the length, y across the width.
// The home team attacks towards x = length.

export type TeamSide = 'home' | 'away';
export type Orientation = 'horizontal' | 'vertical';

/** Sports the app knows. Each one has a definition in model/sports. */
export type SportId = 'soccer' | 'volleyball';

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
  style: BallStyleId;
  /** One colour per colour slot of the style, by slot key. */
  colors: Record<string, string>;
  size: SizeId;
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
  /** One size for every player on the board. */
  playerSize: SizeId;
  ball: Ball;
  areas: Area[];
  arrows: Arrow[];
  texts: TextNote[];
  cones: Cone[];
  /** Named step-by-step moves of the players and the ball. */
  plays: Play[];
  /** Players waiting to come on, each for one player on the field. */
  subs: Sub[];
  /** Substitution times, each with a colour. */
  waves: SubWave[];
  gameDay: GameDay;
  updatedAt: string;
}

export interface Sub {
  id: string;
  number: number;
  name: string;
  /** Id of the player on the field this sub comes on for. */
  replaces: string;
  /** The wave this sub comes on in, or null if not planned yet. */
  waveId: string | null;
}

/** A substitution time: every sub in it, and who they replace, shows its colour. */
export interface SubWave {
  id: string;
  color: string;
  /** Match minute. */
  minute: number;
}

export type SubsShown = 'none' | 'bench' | 'beside' | 'both';

/** Game day mode: only our team, its subs and the wave colours. */
export interface GameDay {
  on: boolean;
  team: TeamSide;
  subsShown: SubsShown;
}

/** A place on the field, in metres. */
export interface Spot {
  x: number;
  y: number;
}

/** One step of a play: where everyone stands, and which drawings show. */
export interface PlayStep {
  id: string;
  /** Seconds to move here from the step before. Not used on the first step. */
  duration: number;
  /** By player id. A player missing here stands where the board has them. */
  players: Record<string, Spot>;
  ball: Spot & { visible: boolean };
  /** Ids of areas, arrows, notes and cones not shown on this step. */
  hidden: string[];
}

export interface Play {
  id: string;
  name: string;
  /** Always at least one step. */
  steps: PlayStep[];
}

export const APP_ID = 'myownsoccertactics';
/**
 * Version history:
 * 1. First version (soccer only).
 * 2. Boards have a `sport`; `field.grassColor` became `field.surfaceColor`.
 * 3. Saves have `savedPositions` (named starting positions).
 * 4. Boards have `playerSize`; the ball has `style`, `colors` and `size`.
 * 5. Boards have `plays` (steps of player and ball moves).
 * 6. Boards have `subs`, `waves` and `gameDay`.
 */
export const SAVE_VERSION = 7;

/**
 * One player's place in a saved set. fx and fy are fractions of the field
 * (0 to 1, a little more in the run-off), so a set fits any field size.
 */
export interface SavedSpot {
  fx: number;
  fy: number;
  number: number;
  name: string;
  role: string;
}

/** Named starting positions for one or both teams, reusable on any board of the same sport. */
export interface SavedPositions {
  id: string;
  name: string;
  sport: SportId;
  home?: SavedSpot[];
  away?: SavedSpot[];
  /** Where the ball was, as fractions of the field. */
  ball?: { fx: number; fy: number };
  createdAt: string;
}

export interface SaveFile {
  app: typeof APP_ID;
  version: typeof SAVE_VERSION;
  name: string;
  activeBoardId: string;
  boards: Board[];
  savedPositions: SavedPositions[];
  updatedAt: string;
}
