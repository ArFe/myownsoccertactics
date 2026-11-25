import { defaultBallColors } from './balls';
import { createField, defaultPreset, presetDef } from './field';
import { getFormation, placeFormation } from './formations';
import { DEFAULT_SPORT, getSport } from './sports';
import type { SportDefinition } from './sports/types';
import { APP_ID, SAVE_VERSION } from './types';
import type { Board, FieldSettings, Player, SaveFile, SportId, Team, TeamSide } from './types';

let counter = 0;

/**
 * Deep copy of plain save data. Works on Vue reactive objects too, which
 * structuredClone does not.
 */
export function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Short unique id. Good enough for items inside one save file. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter.toString(36)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createTeam(side: TeamSide, formation: string): Team {
  return side === 'home'
    ? { name: 'Home', shirtColor: '#1D4ED8', numberColor: '#FFFFFF', formation, showNames: true, visible: true }
    : { name: 'Away', shirtColor: '#F97316', numberColor: '#1C1917', formation, showNames: true, visible: true };
}

/**
 * Players for one team in the given formation. Names are kept by index from
 * `previous`, so changing formation does not lose the names typed in.
 */
export function playersInFormation(
  sport: SportDefinition,
  side: TeamSide,
  formationName: string,
  field: Pick<FieldSettings, 'length' | 'width'>,
  previous: Player[] = [],
): Player[] {
  const formation = getFormation(sport, formationName);
  if (!formation) throw new Error(`Unknown formation: ${formationName}`);
  return placeFormation(formation, side, field.length, field.width).map((spot, i) => {
    const old = previous[i];
    return {
      id: old?.id ?? newId('p'),
      team: side,
      number: old?.number ?? spot.number,
      name: old?.name ?? '',
      role: spot.role,
      x: spot.x,
      y: spot.y,
    };
  });
}

export function createBoard(sportId: SportId = DEFAULT_SPORT, presetId?: string, name = 'New board'): Board {
  const sport = getSport(sportId);
  const preset = presetDef(sport, presetId ?? '') ?? defaultPreset(sport);
  const field = createField(sport, preset.id);
  const defaults = preset.defaultFormations;
  return {
    id: newId('b'),
    name,
    sport: sport.id,
    field,
    teams: { home: createTeam('home', defaults.home), away: createTeam('away', defaults.away) },
    players: [
      ...playersInFormation(sport, 'home', defaults.home, field),
      ...playersInFormation(sport, 'away', defaults.away, field),
    ],
    playerSize: 'm',
    ball: {
      x: field.length / 2,
      y: field.width / 2,
      visible: true,
      style: sport.ballStyle,
      colors: defaultBallColors(sport.ballStyle),
      size: 'm',
    },
    areas: [],
    arrows: [],
    texts: [],
    cones: [],
    plays: [],
    subs: [],
    waves: [],
    gameDay: { on: false, team: 'home', subsShown: 'none' },
    updatedAt: nowIso(),
  };
}

export function createSave(name = 'My tactics'): SaveFile {
  const board = createBoard(DEFAULT_SPORT, undefined, 'Board 1');
  return {
    app: APP_ID,
    version: SAVE_VERSION,
    name,
    activeBoardId: board.id,
    boards: [board],
    savedPositions: [],
    updatedAt: nowIso(),
  };
}

/** Deep copy with fresh ids, for "duplicate board" and imports. Plays follow the new ids. */
export function cloneBoardWithNewIds(board: Board, name = board.name): Board {
  const copy: Board = deepCopy(board);
  copy.id = newId('b');
  copy.name = name;
  const ids = new Map<string, string>();
  const renew = (item: { id: string }, prefix: string): void => {
    const next = newId(prefix);
    ids.set(item.id, next);
    item.id = next;
  };
  copy.players.forEach((p) => renew(p, 'p'));
  copy.areas.forEach((a) => renew(a, 'a'));
  copy.arrows.forEach((a) => renew(a, 'r'));
  copy.texts.forEach((t) => renew(t, 't'));
  copy.cones.forEach((c) => renew(c, 'c'));
  const waveIds = new Map<string, string>();
  for (const w of copy.waves) {
    const next = newId('w');
    waveIds.set(w.id, next);
    w.id = next;
  }
  copy.subs = copy.subs.flatMap((s) =>
    ids.has(s.replaces)
      ? [{ ...s, id: newId('sb'), replaces: ids.get(s.replaces)!, waveId: s.waveId ? (waveIds.get(s.waveId) ?? null) : null }]
      : [],
  );
  for (const play of copy.plays) {
    play.id = newId('pl');
    for (const step of play.steps) {
      step.id = newId('st');
      step.players = Object.fromEntries(
        Object.entries(step.players).flatMap(([id, spot]) => (ids.has(id) ? [[ids.get(id)!, spot]] : [])),
      );
      step.hidden = step.hidden.flatMap((id) => (ids.has(id) ? [ids.get(id)!] : []));
    }
  }
  copy.updatedAt = nowIso();
  return copy;
}
