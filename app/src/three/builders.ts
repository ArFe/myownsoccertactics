import * as THREE from 'three';
import { BALL_STYLES, sizeScale } from '@/model/balls';
import type { FieldDrawing } from '@/model/sports/types';
import type { Area, Arrow, Ball, Board, Cone, Player, Team, TextNote } from '@/model/types';

// World: x along the length, z across the width, y up, centre of the field
// at the origin. 1 unit = 1 metre. Home attacks towards +x.

export function to3(board: Pick<Board, 'field'>, x: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(x - board.field.length / 2, 0, y - board.field.width / 2);
}

/** Players and the ball are drawn bigger than life, or they vanish on a full field. */
export const FIGURE_SCALE = 1.5;
export const BALL_RADIUS = 0.28;
export const EYE_HEIGHT = 1.62;

/** Height of the line markings, cones and drawings above the grass, to avoid flicker. */
const LIFT = { stripe: 0.004, area: 0.012, line: 0.02, arrow: 0.03 };

// ---------- flat ribbons (lines and arrows) ----------

/**
 * Triangles for a flat line of `width` along a 2D polyline, as [x, z] pairs
 * per vertex. Dashed lines are cut into `dash` long pieces with `gap` between.
 */
export function ribbon(points: number[], width: number, opts: { closed?: boolean; dash?: [number, number] } = {}): number[] {
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < points.length; i += 2) pts.push([points[i]!, points[i + 1]!]);
  if (opts.closed && pts.length > 2) pts.push(pts[0]!);
  const out: number[] = [];
  const half = width / 2;
  const quad = (a: [number, number], b: [number, number]): void => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    // Stretch each piece a little past its ends, so corners close.
    const ex = (dx / len) * half;
    const ey = (dy / len) * half;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    const a0: [number, number] = [a[0] - ex, a[1] - ey];
    const b0: [number, number] = [b[0] + ex, b[1] + ey];
    out.push(a0[0] + nx, a0[1] + ny, a0[0] - nx, a0[1] - ny, b0[0] + nx, b0[1] + ny);
    out.push(b0[0] + nx, b0[1] + ny, a0[0] - nx, a0[1] - ny, b0[0] - nx, b0[1] - ny);
  };
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (!opts.dash) {
      quad(a, b);
      continue;
    }
    const [on, off] = opts.dash;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t < len; t += on + off) {
      const t2 = Math.min(len, t + on);
      const at = (s: number): [number, number] => [a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len];
      quad(at(t), at(t2));
    }
  }
  return out;
}

/** A flat mesh from [x, z] triangle vertices in field metres. */
function flatMesh(board: Board, xz: number[], y: number, material: THREE.Material): THREE.Mesh {
  const L = board.field.length / 2;
  const W = board.field.width / 2;
  const pos = new Float32Array((xz.length / 2) * 3);
  for (let i = 0, j = 0; i < xz.length; i += 2, j += 3) {
    pos[j] = xz[i]! - L;
    pos[j + 1] = y;
    pos[j + 2] = xz[i + 1]! - W;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function basic(color: string, opacity = 1): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: opacity >= 1,
  });
  m.userData.baseOpacity = opacity;
  return m;
}

function standard(color: string): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  m.userData.baseOpacity = 1;
  return m;
}

// ---------- the field ----------

export function buildField(board: Board, drawing: FieldDrawing, runoff: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'field';
  const { length: L, width: W, surfaceColor, lineColor } = board.field;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(L + runoff * 2, W + runoff * 2),
    new THREE.MeshStandardMaterial({ color: surfaceColor, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  g.add(ground);

  // A wide, darker surround, so the horizon is not the edge of the world.
  const surround = new THREE.Mesh(
    new THREE.CircleGeometry(600, 48),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(surfaceColor).multiplyScalar(0.7), roughness: 1 }),
  );
  surround.rotation.x = -Math.PI / 2;
  surround.position.y = -0.02;
  surround.receiveShadow = true;
  g.add(surround);

  for (const s of drawing.stripes) {
    const pts = [s.x, s.y, s.x + s.w, s.y, s.x + s.w, s.y + s.h, s.x, s.y, s.x + s.w, s.y + s.h, s.x, s.y + s.h];
    g.add(flatMesh(board, pts, LIFT.stripe, basic('#FFFFFF', 0.06)));
  }

  const lineMat = basic(lineColor, 0.95);
  const xz: number[] = [];
  for (const l of drawing.lines) xz.push(...ribbon(l.points, 0.12, { closed: l.closed, dash: l.dashed ? [1, 0.8] : undefined }));
  const lines = flatMesh(board, xz, LIFT.line, lineMat);
  lines.name = 'lines';
  g.add(lines);

  for (const s of drawing.spots) {
    const spot = new THREE.Mesh(new THREE.CircleGeometry(s.r, 20), basic(lineColor));
    spot.rotation.x = -Math.PI / 2;
    spot.position.copy(to3(board, s.x, s.y)).setY(LIFT.line);
    g.add(spot);
  }

  for (const goal of drawing.goals) g.add(buildGoal(board, goal.points, drawing.goalHeight, lineColor));
  return g;
}

/** A bar (cylinder) between two points. */
function bar(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 10), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = true;
  return m;
}

/** A net panel through four corners, as a grid of thin lines. */
function net(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): THREE.LineSegments {
  const n = 10;
  const pts: number[] = [];
  const lerp = (p: THREE.Vector3, q: THREE.Vector3, t: number) => p.clone().lerp(q, t);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p1 = lerp(a, b, t);
    const p2 = lerp(d, c, t);
    const q1 = lerp(a, d, t);
    const q2 = lerp(b, c, t);
    pts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, q1.x, q1.y, q1.z, q2.x, q2.y, q2.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = new THREE.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.45 });
  mat.userData.baseOpacity = 0.45;
  return new THREE.LineSegments(geo, mat);
}

/**
 * A goal from its outline: the two corners on the edge of the field are the
 * posts, the other two are the back of the net, lower down.
 */
export function buildGoal(board: Board, points: number[], height: number, color: string): THREE.Group {
  const g = new THREE.Group();
  g.name = 'goal';
  const { length: L, width: W } = board.field;
  const corners: { p: THREE.Vector3; edge: boolean }[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const x = points[i]!;
    const y = points[i + 1]!;
    const edge = Math.abs(x) < 0.01 || Math.abs(x - L) < 0.01 || Math.abs(y) < 0.01 || Math.abs(y - W) < 0.01;
    corners.push({ p: to3(board, x, y), edge });
  }
  const front = corners.filter((c) => c.edge).map((c) => c.p);
  const back = corners.filter((c) => !c.edge).map((c) => c.p);
  if (front.length !== 2 || back.length !== 2) return g;
  // Pair each back corner with the nearer post.
  if (back[0]!.distanceTo(front[0]!) > back[1]!.distanceTo(front[0]!)) back.reverse();

  const mat = standard(color);
  const up = (p: THREE.Vector3, h: number) => p.clone().setY(h);
  const r = 0.06;
  const backH = height * 0.6;
  g.add(bar(front[0]!, up(front[0]!, height), r, mat));
  g.add(bar(front[1]!, up(front[1]!, height), r, mat));
  g.add(bar(up(front[0]!, height), up(front[1]!, height), r, mat));
  g.add(bar(back[0]!, back[1]!, r * 0.6, mat));
  g.add(bar(back[0]!, up(back[0]!, backH), r * 0.6, mat));
  g.add(bar(back[1]!, up(back[1]!, backH), r * 0.6, mat));
  g.add(bar(up(back[0]!, backH), up(back[1]!, backH), r * 0.6, mat));
  // Back, top and sides of the net.
  g.add(net(back[0]!, back[1]!, up(back[1]!, backH), up(back[0]!, backH)));
  g.add(net(up(front[0]!, height), up(front[1]!, height), up(back[1]!, backH), up(back[0]!, backH)));
  for (const i of [0, 1]) g.add(net(front[i]!, back[i]!, up(back[i]!, backH), up(front[i]!, height)));
  return g;
}

// ---------- labels ----------

/** A 2D canvas, or null where there is none (tests). */
function canvas2d(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

const FONT = 'Inter, system-ui, sans-serif';

/**
 * A label that always faces the camera. `height` is in metres; the width
 * follows the text.
 */
export function textSprite(
  lines: { text: string; size: number; bold?: boolean }[],
  color: string,
  height: number,
  options: { badge?: { fill: string }; oneColor?: boolean } = {},
): THREE.Sprite {
  const scale = 4; // canvas pixels per label pixel, for sharp text
  const pad = 6;
  const sized = lines.filter((l) => l.text);
  const measure = canvas2d(1, 1);
  const widthOf = (l: { text: string; size: number; bold?: boolean }): number => {
    if (!measure) return l.text.length * l.size * 0.6;
    measure.ctx.font = `${l.bold ? 700 : 600} ${l.size * scale}px ${FONT}`;
    return measure.ctx.measureText(l.text).width / scale;
  };
  const w = Math.max(...sized.map(widthOf), sized[0]?.size ?? 10) + pad * 2;
  const h = sized.reduce((t, l) => t + l.size * 1.25, 0) + pad;
  const made = canvas2d(Math.ceil(w * scale), Math.ceil(h * scale));
  const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
  material.userData.baseOpacity = 1;
  if (made) {
    const { canvas, ctx } = made;
    ctx.scale(scale, scale);
    let y = pad / 2;
    sized.forEach((l, i) => {
      ctx.font = `${l.bold ? 700 : 600} ${l.size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const lw = widthOf(l) + pad * 2;
      if (i === 0 && options.badge) {
        ctx.fillStyle = options.badge.fill;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect((w - lw) / 2, y - 1, lw, l.size * 1.2 + 2, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
      } else {
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)';
        ctx.strokeText(l.text, w / 2, y + 1);
        ctx.fillStyle = i === 0 || options.oneColor ? color : '#FFFFFF';
      }
      ctx.fillText(l.text, w / 2, y + 1);
      y += l.size * 1.25;
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    material.map = texture;
  }
  const sprite = new THREE.Sprite(material);
  sprite.scale.set((height * w) / h, height, 1);
  sprite.center.set(0.5, 0);
  return sprite;
}

// ---------- players ----------

const SKIN = '#C99A76';

/** A simple figure in the team's colours, its number above the head. */
export function buildFigure(player: Player, team: Team, size: Board['playerSize']): THREE.Group {
  const g = new THREE.Group();
  g.name = 'player';
  g.userData.id = player.id;
  const body = new THREE.Group();
  const shirt = standard(team.shirtColor);
  const shorts = standard(team.numberColor);
  const skin = standard(SKIN);

  const limb = (r1: number, r2: number, h: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 12), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    body.add(m);
    return m;
  };
  limb(0.075, 0.06, 0.5, skin, 0, 0.25, -0.1); // lower legs
  limb(0.075, 0.06, 0.5, skin, 0, 0.25, 0.1);
  limb(0.11, 0.1, 0.32, shorts, 0, 0.66, -0.1); // shorts
  limb(0.11, 0.1, 0.32, shorts, 0, 0.66, 0.1);
  limb(0.24, 0.2, 0.6, shirt, 0, 1.1, 0); // torso
  const armL = limb(0.06, 0.05, 0.6, shirt, 0, 1.12, -0.3);
  const armR = limb(0.06, 0.05, 0.6, shirt, 0, 1.12, 0.3);
  armL.rotation.x = -0.2;
  armR.rotation.x = 0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skin);
  head.position.set(0, 1.55, 0);
  head.castShadow = true;
  body.add(head);
  body.scale.setScalar(FIGURE_SCALE * sizeScale(size));
  // Face the other goal.
  body.rotation.y = player.team === 'home' ? 0 : Math.PI;
  body.name = 'body';
  g.add(body);

  const label = textSprite(
    [
      { text: String(player.number), size: 22, bold: true },
      { text: team.showNames ? player.name : '', size: 14 },
    ],
    team.numberColor,
    (team.showNames && player.name ? 2.6 : 1.6) * sizeScale(size),
    { badge: { fill: team.shirtColor } },
  );
  label.position.y = 1.85 * FIGURE_SCALE * sizeScale(size);
  label.name = 'label';
  g.add(label);
  return g;
}

/** What a figure looks like; a change means it is built again. */
export function figureKey(player: Player, team: Team, size: Board['playerSize']): string {
  return [player.number, player.name, player.team, team.shirtColor, team.numberColor, team.showNames, size].join('|');
}

// ---------- ball ----------

/** The ball's style painted on a sphere: the 2D design on front and back. */
function ballTexture(ball: Ball): THREE.Texture | null {
  const made = canvas2d(512, 256);
  if (!made) return null;
  const { canvas, ctx } = made;
  const style = BALL_STYLES[ball.style] ?? BALL_STYLES.soccer;
  const colorOf = (key: string): string =>
    ball.colors[key] ?? style.colors.find((c) => c.key === key)?.default ?? '#FFFFFF';
  ctx.fillStyle = colorOf(style.body);
  ctx.fillRect(0, 0, 512, 256);
  for (const cx of [128, 384]) {
    ctx.save();
    ctx.translate(cx, 128);
    ctx.scale(120, 120);
    for (const part of style.parts) {
      const path = new Path2D(part.path);
      if (part.line) {
        ctx.strokeStyle = colorOf(part.color);
        ctx.lineWidth = part.line;
        ctx.lineCap = 'round';
        ctx.stroke(path);
      } else {
        ctx.fillStyle = colorOf(part.color);
        ctx.fill(path);
      }
    }
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildBall(ball: Ball): THREE.Group {
  const g = new THREE.Group();
  g.name = 'ball';
  const style = BALL_STYLES[ball.style] ?? BALL_STYLES.soccer;
  const r = BALL_RADIUS * sizeScale(ball.size);
  const map = ballTexture(ball);
  const mat = new THREE.MeshStandardMaterial({ color: map ? '#FFFFFF' : ball.colors[style.body] ?? '#FFFFFF', map, roughness: 0.5 });
  mat.userData.baseOpacity = 1;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), mat);
  if (style.shape === 'oval') mesh.scale.set(1, style.ovalHeight ?? 0.6, style.ovalHeight ?? 0.6);
  mesh.position.y = r * mesh.scale.y;
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}

export function ballKey(ball: Ball): string {
  return JSON.stringify([ball.style, ball.colors, ball.size]);
}

// ---------- drawings ----------

export function buildCone(board: Board, cone: Cone): THREE.Object3D {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 20), standard(cone.color));
  m.position.copy(to3(board, cone.x, cone.y)).setY(0.35);
  m.castShadow = true;
  return m;
}

function areaOutline(a: Area): number[] {
  if (a.shape === 'polygon') return a.points;
  if (a.shape === 'rect') return [a.x, a.y, a.x + a.w, a.y, a.x + a.w, a.y + a.h, a.x, a.y + a.h];
  const pts: number[] = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    pts.push(a.x + a.w / 2 + (Math.cos(t) * a.w) / 2, a.y + a.h / 2 + (Math.sin(t) * a.h) / 2);
  }
  return pts;
}

export function buildArea(board: Board, a: Area): THREE.Object3D {
  const g = new THREE.Group();
  const outline = areaOutline(a);
  const shape = new THREE.Shape();
  for (let i = 0; i + 1 < outline.length; i += 2) {
    const x = outline[i]! - board.field.length / 2;
    const z = outline[i + 1]! - board.field.width / 2;
    // The shape is drawn in x/y and laid flat, so y becomes -z.
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  }
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), basic(a.color, a.opacity));
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = LIFT.area;
  g.add(fill);
  if (a.border !== 'none') {
    const edge = ribbon(outline, 0.18, { closed: true, dash: a.border === 'dashed' ? [1.2, 0.9] : undefined });
    g.add(flatMesh(board, edge, LIFT.area + 0.002, basic(a.color, Math.min(1, a.opacity + 0.55))));
  }
  if (a.label !== 'hidden' && a.name) {
    const xs = outline.filter((_, i) => i % 2 === 0);
    const ys = outline.filter((_, i) => i % 2 === 1);
    const label = textSprite([{ text: a.name, size: 16, bold: true }], '#FFFFFF', 2.2);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    label.position.copy(to3(board, cx, cy)).setY(0.3);
    g.add(label);
  }
  return g;
}

export function buildArrow(board: Board, r: Arrow): THREE.Object3D {
  const g = new THREE.Group();
  const dx = r.x2 - r.x1;
  const dy = r.y2 - r.y1;
  const len = Math.hypot(dx, dy) || 1;
  const head = Math.min(2.2, len * 0.4);
  const ux = dx / len;
  const uy = dy / len;
  const bx = r.x2 - ux * head;
  const by = r.y2 - uy * head;
  const width = r.kind === 'pass' ? 0.3 : 0.4;
  const mat = basic(r.color);
  g.add(flatMesh(board, ribbon([r.x1, r.y1, bx, by], width, { dash: r.kind === 'pass' ? [1.2, 0.9] : undefined }), LIFT.arrow, mat));
  const hw = head * 0.55;
  g.add(flatMesh(board, [r.x2, r.y2, bx - uy * hw, by + ux * hw, bx + uy * hw, by - ux * hw], LIFT.arrow, mat));
  return g;
}

/** Splits text into lines of at most `max` characters, at spaces where it can. */
export function wrapWords(text: string, max = 28): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (line && line.length + 1 + word.length > max) {
        out.push(line);
        line = '';
      }
      line = line ? `${line} ${word}` : word;
      // A single word longer than a line is cut.
      while (line.length > max) {
        out.push(line.slice(0, max));
        line = line.slice(max);
      }
    }
    out.push(line);
  }
  return out;
}

export function buildText(board: Board, t: TextNote): THREE.Object3D {
  const lines = wrapWords(t.text);
  const s = textSprite(
    lines.map((text) => ({ text: text || ' ', size: 18, bold: true })),
    t.color,
    t.size * 1.4 * lines.length,
    { oneColor: true },
  );
  s.position.copy(to3(board, t.x, t.y)).setY(0.2);
  return s;
}

/** Sets the opacity of everything in an object, relative to its own. */
export function setFade(obj: THREE.Object3D, fade: number): void {
  obj.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      const base = (m.userData.baseOpacity as number | undefined) ?? 1;
      m.opacity = base * fade;
      m.transparent = m.opacity < 1 || base < 1 || m instanceof THREE.SpriteMaterial;
    }
  });
}

/** Frees the GPU memory of everything in an object. */
export function dispose(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mats = mesh.material;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      (m as THREE.MeshBasicMaterial).map?.dispose();
      m.dispose();
    }
  });
}
