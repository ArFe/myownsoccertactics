import * as THREE from 'three';
import { sizeScale } from '@/model/balls';
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
  liftY,
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
  private selectedPlayer: string | null = null;
  /** A ring on the grass under the selected player; it stays down when they jump. */
  private ring: THREE.Mesh;
  private raycaster = new THREE.Raycaster();

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
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.25, 48),
      new THREE.MeshBasicMaterial({ color: '#FACC15', transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.ring.name = 'selection-ring';
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);
  }

  /** Marks one player as selected (a ring under them), or none. */
  selectPlayer(id: string | null): void {
    this.selectedPlayer = id;
    this.placeRing();
  }

  /**
   * The player under a point of the view, or null. `x` and `y` run from -1
   * to 1 across the view, y up (three.js "normalised device coordinates").
   */
  pickPlayer(x: number, y: number, camera: THREE.Camera): string | null {
    this.scene.updateMatrixWorld();
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const figures = [...this.players.values()].map((k) => k.obj).filter((o) => o.visible);
    for (const hit of this.raycaster.intersectObjects(figures, true)) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o.name !== 'player') o = o.parent;
      if (o?.userData.id) return o.userData.id as string;
    }
    return null;
  }

  private placeRing(): void {
    const kept = this.selectedPlayer ? this.players.get(this.selectedPlayer) : undefined;
    this.ring.visible = !!kept && kept.obj.visible;
    if (kept) {
      this.ring.position.set(kept.obj.position.x, 0.03, kept.obj.position.z);
      this.ring.scale.setScalar(kept.obj.userData.scale ?? 1);
    }
  }

  /** In the player's-eye view the player's own figure is not drawn. */
  hidePlayer(id: string | null): void {
    this.hiddenPlayer = id;
    for (const [pid, kept] of this.players) kept.obj.visible = pid !== id;
    this.placeRing();
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
      const key = figureKey(p, team, board.playerSize, board.numberSpot);
      let kept = this.players.get(p.id);
      if (kept?.key !== key) {
        this.remove(kept ?? null);
        kept = { obj: buildFigure(p, team, board.playerSize, board.numberSpot), key };
        this.players.set(p.id, kept);
        this.scene.add(kept.obj);
      }
      kept.obj.position.copy(to3(board, p.x, p.y)).setY(liftY(p, board.playerSize));
      kept.obj.userData.scale = sizeScale(board.playerSize);
      kept.obj.visible = p.id !== this.hiddenPlayer;
    }
    for (const [id, kept] of this.players) {
      if (!shown.has(id)) {
        this.remove(kept);
        this.players.delete(id);
      }
    }

    this.placeRing();

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

  /** Where a player stands in the scene (y is how high they jump), or null. */
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
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
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
