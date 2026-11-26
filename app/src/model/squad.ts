import { newId } from './factory';
import type { SportDefinition } from './sports/types';
import type { Board, Player, SaveFile, SportId, SquadMember, Sub, TeamSide } from './types';

/**
 * The squad is our players, one squad per sport, shared by every board of
 * that sport. Every player and sub of our team (`gameDay.team`) is a member:
 * `ensureSquad()` links them, and makes a member with no name when needed.
 */
export const MAX_SQUAD = 60;
export const MAX_POSITIONS = 6;
const MAX_NAME = 40;

/** Something with a shirt number on a board: a player on the field or a sub. */
export type Holder = Player | Sub;

export function validNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 999;
}

/** Position names from text like "ST/LW", "st, lw" or "ST LW": upper case, no repeats. */
export function parsePositions(text: string): string[] {
  return cleanPositions(text.split(/[\/,;|\s]+/));
}

export function cleanPositions(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const p = raw.trim().toUpperCase().slice(0, 8);
    if (p && !out.includes(p)) out.push(p);
  }
  return out.slice(0, MAX_POSITIONS);
}

/** Every role the sport's formations use, in the order they first appear. */
export function rolesOf(sport: SportDefinition): string[] {
  const out: string[] = [];
  for (const f of sport.formations) for (const s of f.spots) if (s.role && !out.includes(s.role)) out.push(s.role);
  return out;
}

export function memberLabel(m: Pick<SquadMember, 'number' | 'name'>): string {
  return m.name ? `${m.number} ${m.name}` : String(m.number);
}

/** A member made for a spot, with nothing typed yet: no name, no positions. */
export function isBlank(m: Pick<SquadMember, 'name' | 'positions'>): boolean {
  return !m.name.trim() && m.positions.length === 0;
}

/** The members of one sport. */
export function squadOf(squad: SquadMember[], sport: SportId): SquadMember[] {
  return squad.filter((m) => m.sport === sport);
}

/** The member who has this number, other than `exceptId`. */
export function numberOwner(squad: SquadMember[], number: number, exceptId?: string): SquadMember | undefined {
  return squad.find((m) => m.number === number && m.id !== exceptId);
}

/** The member who has this number and a name or positions; a blank member can be filled in. */
export function namedOwner(squad: SquadMember[], number: number, exceptId?: string): SquadMember | undefined {
  return squad.find((m) => m.number === number && m.id !== exceptId && !isBlank(m));
}

export function takenMessage(number: number, by: Pick<SquadMember, 'number' | 'name'>): string {
  return `Number ${number} is taken${by.name ? ` by ${by.name}` : ''}.`;
}

/** The lowest number from 1 up whose member is blank or missing: the next one to add. */
export function nextNumberToAdd(squad: SquadMember[]): number {
  return nextFreeNumber(squad.filter((m) => !isBlank(m)).map((m) => m.number));
}

/** The lowest number from 1 up that nobody in `used` has. */
export function nextFreeNumber(used: Iterable<number>): number {
  const set = new Set(used);
  let n = 1;
  while (set.has(n)) n++;
  return n;
}

/**
 * Checks a new or changed member against one sport's squad; returns what is
 * wrong, or null. With `blankFree`, a blank member's number counts as free
 * (a new player fills that member in).
 */
export function memberProblem(
  squad: SquadMember[],
  m: Pick<SquadMember, 'number' | 'name'>,
  exceptId?: string,
  blankFree = false,
): string | null {
  if (!validNumber(m.number)) return 'A number is a whole number from 0 to 999.';
  const owner = (blankFree ? namedOwner : numberOwner)(squad, m.number, exceptId);
  return owner ? takenMessage(m.number, owner) : null;
}

export function createMember(input: { sport: SportId; number: number; name: string; positions?: string[] }): SquadMember {
  return {
    id: newId('m'),
    sport: input.sport,
    number: input.number,
    name: input.name.trim().slice(0, MAX_NAME),
    positions: cleanPositions(input.positions ?? []),
  };
}

// ---------- members on a board ----------

/** The team a field player or sub plays for. */
export function teamOf(board: Board, item: Holder): TeamSide | undefined {
  if ('team' in item) return item.team;
  return board.players.find((p) => p.id === item.replaces)?.team;
}

/** The field players of a team, then the subs who come on for them. */
export function holders(board: Board, team: TeamSide): Holder[] {
  const players = board.players.filter((p) => p.team === team);
  const ids = new Set(players.map((p) => p.id));
  return [...players, ...board.subs.filter((s) => ids.has(s.replaces))];
}

export function isSub(h: Holder): h is Sub {
  return 'replaces' in h;
}

/** Who else on the team has this number. */
export function numberHolder(board: Board, team: TeamSide, number: number, except?: Holder): Holder | undefined {
  return holders(board, team).find((h) => h !== except && h.number === number);
}

/**
 * Puts a squad member in a field spot or on the bench, or (with null) takes
 * the link off and keeps the number and name. Whoever on the team had the
 * member, or the member's number, swaps: they take the spot's old member,
 * number and name (every sub who was that member, for a field spot). One member may be a sub for several players, so other subs who are
 * the member stay as they are.
 */
export function assignMember(board: Board, item: Holder, member: SquadMember | null): void {
  if (!member) {
    delete item.memberId;
    return;
  }
  const team = teamOf(board, item);
  const old = { number: item.number, name: item.name, memberId: item.memberId };
  if (team) {
    for (const h of holders(board, team)) {
      if (h === item) continue;
      if (h.memberId === member.id || h.number === member.number) {
        if (isSub(item) && isSub(h) && h.replaces !== item.replaces) continue;
        h.number = old.number;
        h.name = old.name;
        if (old.memberId) h.memberId = old.memberId;
        else delete h.memberId;
      }
    }
  }
  item.number = member.number;
  item.name = member.name;
  item.memberId = member.id;
}

/** May `h` share its number with everyone in `before`? Only subs who are one member, for different players. */
function mayShare(h: Holder, before: Holder[]): boolean {
  return (
    isSub(h) &&
    !!h.memberId &&
    before.every((o) => isSub(o) && o.memberId === h.memberId && o.replaces !== h.replaces)
  );
}

/**
 * No two players of a team, field or bench, share a number, except one
 * squad member who is a sub for several players. Squad members keep theirs;
 * anyone else with a number already taken gets the lowest free one (a member
 * who loses their number loses the name too, as it was theirs).
 */
export function fixNumberClashes(board: Board): void {
  for (const team of ['home', 'away'] as TeamSide[]) {
    const all = holders(board, team);
    const numbers = new Set(all.map((h) => h.number));
    const taken = new Map<number, Holder[]>();
    const order = [...all.filter((h) => h.memberId), ...all.filter((h) => !h.memberId)];
    for (const h of order) {
      const before = taken.get(h.number);
      if (before && !mayShare(h, before)) {
        if (h.memberId) {
          delete h.memberId;
          h.name = '';
        }
        h.number = nextFreeNumber([...taken.keys(), ...numbers]);
        numbers.add(h.number);
      }
      taken.set(h.number, [...(taken.get(h.number) ?? []), h]);
    }
  }
}

/**
 * Makes every player and sub of our team (`gameDay.team`) on every board a
 * member of that board's sport squad; the other team links to no one.
 * - A link to a member of the sport stays; the spot takes their number and name.
 * - Any other spot links to the member with its number, or to a new member
 *   with no name. A blank member takes the spot's name, if it has one (a save
 *   from before, or the other team becoming ours).
 */
export function ensureSquad(save: Pick<SaveFile, 'boards' | 'squad'>): void {
  for (const b of save.boards) {
    const ours = b.gameDay.team;
    for (const p of b.players) if (p.team !== ours) delete p.memberId;
    const team = holders(b, ours);
    const ids = new Set(team.map((h) => h.id));
    for (const s of b.subs) if (!ids.has(s.id)) delete s.memberId;

    const squad = save.squad;
    const byId = new Map(squadOf(squad, b.sport).map((m) => [m.id, m]));
    for (const h of team) {
      const m = h.memberId ? byId.get(h.memberId) : undefined;
      if (!m) delete h.memberId;
      else Object.assign(h, { number: m.number, name: m.name });
    }
    fixNumberClashes(b);
    for (const h of team) {
      if (h.memberId) continue;
      let m = squad.find((x) => x.sport === b.sport && x.number === h.number);
      if (!m) {
        m = createMember({ sport: b.sport, number: h.number, name: '' });
        squad.push(m);
      }
      if (!m.name && h.name.trim()) m.name = h.name.trim().slice(0, MAX_NAME);
      h.memberId = m.id;
      h.name = m.name;
    }
  }
  // A name a member just took shows on every spot that is them.
  for (const b of save.boards) {
    const byId = new Map(squadOf(save.squad, b.sport).map((m) => [m.id, m]));
    for (const h of [...b.players, ...b.subs]) {
      const m = h.memberId ? byId.get(h.memberId) : undefined;
      if (m) h.name = m.name;
    }
  }
}

/** Copies a member's number and name to every spot and sub that names them. */
export function syncMember(boards: Board[], member: SquadMember): void {
  for (const b of boards) {
    let touched = false;
    for (const h of [...b.players, ...b.subs]) {
      if (h.memberId !== member.id) continue;
      h.number = member.number;
      h.name = member.name;
      touched = true;
    }
    if (touched) fixNumberClashes(b);
  }
}

/**
 * Takes a member off every board: spots and subs keep the number but not the
 * name, so `ensureSquad()` puts a new member with no name there.
 */
export function unlinkMember(boards: Board[], id: string): void {
  for (const b of boards) {
    for (const h of [...b.players, ...b.subs]) {
      if (h.memberId !== id) continue;
      delete h.memberId;
      h.name = '';
    }
  }
}

// ---------- CSV ----------

export interface CsvSkip {
  row: number;
  reason: string;
}
export interface CsvResult {
  members: SquadMember[];
  skipped: CsvSkip[];
}

/** Splits one CSV line; a field in double quotes may hold commas and "" for a quote. */
function csvCells(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';' || c === '\t') {
      cells.push(cur);
      cur = '';
    } else cur += c;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/**
 * Reads players from CSV into one sport's squad: `number,name,positions`,
 * positions split by "/" (e.g. `9,Ariel,ST/LW`). A header row is optional.
 * Rows whose number is taken (by a member with a name or positions, or
 * earlier in the file) or not a number are skipped, with the reason. A row
 * with a blank member's number fills that member in (the store does that).
 */
export function parseSquadCsv(text: string, squad: SquadMember[], sport: SportId): CsvResult {
  const members: SquadMember[] = [];
  const skipped: CsvSkip[] = [];
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((line, i) => {
    const row = i + 1;
    if (!line.trim()) return;
    const [num = '', name = '', positions = ''] = csvCells(line);
    if (i === 0 && !/^\d+$/.test(num)) return; // a header row
    const number = Number(num);
    if (num === '' || !validNumber(number)) {
      skipped.push({ row, reason: `"${num}" is not a shirt number.` });
      return;
    }
    const owner = namedOwner(squad, number) ?? numberOwner(members, number);
    if (owner) {
      skipped.push({ row, reason: takenMessage(number, owner) });
      return;
    }
    const fills = squad.some((m) => m.number === number);
    if (!fills && squad.length + members.filter((m) => !squad.some((x) => x.number === m.number)).length >= MAX_SQUAD) {
      skipped.push({ row, reason: `The squad is full (${MAX_SQUAD} players).` });
      return;
    }
    members.push(createMember({ sport, number, name, positions: parsePositions(positions) }));
  });
  return { members, skipped };
}
