import { createBoard, createSave, nowIso } from './factory';
import { clampSize, isKnownPreset } from './field';
import { DEFAULT_SPORT, SPORT_IDS, getSport } from './sports';
import type { SportDefinition } from './sports/types';
import { APP_ID, SAVE_VERSION } from './types';
import type { Area, Arrow, Board, Cone, FieldSettings, Player, SaveFile, SavedPositions, SavedSpot, Team, TeamSide, TextNote } from './types';

export const STORAGE_KEY = 'myownsoccertactics.save';
export const BROKEN_KEY = 'myownsoccertactics.save.unreadable';

export class SaveFormatError extends Error {}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const oneOf = <T extends string>(v: unknown, options: readonly T[], d: T): T =>
  options.includes(v as T) ? (v as T) : d;
const color = (v: unknown, d: string): string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : d;
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const id = (v: unknown, prefix: string, i: number): string =>
  typeof v === 'string' && v.length > 0 ? v : `${prefix}_${i}`;

function readField(v: unknown, d: FieldSettings, sport: SportDefinition): FieldSettings {
  if (!isObj(v)) return d;
  const m = isObj(v.markings) ? v.markings : {};
  const markings: FieldSettings['markings'] = {};
  // Only the sport's own marking keys are kept.
  for (const def of sport.markings) markings[def.key] = bool(m[def.key], d.markings[def.key] ?? def.default);
  return {
    preset: typeof v.preset === 'string' && isKnownPreset(sport, v.preset) ? v.preset : d.preset,
    length: clampSize(sport, num(v.length, d.length)),
    width: clampSize(sport, num(v.width, d.width)),
    orientation: oneOf(v.orientation, ['horizontal', 'vertical'] as const, d.orientation),
    surfaceColor: color(v.surfaceColor, d.surfaceColor),
    lineColor: color(v.lineColor, d.lineColor),
    markings,
  };
}

function readTeam(v: unknown, d: Team): Team {
  if (!isObj(v)) return d;
  return {
    name: str(v.name, d.name),
    shirtColor: color(v.shirtColor, d.shirtColor),
    numberColor: color(v.numberColor, d.numberColor),
    formation: str(v.formation, d.formation),
    showNames: bool(v.showNames, d.showNames),
    visible: bool(v.visible, d.visible),
  };
}

function readBoard(v: Obj, i: number): Board {
  const sport = getSport(oneOf(v.sport, SPORT_IDS, DEFAULT_SPORT));
  const presetHint = isObj(v.field) && typeof v.field.preset === 'string' ? v.field.preset : undefined;
  const d = createBoard(sport.id, presetHint);
  const field = readField(v.field, d.field, sport);
  const teams = isObj(v.teams) ? v.teams : {};
  const ball = isObj(v.ball) ? v.ball : {};

  const players: Player[] = Array.isArray(v.players)
    ? list(v.players).map((p, j) => ({
        id: id(p.id, `p${i}`, j),
        team: oneOf<TeamSide>(p.team, ['home', 'away'], 'home'),
        number: Math.round(num(p.number, j + 1)),
        name: str(p.name, ''),
        role: str(p.role, ''),
        x: num(p.x, 0),
        y: num(p.y, 0),
      }))
    : d.players;

  const areas: Area[] = list(v.areas).map((a, j) => ({
    id: id(a.id, `a${i}`, j),
    name: str(a.name, `Area ${j + 1}`),
    shape: oneOf(a.shape, ['rect', 'ellipse', 'polygon'] as const, 'rect'),
    x: num(a.x, 0),
    y: num(a.y, 0),
    w: Math.max(0, num(a.w, 10)),
    h: Math.max(0, num(a.h, 10)),
    points: Array.isArray(a.points) ? a.points.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)) : [],
    color: color(a.color, '#FACC15'),
    opacity: Math.min(1, Math.max(0, num(a.opacity, 0.25))),
    border: oneOf(a.border, ['solid', 'dashed', 'none'] as const, 'solid'),
    label: oneOf(a.label, ['top-left', 'centre', 'hidden'] as const, 'top-left'),
    note: str(a.note, ''),
  }));

  const arrows: Arrow[] = list(v.arrows).map((r, j) => ({
    id: id(r.id, `r${i}`, j),
    kind: oneOf(r.kind, ['pass', 'run'] as const, 'pass'),
    x1: num(r.x1, 0),
    y1: num(r.y1, 0),
    x2: num(r.x2, 0),
    y2: num(r.y2, 0),
    color: color(r.color, '#FFFFFF'),
  }));

  const texts: TextNote[] = list(v.texts).map((t, j) => ({
    id: id(t.id, `t${i}`, j),
    text: str(t.text, ''),
    x: num(t.x, 0),
    y: num(t.y, 0),
    color: color(t.color, '#FFFFFF'),
    size: Math.min(10, Math.max(0.5, num(t.size, 2.2))),
  }));

  const cones: Cone[] = list(v.cones).map((c, j) => ({
    id: id(c.id, `c${i}`, j),
    x: num(c.x, 0),
    y: num(c.y, 0),
    color: color(c.color, '#F97316'),
  }));

  return {
    id: id(v.id, 'b', i),
    name: str(v.name, `Board ${i + 1}`),
    sport: sport.id,
    field,
    teams: { home: readTeam(teams.home, d.teams.home), away: readTeam(teams.away, d.teams.away) },
    players,
    ball: { x: num(ball.x, field.length / 2), y: num(ball.y, field.width / 2), visible: bool(ball.visible, true) },
    areas: areas.filter((a) => a.shape !== 'polygon' || a.points.length >= 6),
    arrows,
    texts,
    cones,
    updatedAt: str(v.updatedAt, nowIso()),
  };
}

/** Version 1 to 2: boards get a sport, and grassColor becomes surfaceColor. */
function v1ToV2(data: Obj): Obj {
  const boards = Array.isArray(data.boards)
    ? data.boards.map((b: unknown) => {
        if (!isObj(b)) return b;
        const field = isObj(b.field) ? { ...b.field } : b.field;
        if (isObj(field) && 'grassColor' in field) {
          field.surfaceColor = field.grassColor;
          delete field.grassColor;
        }
        return { ...b, sport: 'soccer', field };
      })
    : data.boards;
  return { ...data, version: 2, boards };
}

/** Version 2 to 3: saves get a list of saved starting positions. */
function v2ToV3(data: Obj): Obj {
  return { ...data, version: 3, savedPositions: [] };
}

/** Upgrades older save files, one version at a time. */
export function migrate(data: Obj, from: number): Obj {
  let out = data;
  if (from < 2) out = v1ToV2(out);
  if (from < 3) out = v2ToV3(out);
  return out;
}

/** Most players a saved team may have; more is not a real file. */
const MAX_SAVED_PLAYERS = 30;

function readSpots(v: unknown): SavedSpot[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const spots = v
    .filter(isObj)
    .slice(0, MAX_SAVED_PLAYERS)
    .map((s, j) => ({
      // A little room past the lines, for the run-off.
      fx: Math.min(1.5, Math.max(-0.5, num(s.fx, 0.5))),
      fy: Math.min(1.5, Math.max(-0.5, num(s.fy, 0.5))),
      number: Math.round(num(s.number, j + 1)),
      name: str(s.name, ''),
      role: str(s.role, ''),
    }));
  return spots.length > 0 ? spots : undefined;
}

function readSavedPositions(v: unknown): SavedPositions[] {
  const seen = new Set<string>();
  const out: SavedPositions[] = [];
  list(v).forEach((s, i) => {
    const set: SavedPositions = {
      id: id(s.id, 's', i),
      name: str(s.name, `Positions ${i + 1}`),
      sport: oneOf(s.sport, SPORT_IDS, DEFAULT_SPORT),
      createdAt: str(s.createdAt, nowIso()),
    };
    const home = readSpots(s.home);
    const away = readSpots(s.away);
    if (home) set.home = home;
    if (away) set.away = away;
    if (isObj(s.ball)) {
      set.ball = {
        fx: Math.min(1.5, Math.max(-0.5, num(s.ball.fx, 0.5))),
        fy: Math.min(1.5, Math.max(-0.5, num(s.ball.fy, 0.5))),
      };
    }
    if (!home && !away) return; // nothing to load
    if (seen.has(set.id)) set.id = `${set.id}_${i}`;
    seen.add(set.id);
    out.push(set);
  });
  return out;
}

/** Reads a save file. Throws SaveFormatError with a message for the user. */
export function parseSave(text: string): SaveFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SaveFormatError('This file is not valid JSON.');
  }
  if (!isObj(data) || data.app !== APP_ID) {
    throw new SaveFormatError('This file is not a Tactics Board save.');
  }
  const version = num(data.version, 1);
  if (version > SAVE_VERSION) {
    throw new SaveFormatError('This save was made by a newer version of the app. Reload the page and try again.');
  }
  const migrated = migrate(data, version);
  const boards = list(migrated.boards).map(readBoard);
  if (boards.length === 0) throw new SaveFormatError('This save has no boards.');

  // Ids must be unique, or selection and deletion go wrong.
  const seen = new Set<string>();
  boards.forEach((b, i) => {
    if (seen.has(b.id)) b.id = `${b.id}_${i}`;
    seen.add(b.id);
  });

  const active = str(migrated.activeBoardId, '');
  return {
    app: APP_ID,
    version: SAVE_VERSION,
    name: str(migrated.name, 'My tactics'),
    activeBoardId: boards.some((b) => b.id === active) ? active : boards[0]!.id,
    boards,
    savedPositions: readSavedPositions(migrated.savedPositions),
    updatedAt: str(migrated.updatedAt, nowIso()),
  };
}

export function serializeSave(save: SaveFile): string {
  return JSON.stringify(save, null, 2);
}

export interface LoadResult {
  save: SaveFile;
  /** Set when a stored save could not be read and a new one was started. */
  warning?: string;
}

export function loadFromStorage(storage: Storage | undefined): LoadResult {
  if (!storage) return { save: createSave() };
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { save: createSave(), warning: 'This browser blocks storage, so changes will not be kept after a reload.' };
  }
  if (!raw) return { save: createSave() };
  try {
    return { save: parseSave(raw) };
  } catch (err) {
    try {
      storage.setItem(BROKEN_KEY, raw);
    } catch {
      /* ignore */
    }
    const reason = err instanceof Error ? err.message : 'Unknown error.';
    return { save: createSave(), warning: `The saved data could not be read (${reason}) A new save was started. The old data is kept under "${BROKEN_KEY}".` };
  }
}

/** Returns false when the browser refused to store it (full or blocked). */
export function writeToStorage(storage: Storage | undefined, save: SaveFile): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
