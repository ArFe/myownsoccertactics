import * as THREE from 'three';
import { getSport } from '@/model/sports';
import type { Board } from '@/model/types';
import {
  ballKey,
  buildArea,
  buildArrow,
  buildBall,
  buildCone,
  buildField,
  buildFigure,
  buildText,
  dispose,
  figureKey,
  setFade,
  to3,
} from './builders';

interface Kept {
  obj: THREE.Object3D;
  key: string;
}

/**
 * Keeps a three.js scene in step with a board. Things are built again only
 * when they look different; players and the ball just move, so playback is
 * cheap.
 */
export class SceneSync {
  readonly scene = new THREE.Scene();
  private field: Kept | null = null;
  private drawings = new Map<string, Kept>();
  private players = new Map<string, Kept>();
  private ball: Kept | null = null;
  private hiddenPlayer: string | null = null;

  constructor() {
    this.scene.background = new THREE.Color('#9EC7E8');
    this.scene.add(new THREE.HemisphereLight('#FFFFFF', '#3A5A40', 1.6));
    const sun = new THREE.DirectionalLight('#FFFFFF', 1.8);
    sun.name = 'sun';
    sun.position.set(-30, 60, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    this.scene.add(sun, sun.target);
  }

  /** In the player's-eye view the player's own figure is not drawn. */
  hidePlayer(id: string | null): void {
    this.hiddenPlayer = id;
    for (const [pid, kept] of this.players) kept.obj.visible = pid !== id;
  }

  update(board: Board, fade: Record<string, number> = {}): void {
    const sport = getSport(board.sport);
    const runoff = sport.runoff(board.field);

    // Field: built again when its settings change.
    const fieldKey = JSON.stringify([board.sport, board.field]);
    if (this.field?.key !== fieldKey) {
      this.remove(this.field);
      this.field = { obj: buildField(board, sport.drawField(board.field), runoff), key: fieldKey };
      this.scene.add(this.field.obj);
      this.fitShadow(board, runoff);
      // Drawings sit in field coordinates, so they move with it.
      for (const kept of this.drawings.values()) this.remove(kept);
      this.drawings.clear();
    }

    // Drawings, by id.
    const items: [string, string, () => THREE.Object3D][] = [
      ...board.areas.map((a) => [a.id, JSON.stringify(a), () => buildArea(board, a)] as [string, string, () => THREE.Object3D]),
      ...board.arrows.map((a) => [a.id, JSON.stringify(a), () => buildArrow(board, a)] as [string, string, () => THREE.Object3D]),
      ...board.texts.map((t) => [t.id, JSON.stringify(t), () => buildText(board, t)] as [string, string, () => THREE.Object3D]),
      ...board.cones.map((c) => [c.id, JSON.stringify(c), () => buildCone(board, c)] as [string, string, () => THREE.Object3D]),
    ];
    const seen = new Set<string>();
    items.forEach(([id, key, build], order) => {
      seen.add(id);
      let kept = this.drawings.get(id);
      if (kept?.key !== key) {
        this.remove(kept ?? null);
        kept = { obj: build(), key };
        kept.obj.name = id;
        this.drawings.set(id, kept);
        this.scene.add(kept.obj);
      }
      // Later areas draw over earlier ones, as in 2D.
      kept.obj.renderOrder = order;
      setFade(kept.obj, fade[id] ?? 1);
    });
    for (const [id, kept] of this.drawings) {
      if (!seen.has(id)) {
        this.remove(kept);
        this.drawings.delete(id);
      }
    }

    // Players: built again when they look different, otherwise moved.
    const shown = new Set<string>();
    for (const p of board.players) {
      const team = board.teams[p.team];
      if (!team.visible) continue;
      shown.add(p.id);
      const key = figureKey(p, team, board.playerSize);
      let kept = this.players.get(p.id);
      if (kept?.key !== key) {
        this.remove(kept ?? null);
        kept = { obj: buildFigure(p, team, board.playerSize), key };
        this.players.set(p.id, kept);
        this.scene.add(kept.obj);
      }
      kept.obj.position.copy(to3(board, p.x, p.y));
      kept.obj.visible = p.id !== this.hiddenPlayer;
    }
    for (const [id, kept] of this.players) {
      if (!shown.has(id)) {
        this.remove(kept);
        this.players.delete(id);
      }
    }

    // The ball.
    const bk = ballKey(board.ball);
    if (this.ball?.key !== bk) {
      this.remove(this.ball);
      this.ball = { obj: buildBall(board.ball), key: bk };
      this.scene.add(this.ball.obj);
    }
    this.ball.obj.visible = board.ball.visible;
    this.ball.obj.position.copy(to3(board, board.ball.x, board.ball.y));
    setFade(this.ball.obj, fade.ball ?? 1);
  }

  /** Where a player stands in the scene, or null. */
  playerPosition(id: string): THREE.Vector3 | null {
    return this.players.get(id)?.obj.position.clone() ?? null;
  }

  ballPosition(): THREE.Vector3 | null {
    return this.ball?.obj.visible ? this.ball.obj.position.clone() : null;
  }

  /** Counts, for tests. */
  counts(): { drawings: number; players: number } {
    return { drawings: this.drawings.size, players: this.players.size };
  }

  dispose(): void {
    this.remove(this.field);
    for (const k of [...this.drawings.values(), ...this.players.values()]) this.remove(k);
    this.remove(this.ball);
    this.drawings.clear();
    this.players.clear();
    this.field = null;
    this.ball = null;
  }

  private remove(kept: Kept | null): void {
    if (!kept) return;
    this.scene.remove(kept.obj);
    dispose(kept.obj);
  }

  /** The sun's shadow covers the whole field and its run-off. */
  private fitShadow(board: Board, runoff: number): void {
    const sun = this.scene.getObjectByName('sun') as THREE.DirectionalLight;
    const half = Math.max(board.field.length, board.field.width) / 2 + runoff + 2;
    const cam = sun.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 1;
    cam.far = 200;
    cam.updateProjectionMatrix();
  }
}
