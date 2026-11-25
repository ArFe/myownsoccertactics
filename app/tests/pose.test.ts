import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import * as THREE from 'three';
import { createBoard, createSave } from '@/model/factory';
import { parseSave, serializeSave } from '@/model/persistence';
import { captureStep, frameAt, HOLD_SECONDS } from '@/model/plays';
import { clampLift, MAX_LIFT, poseOf, setPose } from '@/model/pose';
import type { Player } from '@/model/types';
import { buildFigure, figureKey } from '@/three/builders';
import { SceneSync } from '@/three/sync';
import { useSaveStore } from '@/stores/save';
import SelectionPanel from '@/components/panels/SelectionPanel.vue';
import { click, mount, setValue } from './mount';

describe('poses', () => {
  it('leaves the defaults out and keeps height in range', () => {
    const p: { arms?: 'down' | 'up'; lift?: number } = {};
    setPose(p, { arms: 'up', lift: 9 });
    expect(p).toEqual({ arms: 'up', lift: MAX_LIFT });
    setPose(p, { arms: 'down', lift: -1 });
    expect(p).toEqual({});
    expect(poseOf({})).toEqual({ arms: 'down', lift: 0 });
    expect(clampLift(Number.NaN)).toBe(0);
  });
});

describe('poses in the save file', () => {
  it('upgrades a version 8 save: numbers above the head, arms down, on the ground', () => {
    const v8 = JSON.parse(serializeSave(createSave()));
    v8.version = 8;
    delete v8.boards[0].numberSpot;
    const out = parseSave(JSON.stringify(v8)).boards[0]!;
    expect(out.numberSpot).toBe('top');
    expect(out.players.every((p) => p.arms === undefined && p.lift === undefined)).toBe(true);
  });

  it('upgrades a version 8 volleyball: no white, its body takes the old yellow', () => {
    const v8 = JSON.parse(serializeSave(createSave()));
    v8.version = 8;
    v8.boards[0].ball = { ...v8.boards[0].ball, style: 'volleyball', colors: { panel1: '#FFFFFF', panel2: '#1E5AA8', panel3: '#FFD23F' } };
    expect(parseSave(JSON.stringify(v8)).boards[0]!.ball.colors).toEqual({ panel1: '#FFD23F', panel2: '#1E5AA8' });
  });

  it('keeps poses and the number spot, and repairs bad ones', () => {
    const save = createSave();
    const b = save.boards[0]!;
    b.numberSpot = 'shirt';
    setPose(b.players[0]!, { arms: 'up', lift: 0.8 });
    b.plays = [{ id: 'pl', name: 'Jump', steps: [captureStep(b)] }];
    const raw = JSON.parse(serializeSave(save));
    raw.boards[0].players[1].arms = 'sideways';
    raw.boards[0].players[1].lift = 40;
    const out = parseSave(JSON.stringify(raw)).boards[0]!;
    expect(out.numberSpot).toBe('shirt');
    expect(poseOf(out.players[0]!)).toEqual({ arms: 'up', lift: 0.8 });
    expect(out.plays[0]!.steps[0]!.players[out.players[0]!.id]).toMatchObject({ arms: 'up', lift: 0.8 });
    expect(poseOf(out.players[1]!)).toEqual({ arms: 'down', lift: MAX_LIFT });

    raw.boards[0].numberSpot = 'sleeve';
    expect(parseSave(JSON.stringify(raw)).boards[0]!.numberSpot).toBe('top');
  });
});

describe('poses in plays', () => {
  it('a jump rises smoothly, and the arms switch half way', () => {
    const board = createBoard();
    const id = board.players[0]!.id;
    const a = captureStep(board);
    const b = captureStep(board, [], 1);
    b.players[id] = { ...b.players[id]!, arms: 'up', lift: 1 };
    const play = { id: 'pl', name: 'Block', steps: [a, b] };
    const at = (t: number): Player => frameAt(board, play, HOLD_SECONDS + t).board.players[0]!;
    expect(poseOf(at(0.25)).arms).toBe('down');
    expect(at(0.25).lift).toBeGreaterThan(0);
    expect(at(0.25).lift).toBeLessThan(0.5);
    expect(poseOf(at(0.75)).arms).toBe('up');
    expect(poseOf(at(5))).toEqual({ arms: 'up', lift: 1 });
  });
});

describe('poses in the store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });
  afterEach(() => localStorage.clear());

  it('sets arms and height on the board, and undo takes them back', () => {
    const s = useSaveStore();
    const id = s.board.players[0]!.id;
    s.setPlayerPose(id, { arms: 'up' });
    s.setPlayerPose(id, { lift: 0.4 });
    s.setPlayerPose(id, { lift: 0.6 }); // a slider drag is one undo step
    expect(poseOf(s.board.players[0]!)).toEqual({ arms: 'up', lift: 0.6 });
    s.undo();
    expect(poseOf(s.board.players[0]!)).toEqual({ arms: 'up', lift: 0 });
    s.setNumberSpot('off');
    expect(s.board.numberSpot).toBe('off');
  });

  it('with a step open the pose goes into the step, and moving keeps it', () => {
    const s = useSaveStore();
    const p = s.board.players[0]!;
    s.createPlay('Header');
    s.addStep();
    s.setPlayerPose(p.id, { arms: 'up', lift: 1 });
    expect(poseOf(s.frame.players[0]!)).toEqual({ arms: 'up', lift: 1 });
    expect(poseOf(s.board.players[0]!)).toEqual({ arms: 'down', lift: 0 });

    s.movePlayer(p.id, p.x + 5, p.y);
    expect(poseOf(s.frame.players[0]!)).toEqual({ arms: 'up', lift: 1 });

    // A formation change with a step open leaves the board's pose alone.
    s.applyFormation('home', '4-4-2');
    expect(poseOf(s.board.players.find((q) => q.id === p.id)!)).toEqual({ arms: 'down', lift: 0 });

    s.selectStep(0);
    expect(poseOf(s.frame.players[0]!)).toEqual({ arms: 'down', lift: 0 });
  });

  it('a swap keeps the spot pose', () => {
    const s = useSaveStore();
    const p = s.board.players[0]!;
    s.setPlayerPose(p.id, { arms: 'up', lift: 0.5 });
    const sub = s.addSub(p.id)!;
    s.swapSub(sub);
    expect(poseOf(s.board.players[0]!)).toEqual({ arms: 'up', lift: 0.5 });
  });
});

const meshNames = (g: THREE.Object3D): string[] => {
  const names: string[] = [];
  g.traverse((o) => o.name && names.push(o.name));
  return names;
};

describe('poses and numbers in 3D', () => {
  it('shows the number above the head, on the shirt, or not at all', () => {
    const board = createBoard();
    const p = board.players[0]!;
    const team = board.teams.home;
    expect(meshNames(buildFigure(p, team, 'm', 'top'))).toContain('label');
    const shirt = meshNames(buildFigure(p, team, 'm', 'shirt'));
    expect(shirt).toEqual(expect.arrayContaining(['chestNumber', 'backNumber']));
    expect(shirt).not.toContain('label');
    const off = meshNames(buildFigure(p, team, 'm', 'off'));
    expect(off).not.toContain('label');
    expect(off).not.toContain('chestNumber');
    // With names on, the name still shows above the head.
    expect(meshNames(buildFigure({ ...p, name: 'Ana' }, { ...team, showNames: true }, 'm', 'off'))).toContain('label');
  });

  it('raises the arms from the shoulder', () => {
    const board = createBoard();
    const p = board.players[0]!;
    const down = buildFigure(p, board.teams.home, 'm').getObjectByName('armR')!;
    const up = buildFigure({ ...p, arms: 'up' }, board.teams.home, 'm').getObjectByName('armR')!;
    expect(Math.abs(down.rotation.x)).toBeLessThan(0.5);
    expect(Math.abs(up.rotation.x)).toBeGreaterThan(2.5);
  });

  it('a jump moves the figure up; arms and number spot build it again', () => {
    const board = createBoard();
    const p = board.players[0]!;
    const team = board.teams.home;
    const key = figureKey(p, team, 'm', 'top');
    expect(figureKey({ ...p, lift: 1 }, team, 'm', 'top')).toBe(key);
    expect(figureKey({ ...p, arms: 'up' }, team, 'm', 'top')).not.toBe(key);
    expect(figureKey(p, team, 'm', 'shirt')).not.toBe(key);

    const sync = new SceneSync();
    sync.update(board);
    const fig = sync.scene.children.find((o) => o.userData.id === p.id)!;
    expect(fig.position.y).toBe(0);
    p.lift = 1;
    sync.update(board);
    expect(sync.scene.children.find((o) => o.userData.id === p.id)).toBe(fig);
    expect(sync.playerPosition(p.id)!.y).toBeGreaterThan(1);
    sync.dispose();
  });
});

describe('picking a player in 3D', () => {
  it('finds the figure under a point, and rings the selected player on the grass', () => {
    const board = createBoard();
    const p = board.players[0]!;
    p.lift = 1;
    const sync = new SceneSync();
    sync.update(board);
    const at = sync.playerPosition(p.id)!;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(at.x, at.y + 2, at.z + 12);
    camera.lookAt(at.x, at.y + 2, at.z);
    camera.updateMatrixWorld();
    expect(sync.pickPlayer(0, 0, camera)).toBe(p.id);
    expect(sync.pickPlayer(0.95, 0.95, camera)).toBeNull();

    sync.selectPlayer(p.id);
    const ring = sync.scene.getObjectByName('selection-ring')!;
    expect(ring.visible).toBe(true);
    expect(ring.position.x).toBeCloseTo(at.x);
    expect(ring.position.y).toBeLessThan(0.1); // stays down when they jump
    sync.hidePlayer(p.id);
    expect(ring.visible).toBe(false);
    sync.selectPlayer(null);
    expect(ring.visible).toBe(false);
    sync.dispose();
  });
});

describe('pose controls', () => {
  let pinia: Pinia;
  let mounted: ReturnType<typeof mount> | undefined;
  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });
  afterEach(() => mounted?.unmount());

  it('the selected player gets arms and height', async () => {
    const store = useSaveStore();
    const id = store.board.players[0]!.id;
    store.select({ kind: 'player', id });
    mounted = mount(SelectionPanel, pinia);
    const up = mounted.all('[aria-label="Arms"] button').find((b) => b.textContent!.includes('Up'))!;
    await click(up);
    expect(store.board.players[0]!.arms).toBe('up');
    await setValue(mounted.get<HTMLInputElement>('#player-lift'), '0.7');
    expect(store.board.players[0]!.lift).toBe(0.7);
  });

});
