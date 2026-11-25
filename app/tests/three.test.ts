import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createBoard } from '@/model/factory';
import { getSport } from '@/model/sports';
import { buildGoal, buildNet, figureKey, ribbon, to3, wrapWords } from '@/three/builders';
import { EYE_FOV, lookAt, lookTarget, orbitStart, turn, zoomFov, MAX_PITCH } from '@/three/cameras';
import { SceneSync } from '@/three/sync';

// jsdom has no 2D canvas; labels and the ball texture are left out.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => vi.restoreAllMocks());

describe('3D shapes', () => {
  it('puts the centre of the field at the origin', () => {
    const board = createBoard();
    expect(to3(board, 52.5, 34).toArray()).toEqual([0, 0, 0]);
    expect(to3(board, 0, 0).toArray()).toEqual([-52.5, 0, -34]);
  });

  it('makes a flat line two triangles per piece, and cuts dashed lines', () => {
    expect(ribbon([0, 0, 10, 0], 0.2)).toHaveLength(12);
    const quad = ribbon([0, 0, 10, 0], 0.2);
    const zs = quad.filter((_, i) => i % 2 === 1);
    expect(Math.max(...zs)).toBeCloseTo(0.1);
    expect(Math.min(...zs)).toBeCloseTo(-0.1);
    // A closed square has four sides.
    expect(ribbon([0, 0, 1, 0, 1, 1, 0, 1], 0.1, { closed: true })).toHaveLength(48);
    // 10 m in 1 m dashes with 1 m gaps: five dashes.
    expect(ribbon([0, 0, 10, 0], 0.2, { dash: [1, 1] })).toHaveLength(60);
  });

  it('stands goal posts on the line, as tall as the sport says', () => {
    const board = createBoard();
    const drawing = getSport('soccer').drawField(board.field);
    expect(drawing.goalHeight).toBe(2.44);
    const goal = buildGoal(board, drawing.goals[0]!.points, drawing.goalHeight, '#FFFFFF');
    goal.updateMatrixWorld();
    const top = new THREE.Box3().setFromObject(goal);
    expect(top.max.y).toBeGreaterThan(2.4);
    expect(top.max.y).toBeLessThan(2.6);
    // The mouth is on the goal line, at x = 0 (-52.5 in the scene).
    expect(top.max.x).toBeCloseTo(-52.5, 0);
    expect(getSport('soccer').drawField(createBoard('soccer', '7v7').field).goalHeight).toBe(1.83);
  });

  it('stands the volleyball net across the middle, posts outside the court', () => {
    const board = createBoard('volleyball');
    const drawing = getSport('volleyball').drawField(board.field);
    expect(drawing.goals).toHaveLength(0);
    const net = buildNet(board, drawing.nets[0]!, '#FFFFFF');
    net.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(net);
    expect(box.max.y).toBeGreaterThan(2.4);
    expect(box.max.y).toBeLessThan(2.5);
    // On the centre line (x = 0), wider than the 9 m court.
    expect(box.min.x).toBeCloseTo(0, 0);
    expect(box.max.x).toBeCloseTo(0, 0);
    expect(box.max.z - box.min.z).toBeGreaterThan(10.9);
  });
});

describe('note wrapping in 3D', () => {
  it('breaks at spaces, keeps typed line breaks, and cuts a word too long for a line', () => {
    expect(wrapWords('Press high when their keeper has the ball', 20)).toEqual(['Press high when', 'their keeper has the', 'ball']);
    expect(wrapWords('One\nTwo', 20)).toEqual(['One', 'Two']);
    expect(wrapWords('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    expect(wrapWords('Short')).toEqual(['Short']);
  });
});

describe('cameras', () => {
  it('starts the orbit camera high on the side, or behind the home goal when vertical', () => {
    const board = createBoard();
    const side = orbitStart(board.field);
    expect(side.z).toBeGreaterThan(board.field.width / 2);
    expect(side.y).toBeGreaterThan(20);
    const end = orbitStart({ ...board.field, orientation: 'vertical' });
    expect(end.x).toBeLessThan(-board.field.length / 2);
  });

  it('keeps the orbit camera back on a small court, where figures are big', () => {
    const court = createBoard('volleyball').field;
    expect(orbitStart(court)).toEqual(orbitStart({ ...court, length: 32 }));
    const big = createBoard().field;
    expect(orbitStart(big).y).toBeCloseTo(big.length * 0.38);
  });

  it('faces a target, and a drag turns the head but never past straight up or down', () => {
    const look = lookAt({ x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: 10 });
    expect(look.yaw).toBeCloseTo(Math.PI / 2);
    const t = lookTarget({ x: 0, y: 2, z: 0 }, look);
    expect(t.z).toBeCloseTo(1);
    expect(turn(look, 0, -100000).pitch).toBe(MAX_PITCH);
    expect(turn(look, 100, 0).yaw).toBeGreaterThan(look.yaw);
  });
});

describe('eye zoom', () => {
  it('narrows the view to zoom in, within limits', () => {
    expect(zoomFov(EYE_FOV.start, 1)).toBeLessThan(EYE_FOV.start);
    expect(zoomFov(EYE_FOV.start, -1)).toBeGreaterThan(EYE_FOV.start);
    expect(zoomFov(EYE_FOV.start, 100)).toBe(EYE_FOV.min);
    expect(zoomFov(EYE_FOV.start, -100)).toBe(EYE_FOV.max);
  });
});

describe('scene sync', () => {
  it('builds the board and keeps objects that did not change', () => {
    const board = createBoard();
    board.cones.push({ id: 'c1', x: 10, y: 10, color: '#F97316' });
    const sync = new SceneSync();
    sync.update(board);
    expect(sync.counts()).toEqual({ drawings: 1, players: 22 });
    const cone = sync.scene.getObjectByName('c1')!;
    const pos = sync.playerPosition(board.players[0]!.id)!;

    // Moving a player moves its figure; the cone object is kept.
    board.players[0]!.x += 5;
    sync.update(board);
    expect(sync.playerPosition(board.players[0]!.id)!.x).toBeCloseTo(pos.x + 5);
    expect(sync.scene.getObjectByName('c1')).toBe(cone);

    // A changed cone is built again; a deleted one goes.
    board.cones[0]!.color = '#000000';
    sync.update(board);
    expect(sync.scene.getObjectByName('c1')).not.toBe(cone);
    board.cones = [];
    sync.update(board);
    expect(sync.counts().drawings).toBe(0);
    sync.dispose();
  });

  it('hides a hidden team, the eye player and a hidden ball, and fades drawings', () => {
    const board = createBoard();
    board.arrows.push({ id: 'r1', kind: 'pass', x1: 0, y1: 0, x2: 10, y2: 10, color: '#FFFFFF' });
    board.teams.away.visible = false;
    board.ball.visible = false;
    const sync = new SceneSync();
    sync.update(board, { r1: 0.25 });
    expect(sync.counts().players).toBe(11);
    expect(sync.ballPosition()).toBeNull();
    const arrow = sync.scene.getObjectByName('r1')!;
    const mats: THREE.Material[] = [];
    arrow.traverse((o) => (o as THREE.Mesh).material && mats.push((o as THREE.Mesh).material as THREE.Material));
    expect(mats.every((m) => m.opacity === 0.25)).toBe(true);

    const id = board.players[0]!.id;
    sync.hidePlayer(id);
    const figures = sync.scene.children.filter((o) => o.name === 'player');
    expect(figures.find((f) => f.userData.id === id)!.visible).toBe(false);
    expect(figures.filter((f) => f.visible)).toHaveLength(10);
    sync.dispose();
  });

  it('builds a figure again only when it looks different', () => {
    const board = createBoard();
    const p = board.players[0]!;
    const before = figureKey(p, board.teams.home, 'm');
    expect(figureKey({ ...p, x: p.x + 9 }, board.teams.home, 'm')).toBe(before);
    expect(figureKey({ ...p, name: 'Ana' }, board.teams.home, 'm')).not.toBe(before);
    expect(figureKey(p, board.teams.home, 'xl')).not.toBe(before);
  });
});
