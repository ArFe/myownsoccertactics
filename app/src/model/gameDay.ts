import { newId } from './factory';
import type { Board, Player, Sub, SubWave } from './types';

/** Colours offered for new waves, in order. */
export const WAVE_COLORS = ['#2563EB', '#DC2626', '#EAB308', '#9333EA', '#16A34A', '#EC4899'];
export const MAX_SUBS = 30;
export const MAX_WAVES = 10;

export function createWave(board: Board): SubWave {
  const used = new Set(board.waves.map((w) => w.color.toUpperCase()));
  const color = WAVE_COLORS.find((c) => !used.has(c)) ?? WAVE_COLORS[board.waves.length % WAVE_COLORS.length]!;
  const last = Math.max(45, ...board.waves.map((w) => w.minute));
  return { id: newId('w'), color, minute: board.waves.length === 0 ? 60 : Math.min(120, last + 15) };
}

/** A new sub for `replaces`, numbered after everyone on the team. */
export function createSub(board: Board, replaces: Player): Sub {
  const team = board.players.filter((p) => p.team === replaces.team).map((p) => p.number);
  const benched = board.subs.filter((s) => playerOf(board, s)?.team === replaces.team).map((s) => s.number);
  const number = Math.max(team.length + 1, ...team.map((n) => n + 1), ...benched.map((n) => n + 1));
  return { id: newId('sb'), number, name: '', replaces: replaces.id, waveId: null };
}

function setMember(item: { memberId?: string }, id: string | undefined): void {
  if (id) item.memberId = id;
  else delete item.memberId;
}

export function playerOf(board: Board, sub: Sub): Player | undefined {
  return board.players.find((p) => p.id === sub.replaces);
}

export function waveOf(board: Board, sub: Sub): SubWave | undefined {
  return sub.waveId ? board.waves.find((w) => w.id === sub.waveId) : undefined;
}

/** Waves by minute; a sub with no wave comes last. */
function byWave(board: Board): (a: Sub, b: Sub) => number {
  const minute = (s: Sub) => waveOf(board, s)?.minute ?? Infinity;
  return (a, b) => minute(a) - minute(b) || a.number - b.number;
}

/** The subs of one team, in the order they come on. */
export function teamSubs(board: Board, team: Player['team']): Sub[] {
  return board.subs.filter((s) => playerOf(board, s)?.team === team).sort(byWave(board));
}

/** Subs waiting for one player, in the order they come on. */
export function subsFor(board: Board, playerId: string): Sub[] {
  return board.subs.filter((s) => s.replaces === playerId).sort(byWave(board));
}

/** The colour of the first wave that takes this player off, if any. */
export function ringColor(board: Board, playerId: string): string | null {
  for (const s of subsFor(board, playerId)) {
    const w = waveOf(board, s);
    if (w) return w.color;
  }
  return null;
}

export function wavesByMinute(board: Board): SubWave[] {
  return [...board.waves].sort((a, b) => a.minute - b.minute);
}

/** Drops subs whose player has gone, and wave links to deleted waves. */
export function tidySubs(board: Board): void {
  const players = new Set(board.players.map((p) => p.id));
  const waves = new Set(board.waves.map((w) => w.id));
  board.subs = board.subs.filter((s) => players.has(s.replaces));
  for (const s of board.subs) if (s.waveId && !waves.has(s.waveId)) s.waveId = null;
}

/**
 * Puts a sub on the field during the match. The spot keeps its place, role
 * and id (so plays, saved positions and other subs for it still work), and
 * takes the sub's number and name. The player coming off goes to the bench
 * for the same spot with no time, so a rolling sub can be swapped back.
 * Returns false when the sub or its player is not there.
 */
export function swapIn(board: Board, subId: string): boolean {
  const sub = board.subs.find((s) => s.id === subId);
  const player = sub && playerOf(board, sub);
  if (!sub || !player) return false;
  const off = { number: player.number, name: player.name, memberId: player.memberId };
  player.number = sub.number;
  player.name = sub.name;
  setMember(player, sub.memberId);
  sub.number = off.number;
  sub.name = off.name;
  setMember(sub, off.memberId);
  sub.waveId = null;
  return true;
}
