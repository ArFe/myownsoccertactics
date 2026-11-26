import { BALL_STYLES, BALL_STYLE_IDS, SIZE_IDS } from './balls';
import { createBoard, createSave, nowIso } from './factory';
import { clampSize, isKnownPreset } from './field';
import { MAX_PLAYS, MAX_STEPS, STEP_SECONDS, clampSeconds } from './plays';
import { MAX_SUBS, MAX_WAVES } from './gameDay';
import { setPose } from './pose';
import { cleanPositions, ensureSquad, validNumber } from './squad';
import { DEFAULT_SPORT, SPORT_IDS, getSport } from './sports';
import type { SportDefinition } from './sports/types';
import { APP_ID, SAVE_VERSION } from './types';
import type { Area, Arrow, ArmPose, Board, Cone, FieldSettings, GameDay, NumberSpot, Play, PlayStep, Player, PlayerSpot, SaveFile, SquadMember, Sub, SubWave, SavedPositions, SavedSpot, Team, TeamSide, TextNote } from './types';

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

function readBall(v: Obj, d: Board['ball'], field: FieldSettings): Board['ball'] {
  const style = oneOf(v.style, BALL_STYLE_IDS, d.style);
  const colors = isObj(v.colors) ? v.colors : {};
  return {
    x: num(v.x, field.length / 2),
    y: num(v.y, field.width / 2),
    visible: bool(v.visible, true),
    style,
    // Only the style's own colour slots are kept.
    colors: Object.fromEntries(BALL_STYLES[style].colors.map((c) => [c.key, color(colors[c.key], c.default)])),
    size: oneOf(v.size, SIZE_IDS, d.size),
  };
}

function readSpot(v: unknown, d: { x: number; y: number }): { x: number; y: number } {
  return isObj(v) ? { x: num(v.x, d.x), y: num(v.y, d.y) } : { ...d };
}

/** Arms and height of a player or step spot; defaults are left out. */
function withPose<T extends { arms?: ArmPose; lift?: number }>(target: T, v: Obj): T {
  setPose(target, { arms: oneOf<ArmPose>(v.arms, ['down', 'up'], 'down'), lift: num(v.lift, 0) });
  return target;
}

function readPlayerSpot(v: Obj): PlayerSpot {
  return withPose<PlayerSpot>(readSpot(v, { x: 0, y: 0 }), v);
}

/**
 * Plays keep only what the board has: steps name players and drawings by id,
 * so ids the board does not know are dropped.
 */
function readPlays(v: unknown, players: Player[], drawingIds: Set<string>, ball: Board['ball']): Play[] {
  const playerIds = new Set(players.map((p) => p.id));
  const seen = new Set<string>();
  const plays: Play[] = [];
  list(v)
    .slice(0, MAX_PLAYS)
    .forEach((p, i) => {
      const steps: PlayStep[] = list(p.steps)
        .slice(0, MAX_STEPS)
        .map((st, j) => {
          const spots = isObj(st.players) ? st.players : {};
          const b = isObj(st.ball) ? st.ball : {};
          return {
            id: id(st.id, `st${i}`, j),
            duration: clampSeconds(num(st.duration, STEP_SECONDS)),
            players: Object.fromEntries(
              Object.entries(spots)
                .filter(([pid, spot]) => playerIds.has(pid) && isObj(spot))
                .map(([pid, spot]) => [pid, readPlayerSpot(spot as Obj)]),
            ),
            ball: { ...readSpot(b, ball), visible: bool(b.visible, ball.visible) },
            hidden: Array.isArray(st.hidden)
              ? [...new Set(st.hidden.filter((h): h is string => typeof h === 'string' && drawingIds.has(h)))]
              : [],
          };
        });
      if (steps.length === 0) return; // a play needs a step
      const play: Play = { id: id(p.id, 'pl', i), name: str(p.name, `Play ${i + 1}`), steps };
      if (seen.has(play.id)) play.id = `${play.id}_${i}`;
      seen.add(play.id);
      plays.push(play);
    });
  return plays;
}

function readWaves(v: unknown): SubWave[] {
  const seen = new Set<string>();
  return list(v)
    .slice(0, MAX_WAVES)
    .map((w, j) => ({
      id: id(w.id, 'w', j),
      color: color(w.color, '#2563EB'),
      minute: Math.round(Math.min(150, Math.max(0, num(w.minute, 60)))),
    }))
    .filter((w) => !seen.has(w.id) && !!seen.add(w.id));
}

/** Subs must replace a player on the board; a wave they name must exist. */
function readSubs(v: unknown, players: Player[], waves: SubWave[]): Sub[] {
  const playerIds = new Set(players.map((p) => p.id));
  const waveIds = new Set(waves.map((w) => w.id));
  const seen = new Set<string>();
  return list(v)
    .slice(0, MAX_SUBS)
    .map((s, j) => ({
      id: id(s.id, 'sb', j),
      number: Math.round(Math.min(999, Math.max(0, num(s.number, 12 + j)))),
      name: str(s.name, ''),
      replaces: str(s.replaces, ''),
      waveId: typeof s.waveId === 'string' && waveIds.has(s.waveId) ? s.waveId : null,
      ...memberLink(s.memberId),
    }))
    .filter((s) => playerIds.has(s.replaces) && !seen.has(s.id) && !!seen.add(s.id));
}

/** A member id is kept here and checked against the squad once that is read. */
function memberLink(v: unknown): { memberId?: string } {
  return typeof v === 'string' && v ? { memberId: v } : {};
}

/** Numbers are unique in a sport's squad; a later member with a taken number is dropped. */
function readSquad(v: unknown): SquadMember[] {
  const ids = new Set<string>();
  const numbers = new Set<string>();
  const out: SquadMember[] = [];
  list(v).forEach((m, j) => {
    const number = Math.round(num(m.number, NaN));
    const memberId = id(m.id, 'm', j);
    const sport = oneOf(m.sport, SPORT_IDS, DEFAULT_SPORT);
    const key = `${sport}:${number}`;
    if (!validNumber(number) || numbers.has(key) || ids.has(memberId)) return;
    ids.add(memberId);
    numbers.add(key);
    const positions = Array.isArray(m.positions) ? m.positions.filter((p): p is string => typeof p === 'string') : [];
    out.push({ id: memberId, sport, number, name: str(m.name, '').slice(0, 40), positions: cleanPositions(positions) });
  });
  return out;
}

function readGameDay(v: unknown, d: GameDay): GameDay {
  if (!isObj(v)) return d;
  return {
    on: bool(v.on, d.on),
    team: oneOf<TeamSide>(v.team, ['home', 'away'], d.team),
    subsShown: oneOf(v.subsShown, ['none', 'bench', 'beside', 'both'] as const, d.subsShown),
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
    ? list(v.players).map((p, j) =>
        withPose<Player>(
          {
            id: id(p.id, `p${i}`, j),
            team: oneOf<TeamSide>(p.team, ['home', 'away'], 'home'),
            number: Math.round(num(p.number, j + 1)),
            name: str(p.name, ''),
            role: str(p.role, ''),
            x: num(p.x, 0),
            y: num(p.y, 0),
            ...memberLink(p.memberId),
          },
          p,
        ),
      )
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

  const keptAreas = areas.filter((a) => a.shape !== 'polygon' || a.points.length >= 6);
  const readyBall = readBall(ball, d.ball, field);
  const drawings = new Set([...keptAreas, ...arrows, ...texts, ...cones].map((x) => x.id));
  const waves = readWaves(v.waves);

  return {
    id: id(v.id, 'b', i),
    name: str(v.name, `Board ${i + 1}`),
    sport: sport.id,
    field,
    teams: { home: readTeam(teams.home, d.teams.home), away: readTeam(teams.away, d.teams.away) },
    players,
    playerSize: oneOf(v.playerSize, SIZE_IDS, d.playerSize),
    numberSpot: oneOf<NumberSpot>(v.numberSpot, ['top', 'shirt', 'off'], d.numberSpot),
    ball: readyBall,
    areas: keptAreas,
    arrows,
    texts,
    cones,
    plays: readPlays(v.plays, players, drawings, readyBall),
    subs: readSubs(v.subs, players, waves),
    waves,
    gameDay: readGameDay(v.gameDay, d.gameDay),
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

/** Version 3 to 4: medium players, and a medium soccer ball in its usual colours. */
function v3ToV4(data: Obj): Obj {
  const boards = Array.isArray(data.boards)
    ? data.boards.map((b: unknown) => {
        if (!isObj(b)) return b;
        const ball = isObj(b.ball) ? b.ball : {};
        return {
          ...b,
          playerSize: 'm',
          ball: { ...ball, style: 'soccer', colors: { body: '#FFFFFF', patches: '#111827' }, size: 'm' },
        };
      })
    : data.boards;
  return { ...data, version: 4, boards };
}

/** Version 4 to 5: boards get a list of plays. */
function v4ToV5(data: Obj): Obj {
  const boards = Array.isArray(data.boards)
    ? data.boards.map((b: unknown) => (isObj(b) ? { ...b, plays: [] } : b))
    : data.boards;
  return { ...data, version: 5, boards };
}

/** Version 5 to 6: boards get subs, waves and game day settings (off). */
function v5ToV6(data: Obj): Obj {
  const boards = Array.isArray(data.boards)
    ? data.boards.map((b: unknown) =>
        isObj(b) ? { ...b, subs: [], waves: [], gameDay: { on: false, team: 'home', subsShown: 'bench' } } : b,
      )
    : data.boards;
  return { ...data, version: 6, boards };
}

/**
 * Version 6 to 7: the "Show subs" switch gets "none" and works with game day
 * off too, so boards with game day off get "none" and look as before.
 */
function v6ToV7(data: Obj): Obj {
  const boards = Array.isArray(data.boards)
    ? data.boards.map((b: unknown) =>
        isObj(b) && isObj(b.gameDay) && b.gameDay.on !== true ? { ...b, gameDay: { ...b.gameDay, subsShown: 'none' } } : b,
      )
    : data.boards;
  return { ...data, version: 7, boards };
}

/** Version 7 to 8: saves get a squad (empty). */
function v7ToV8(data: Obj): Obj {
  return { ...data, version: 8, squad: [] };
}

/**
 * Version 8 to 9: numbers show above the head in 3D, as before; arms and
 * height start at their defaults. The volleyball lost its white: its body
 * takes the old third panel's colour (yellow), the blue stays.
 */
function v8ToV9(data: Obj): Obj {
  const boards = Array.isArray(data.boards)
    ? data.boards.map((b: unknown) => {
        if (!isObj(b)) return b;
        const ball = isObj(b.ball) ? b.ball : null;
        const colors = ball && ball.style === 'volleyball' && isObj(ball.colors) ? ball.colors : null;
        const fixed = colors ? { ...ball, colors: { panel1: colors.panel3 ?? '#FFD23F', panel2: colors.panel2 } } : b.ball;
        return { ...b, numberSpot: 'top', ball: fixed };
      })
    : data.boards;
  return { ...data, version: 9, boards };
}

/**
 * Version 9 to 10: each sport has its own squad. The squad so far was made
 * for soccer; other sports' boards get their own members when the save is
 * read (`ensureSquad()`), with the names their spots had.
 */
function v9ToV10(data: Obj): Obj {
  const squad = Array.isArray(data.squad) ? data.squad.map((m: unknown) => (isObj(m) ? { ...m, sport: 'soccer' } : m)) : data.squad;
  return { ...data, version: 10, squad };
}

/** Upgrades older save files, one version at a time. */
export function migrate(data: Obj, from: number): Obj {
  let out = data;
  if (from < 2) out = v1ToV2(out);
  if (from < 3) out = v2ToV3(out);
  if (from < 4) out = v3ToV4(out);
  if (from < 5) out = v4ToV5(out);
  if (from < 6) out = v5ToV6(out);
  if (from < 7) out = v6ToV7(out);
  if (from < 8) out = v7ToV8(out);
  if (from < 9) out = v8ToV9(out);
  if (from < 10) out = v9ToV10(out);
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

  const squad = readSquad(migrated.squad);
  // Our team's spots and subs are squad members, with their number and name.
  ensureSquad({ boards, squad });

  const active = str(migrated.activeBoardId, '');
  return {
    app: APP_ID,
    version: SAVE_VERSION,
    name: str(migrated.name, 'My tactics'),
    activeBoardId: boards.some((b) => b.id === active) ? active : boards[0]!.id,
    boards,
    savedPositions: readSavedPositions(migrated.savedPositions),
    squad,
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
