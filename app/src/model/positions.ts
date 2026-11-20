import { newId, nowIso } from './factory';
import { clampToField, tidy } from './geometry';
import type { Board, Player, SavedPositions, SavedSpot, TeamSide } from './types';

export const SIDES: TeamSide[] = ['home', 'away'];

/** Which saved team goes onto which board team. */
export interface PositionTarget {
  from: TeamSide;
  to: TeamSide;
}

export interface ApplyOptions {
  /** Use the set's names and numbers instead of the board's. */
  withNames: boolean;
  /** Move the ball too, if the set has one. */
  withBall: boolean;
  /** Run-off of the board's sport, in metres, to keep players in bounds. */
  runoff: number;
}

/**
 * Saves where the given teams stand now, as fractions of the field. The ball
 * is saved too when `withBall` is set and the ball is on the board.
 */
export function capturePositions(board: Board, sides: TeamSide[], name: string, withBall = true): SavedPositions {
  const set: SavedPositions = { id: newId('s'), name, sport: board.sport, createdAt: nowIso() };
  if (withBall && board.ball.visible) {
    set.ball = { fx: tidy4(board.ball.x / board.field.length), fy: tidy4(board.ball.y / board.field.width) };
  }
  for (const side of sides) {
    set[side] = board.players
      .filter((p) => p.team === side)
      .map((p) => ({
        fx: tidy4(p.x / board.field.length),
        fy: tidy4(p.y / board.field.width),
        number: p.number,
        name: p.name,
        role: p.role,
      }));
  }
  return set;
}

function tidy4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export function setSides(set: SavedPositions): TeamSide[] {
  return SIDES.filter((s) => set[s] && set[s]!.length > 0);
}

export function setTeamSize(set: SavedPositions): number {
  return Math.max(...setSides(set).map((s) => set[s]!.length));
}

/**
 * The ways a set can be loaded. A two-team set loads both, or one of its
 * teams onto the same team. A one-team set loads onto either team; onto the
 * other team it is turned around, as if that team had made it.
 */
export function targetOptions(set: SavedPositions): { id: string; label: string; targets: PositionTarget[] }[] {
  const sides = setSides(set);
  if (sides.length === 2) {
    return [
      { id: 'both', label: 'Both teams', targets: [{ from: 'home', to: 'home' }, { from: 'away', to: 'away' }] },
      { id: 'home', label: 'Home only', targets: [{ from: 'home', to: 'home' }] },
      { id: 'away', label: 'Away only', targets: [{ from: 'away', to: 'away' }] },
    ];
  }
  const from = sides[0]!;
  return [
    { id: 'home', label: 'Home', targets: [{ from, to: 'home' }] },
    { id: 'away', label: 'Away', targets: [{ from, to: 'away' }] },
  ];
}

/**
 * Puts the board's teams in the saved places. Players are matched by order;
 * if the set has more or fewer players, the team grows or shrinks to match.
 * Names and numbers stay as they are on the board unless `withNames` is set.
 * The ball turns around with the team when a set loads onto the other team.
 */
export function applyPositions(board: Board, set: SavedPositions, targets: PositionTarget[], options: ApplyOptions): void {
  const { withNames, withBall, runoff } = options;
  if (withBall && set.ball && targets.length > 0) {
    const turn = targets.length === 1 && targets[0]!.from !== targets[0]!.to;
    const fx = turn ? 1 - set.ball.fx : set.ball.fx;
    const fy = turn ? 1 - set.ball.fy : set.ball.fy;
    const at = clampToField(board.field, runoff, fx * board.field.length, fy * board.field.width);
    board.ball = { x: tidy(at.x), y: tidy(at.y), visible: true };
  }
  for (const { from, to } of targets) {
    const spots = set[from];
    if (!spots?.length) continue;
    const prev = board.players.filter((p) => p.team === to);
    const turn = from !== to;
    const next: Player[] = spots.map((s: SavedSpot, i) => {
      const old = prev[i];
      const fx = turn ? 1 - s.fx : s.fx;
      const fy = turn ? 1 - s.fy : s.fy;
      const at = clampToField(board.field, runoff, fx * board.field.length, fy * board.field.width);
      return {
        id: old?.id ?? newId('p'),
        team: to,
        number: withNames || !old ? s.number : old.number,
        name: withNames || !old ? s.name : old.name,
        role: s.role,
        x: tidy(at.x),
        y: tidy(at.y),
      };
    });
    board.players = [...board.players.filter((p) => p.team !== to), ...next];
    board.teams[to].formation = set.name;
  }
}
