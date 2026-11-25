import { newId } from './factory';
import type { SportDefinition } from './sports/types';
import type { Board, Player, SquadMember, Sub, TeamSide } from './types';

/** The squad is our players, shared by every board of a save. */
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

/** The member who has this number, other than `exceptId`. */
export function numberOwner(squad: SquadMember[], number: number, exceptId?: string): SquadMember | undefined {
  return squad.find((m) => m.number === number && m.id !== exceptId);
}

export function takenMessage(number: number, by: Pick<SquadMember, 'number' | 'name'>): string {
  return `Number ${number} is taken${by.name ? ` by ${by.name}` : ''}.`;
}

/** The lowest number from 1 up that nobody in `used` has. */
export function nextFreeNumber(used: Iterable<number>): number {
  const set = new Set(used);
  let n = 1;
  while (set.has(n)) n++;
  return n;
}

/** Checks a new or changed member; returns what is wrong, or null. */
export function memberProblem(squad: SquadMember[], m: Pick<SquadMember, 'number' | 'name'>, exceptId?: string): string | null {
  if (!validNumber(m.number)) return 'A number is a whole number from 0 to 999.';
  const owner = numberOwner(squad, m.number, exceptId);
  return owner ? takenMessage(m.number, owner) : null;
}

export function createMember(input: { number: number; name: string; positions?: string[] }): SquadMember {
  return {
    id: newId('m'),
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

/** Who else on the team has this number. */
export function numberHolder(board: Board, team: TeamSide, number: number, except?: Holder): Holder | undefined {
  return holders(board, team).find((h) => h !== except && h.number === number);
}

/** Ids of the squad members already on the field or bench of this board. */
export function membersOnBoard(board: Board): Set<string> {
  const out = new Set<string>();
  for (const h of [...board.players, ...board.subs]) if (h.memberId) out.add(h.memberId);
  return out;
}

/**
 * Puts a squad member in a field spot or on the bench, or (with null) takes
 * the link off and keeps the number and name. Whoever on the team had the
 * member's number, or the member itself, gets the spot's old number.
 */
export function assignMember(board: Board, item: Holder, member: SquadMember | null): void {
  if (!member) {
    delete item.memberId;
    return;
  }
  const team = teamOf(board, item);
  const old = item.number;
  if (team) {
    for (const h of holders(board, team)) {
      if (h === item) continue;
      if (h.memberId === member.id || h.number === member.number) {
        h.number = old;
        if (h.memberId === member.id) delete h.memberId;
      }
    }
  }
  item.number = member.number;
  item.name = member.name;
  item.memberId = member.id;
}

/**
 * No two players of a team, field or bench, share a number. Squad members
 * keep theirs; anyone else with a number already taken gets the lowest free one.
 */
export function fixNumberClashes(board: Board): void {
  for (const team of ['home', 'away'] as TeamSide[]) {
    const all = holders(board, team);
    const numbers = new Set(all.map((h) => h.number));
    const taken = new Set<number>();
    const order = [...all.filter((h) => h.memberId), ...all.filter((h) => !h.memberId)];
    for (const h of order) {
      if (taken.has(h.number)) {
        delete h.memberId;
        h.number = nextFreeNumber([...taken, ...numbers]);
        numbers.add(h.number);
      }
      taken.add(h.number);
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

/** Takes a member off every board: spots and subs keep the number and name. */
export function unlinkMember(boards: Board[], id: string): void {
  for (const b of boards) for (const h of [...b.players, ...b.subs]) if (h.memberId === id) delete h.memberId;
}

/** Drops links to members that are not in the squad. */
export function tidyMemberLinks(boards: Board[], squad: SquadMember[]): void {
  const ids = new Set(squad.map((m) => m.id));
  for (const b of boards) for (const h of [...b.players, ...b.subs]) if (h.memberId && !ids.has(h.memberId)) delete h.memberId;
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
 * Reads players from CSV: `number,name,positions`, positions split by "/"
 * (e.g. `9,Ariel,ST/LW`). A header row is optional. Rows whose number is
 * taken (in the squad or earlier in the file) or not a number are skipped,
 * with the reason.
 */
export function parseSquadCsv(text: string, squad: SquadMember[]): CsvResult {
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
    const owner = numberOwner([...squad, ...members], number);
    if (owner) {
      skipped.push({ row, reason: takenMessage(number, owner) });
      return;
    }
    if (squad.length + members.length >= MAX_SQUAD) {
      skipped.push({ row, reason: `The squad is full (${MAX_SQUAD} players).` });
      return;
    }
    members.push(createMember({ number, name, positions: parsePositions(positions) }));
  });
  return { members, skipped };
}
