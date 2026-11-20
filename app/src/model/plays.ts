import { deepCopy, newId } from './factory';
import { tidy } from './geometry';
import type { Board, Play, PlayStep, Spot } from './types';

/** Seconds a new step takes to move into. */
export const STEP_SECONDS = 1.5;
export const MIN_STEP_SECONDS = 0.2;
export const MAX_STEP_SECONDS = 10;
/** Playback pauses this long on every step, so each one can be read. */
export const HOLD_SECONDS = 0.6;
export const MAX_PLAYS = 50;
export const MAX_STEPS = 60;

export function clampSeconds(s: number): number {
  return Math.round(Math.min(MAX_STEP_SECONDS, Math.max(MIN_STEP_SECONDS, s)) * 10) / 10;
}

/** Ids of everything drawn on the board that a step can hide. */
export function drawingIds(board: Board): string[] {
  return [...board.areas, ...board.arrows, ...board.texts, ...board.cones].map((d) => d.id);
}

/** A step holding where everyone on `board` stands now. */
export function captureStep(board: Board, hidden: string[] = [], duration = STEP_SECONDS): PlayStep {
  return {
    id: newId('st'),
    duration,
    players: Object.fromEntries(board.players.map((p) => [p.id, { x: tidy(p.x), y: tidy(p.y) }])),
    ball: { x: tidy(board.ball.x), y: tidy(board.ball.y), visible: board.ball.visible },
    hidden: [...hidden],
  };
}

export function createPlay(board: Board, name: string): Play {
  return { id: newId('pl'), name, steps: [captureStep(board)] };
}

/** A copy of the board as it looks on one step. */
export function boardAtStep(board: Board, step: PlayStep): Board {
  const out = deepCopy(board);
  for (const p of out.players) Object.assign(p, step.players[p.id] ?? {});
  Object.assign(out.ball, step.ball);
  const hidden = new Set(step.hidden);
  out.areas = out.areas.filter((d) => !hidden.has(d.id));
  out.arrows = out.arrows.filter((d) => !hidden.has(d.id));
  out.texts = out.texts.filter((d) => !hidden.has(d.id));
  out.cones = out.cones.filter((d) => !hidden.has(d.id));
  return out;
}

// ---------- the timeline ----------
//
//   hold │ move │ hold │ move │ hold
//  step 1       step 2       step 3

/** Total playback seconds. */
export function playLength(play: Play): number {
  return play.steps.reduce((t, s, i) => t + HOLD_SECONDS + (i > 0 ? s.duration : 0), 0);
}

/** The time playback reaches step `i` (the start of its hold). */
export function stepTime(play: Play, i: number): number {
  let t = 0;
  for (let k = 0; k <= i && k < play.steps.length; k++) {
    if (k > 0) t += play.steps[k]!.duration;
    if (k < i) t += HOLD_SECONDS;
  }
  return t;
}

/** Where time `t` falls: moving from step `from` to `to`, `e` of the way (eased). */
export function locate(play: Play, t: number): { from: number; to: number; e: number } {
  let start = 0;
  for (let i = 0; i < play.steps.length; i++) {
    if (i > 0) {
      const d = play.steps[i]!.duration;
      if (t < start + d) return { from: i - 1, to: i, e: ease((t - start) / d) };
      start += d;
    }
    if (t < start + HOLD_SECONDS) return { from: i, to: i, e: 0 };
    start += HOLD_SECONDS;
  }
  const last = play.steps.length - 1;
  return { from: last, to: last, e: 0 };
}

/** The step showing at time `t`: the last one reached. */
export function stepAt(play: Play, t: number): number {
  const { from, to, e } = locate(play, t);
  return e >= 1 ? to : from;
}

function ease(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
}

const mix = (a: number, b: number, e: number): number => a + (b - a) * e;

export interface Frame {
  board: Board;
  /** Opacity by drawing id (and "ball"), for things fading in or out. 1 if missing. */
  fade: Record<string, number>;
}

/** The board as it looks `t` seconds into the play. */
export function frameAt(board: Board, play: Play, t: number): Frame {
  const { from, to, e } = locate(play, t);
  const a = play.steps[from]!;
  const b = play.steps[to]!;
  if (from === to || e === 0) return { board: boardAtStep(board, a), fade: {} };

  const out = deepCopy(board);
  for (const p of out.players) {
    const pa: Spot = a.players[p.id] ?? p;
    const pb: Spot = b.players[p.id] ?? p;
    p.x = mix(pa.x, pb.x, e);
    p.y = mix(pa.y, pb.y, e);
  }

  const fade: Record<string, number> = {};
  // The ball moves when it is on both steps, and fades when on only one.
  const ballFrom = a.ball.visible ? a.ball : b.ball;
  const ballTo = b.ball.visible ? b.ball : a.ball;
  out.ball.x = mix(ballFrom.x, ballTo.x, e);
  out.ball.y = mix(ballFrom.y, ballTo.y, e);
  out.ball.visible = a.ball.visible || b.ball.visible;
  if (a.ball.visible !== b.ball.visible) fade.ball = a.ball.visible ? 1 - e : e;

  const hiddenA = new Set(a.hidden);
  const hiddenB = new Set(b.hidden);
  const shown = (id: string): boolean => {
    const inA = !hiddenA.has(id);
    const inB = !hiddenB.has(id);
    if (inA !== inB) fade[id] = inA ? 1 - e : e;
    return inA || inB;
  };
  out.areas = out.areas.filter((d) => shown(d.id));
  out.arrows = out.arrows.filter((d) => shown(d.id));
  out.texts = out.texts.filter((d) => shown(d.id));
  out.cones = out.cones.filter((d) => shown(d.id));
  return { board: out, fade };
}
