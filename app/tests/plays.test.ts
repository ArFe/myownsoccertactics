import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { cloneBoardWithNewIds, createBoard, createSave } from '@/model/factory';
import { scaleBoardContents } from '@/model/geometry';
import { parseSave, serializeSave } from '@/model/persistence';
import {
  HOLD_SECONDS,
  boardAtStep,
  captureStep,
  createPlay,
  frameAt,
  locate,
  playLength,
  stepAt,
  stepTime,
} from '@/model/plays';
import type { Board, Play } from '@/model/types';
import { useSaveStore } from '@/stores/save';

/** A board with a cone and a play of three steps; player 0 runs 10 m per step. */
function setup(): { board: Board; play: Play } {
  const board = createBoard('soccer', '11v11', 'Test');
  board.cones.push({ id: 'c1', x: 50, y: 30, color: '#F97316' });
  const play = createPlay(board, 'Overlap');
  const p0 = board.players[0]!;
  for (const [i, d] of [1, 2].entries()) {
    const step = captureStep(boardAtStep(board, play.steps[i]!));
    step.players[p0.id] = { x: p0.x + 10 * d, y: p0.y };
    step.duration = 2;
    play.steps.push(step);
  }
  play.steps[2]!.hidden = ['c1'];
  play.steps[2]!.ball.visible = false;
  board.plays.push(play);
  return { board, play };
}

describe('play timeline', () => {
  it('holds on each step and moves between them', () => {
    const { play } = setup();
    // hold 1 | move 2 s | hold 2 | move 2 s | hold 3
    expect(playLength(play)).toBeCloseTo(3 * HOLD_SECONDS + 4);
    expect(stepTime(play, 0)).toBe(0);
    expect(stepTime(play, 1)).toBeCloseTo(HOLD_SECONDS + 2);
    expect(stepTime(play, 2)).toBeCloseTo(2 * HOLD_SECONDS + 4);
    expect(locate(play, 0.1)).toEqual({ from: 0, to: 0, e: 0 });
    expect(locate(play, HOLD_SECONDS + 1)).toMatchObject({ from: 0, to: 1, e: 0.5 });
    expect(stepAt(play, HOLD_SECONDS + 1)).toBe(0);
    expect(stepAt(play, stepTime(play, 1) + 0.01)).toBe(1);
    expect(stepAt(play, 999)).toBe(2);
  });

  it('moves players smoothly and fades what appears or goes', () => {
    const { board, play } = setup();
    const p0 = board.players[0]!;
    const start = frameAt(board, play, 0).board;
    expect(start.players[0]!.x).toBe(p0.x);

    const half = frameAt(board, play, HOLD_SECONDS + 1).board;
    expect(half.players[0]!.x).toBeCloseTo(p0.x + 5);

    // Halfway to step 3: the cone and the ball are fading out.
    const t = stepTime(play, 1) + HOLD_SECONDS + 1;
    const f = frameAt(board, play, t);
    expect(f.board.players[0]!.x).toBeCloseTo(p0.x + 15);
    expect(f.fade.c1).toBeCloseTo(0.5);
    expect(f.fade.ball).toBeCloseTo(0.5);
    expect(f.board.cones).toHaveLength(1);

    const end = frameAt(board, play, playLength(play));
    expect(end.board.players[0]!.x).toBeCloseTo(p0.x + 20);
    expect(end.board.cones).toHaveLength(0);
    expect(end.board.ball.visible).toBe(false);
    // The board itself is not touched.
    expect(board.players[0]!.x).toBe(p0.x);
  });

  it('keeps a player the step does not know where the board has them', () => {
    const { board, play } = setup();
    delete play.steps[1]!.players[board.players[3]!.id];
    expect(boardAtStep(board, play.steps[1]!).players[3]!.x).toBe(board.players[3]!.x);
  });

  it('stretches step places with the field', () => {
    const { board, play } = setup();
    const id = board.players[0]!.id;
    const x = play.steps[1]!.players[id]!.x;
    scaleBoardContents(board, 0.5, 1);
    expect(play.steps[1]!.players[id]!.x).toBeCloseTo(x / 2);
  });

  it('a copied board keeps its plays, with the new ids', () => {
    const { board } = setup();
    const copy = cloneBoardWithNewIds(board);
    const step = copy.plays[0]!.steps[2]!;
    expect(copy.plays[0]!.id).not.toBe(board.plays[0]!.id);
    expect(Object.keys(step.players).sort()).toEqual(copy.players.map((p) => p.id).sort());
    expect(step.hidden).toEqual([copy.cones[0]!.id]);
  });
});

describe('plays in the save file', () => {
  it('round-trip', () => {
    const save = createSave();
    const { board } = setup();
    save.boards = [board];
    save.activeBoardId = board.id;
    expect(parseSave(serializeSave(save)).boards[0]!.plays).toEqual(board.plays);
  });

  it('a version 4 save upgrades with no plays', () => {
    const v4 = createSave() as unknown as Record<string, any>;
    v4.version = 4;
    delete v4.boards[0].plays;
    expect(parseSave(JSON.stringify(v4)).boards[0]!.plays).toEqual([]);
  });

  it('drops unknown ids, bad numbers and empty plays', () => {
    const save = createSave() as unknown as Record<string, any>;
    const b = save.boards[0];
    const pid = b.players[0].id;
    b.plays = [
      {
        id: 'pl1',
        name: 'Press',
        steps: [
          {
            id: 's1',
            duration: 999,
            players: { [pid]: { x: 5, y: 'no' }, ghost: { x: 1, y: 1 } },
            ball: { x: 3, y: 4, visible: false },
            hidden: ['nothing', 7],
          },
        ],
      },
      { id: 'pl2', name: 'Empty', steps: [] },
      'junk',
    ];
    const plays = parseSave(JSON.stringify(save)).boards[0]!.plays;
    expect(plays).toHaveLength(1);
    const step = plays[0]!.steps[0]!;
    expect(step.duration).toBe(10);
    expect(Object.keys(step.players)).toEqual([pid]);
    expect(step.players[pid]).toEqual({ x: 5, y: 0 });
    expect(step.ball).toEqual({ x: 3, y: 4, visible: false });
    expect(step.hidden).toEqual([]);
  });
});

describe('plays in the store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });
  afterEach(() => localStorage.clear());

  it('a step keeps its own places; the board stays as drawn', () => {
    const s = useSaveStore();
    const p = s.board.players[0]!;
    const x0 = p.x;
    s.createPlay('Build-up');
    expect(s.openPlay?.steps).toHaveLength(1);
    s.addStep();
    expect(s.stepIndex).toBe(1);
    s.movePlayer(p.id, x0 + 8, p.y);
    s.moveBall(60, 20);
    expect(s.board.players[0]!.x).toBe(x0);
    expect(s.frame.players[0]!.x).toBe(x0 + 8);
    expect(s.frame.ball.x).toBe(60);

    s.selectStep(0);
    expect(s.frame.players[0]!.x).toBe(x0);
    s.openPlayById(null);
    expect(s.frame).toBe(s.board);

    // Undo goes back through the step moves, the play stays open if it exists.
    s.openPlayById(s.board.plays[0]!.id);
    s.selectStep(1);
    s.undo();
    expect(s.frame.ball.x).not.toBe(60);
    expect(s.frame.players[0]!.x).toBe(x0 + 8);
  });

  it('a new step copies the open one, and a play keeps one step', () => {
    const s = useSaveStore();
    s.createPlay('Press');
    const p = s.board.players[1]!;
    s.movePlayer(p.id, 40, 10);
    s.addStep();
    expect(s.frame.players[1]!).toMatchObject({ x: 40, y: 10 });
    s.setStepDuration(1, 0.01);
    expect(s.openStep?.duration).toBe(0.2);
    s.deleteStep(1);
    s.deleteStep(0);
    expect(s.openPlay?.steps).toHaveLength(1);
    expect(s.stepIndex).toBe(0);
  });

  it('drawings show on chosen steps, and deleting one cleans the steps', () => {
    const s = useSaveStore();
    const cone = s.addCone(30, 30);
    s.createPlay('Drill');
    s.addStep();
    s.addStep();
    s.setDrawingSteps(cone, 1);
    expect(s.openPlay!.steps.map((st) => st.hidden.includes(cone))).toEqual([true, false, true]);
    s.selectStep(0);
    expect(s.frame.cones).toHaveLength(0);
    s.setDrawingOnStep(cone, 0, true);
    expect(s.frame.cones).toHaveLength(1);
    s.setDrawingSteps(cone, 'all');
    expect(s.openPlay!.steps.every((st) => st.hidden.length === 0)).toBe(true);
    s.setDrawingSteps(cone, 2);
    s.select({ kind: 'cone', id: cone });
    s.deleteSelected();
    expect(s.openPlay!.steps.every((st) => st.hidden.length === 0)).toBe(true);
  });

  it('a formation picked on a step moves that step only', () => {
    const s = useSaveStore();
    const before = s.board.players.filter((p) => p.team === 'home').map((p) => p.x);
    s.createPlay('Shape');
    s.applyFormation('home', '4-4-2');
    expect(s.board.players.filter((p) => p.team === 'home').map((p) => p.x)).toEqual(before);
    expect(s.frame.players.filter((p) => p.team === 'home').map((p) => p.x)).not.toEqual(before);
    expect(s.board.teams.home.formation).toBe('4-4-2');
  });

  it('hiding the ball on a step hides it there only', () => {
    const s = useSaveStore();
    s.createPlay('Throw-in');
    s.setBallVisible(false);
    expect(s.frame.ball.visible).toBe(false);
    expect(s.board.ball.visible).toBe(true);
  });

  it('saved positions take the places shown on the step', () => {
    const s = useSaveStore();
    s.createPlay('Corner');
    const p = s.board.players[0]!;
    s.movePlayer(p.id, 77, 7);
    s.savePositions('From step', ['home']);
    expect(s.save.savedPositions[0]!.home![0]!.fx).toBeCloseTo(77 / s.board.field.length, 3);
  });

  it('another board, deleting the play or undoing its creation closes it', () => {
    const s = useSaveStore();
    const first = s.board.id;
    s.createPlay('A');
    s.addBoard('7v7');
    expect(s.openPlay).toBeNull();
    s.setActiveBoard(first);
    s.openPlayById(s.board.plays[0]!.id);
    s.deletePlay(s.board.plays[0]!.id);
    expect(s.openPlay).toBeNull();
    s.undo();
    s.openPlayById(s.board.plays[0]!.id);
    s.undo(); // the play is gone again
    s.undo(); // and the 7v7 board
    s.undo(); // and the play
    expect(s.board.plays).toHaveLength(0);
    expect(s.openPlayId).toBeNull();
  });

  it('playback time shows a moment of the play, and any edit stops it', () => {
    const s = useSaveStore();
    const p = s.board.players[0]!;
    const x0 = p.x;
    s.createPlay('Run');
    s.addStep();
    s.movePlayer(p.id, x0 + 10, p.y);
    s.setStepDuration(1, 2);
    s.setPlayTime(HOLD_SECONDS + 1);
    expect(s.frame.players[0]!.x).toBeCloseTo(x0 + 5);
    s.renameBoard('Edited');
    expect(s.playTime).toBeNull();
  });
});
