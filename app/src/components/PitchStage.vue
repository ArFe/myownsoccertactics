<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type Konva from 'konva';
import { getSport } from '@/model/sports';
import {
  boundingBox,
  makeView,
  normaliseRect,
  pointsToScreen,
  pointsToWorld,
  rectToScreen,
  rectToWorld,
  toScreen,
  toWorld,
  type Point,
} from '@/model/view';
import type { Area, Arrow, Board } from '@/model/types';
import { useSaveStore, type SelectionKind } from '@/stores/save';
import { hexToRgba } from '@/utils/color';
import { BALL_STYLES, sizeScale } from '@/model/balls';
import { watermark as watermarkLayout } from '@/export/watermark';
import { ringColor, subsFor, teamSubs, waveOf, wavesByMinute } from '@/model/gameDay';

const props = withDefaults(
  defineProps<{
    board: Board;
    width: number;
    maxHeight?: number;
    /** False for image export and playback: no selection, no editing. */
    interactive?: boolean;
    /** Opacity by drawing id (and "ball") while a play fades things in or out. */
    fade?: Record<string, number>;
    /** Downloads name the site, faintly, in a corner of the field. */
    watermark?: boolean;
  }>(),
  { maxHeight: Infinity, interactive: true, fade: () => ({}), watermark: false },
);
const opacityOf = (id: string): number => props.fade[id] ?? 1;

const store = useSaveStore();
const FONT = 'Inter, system-ui, sans-serif';

type KonvaEvent = Konva.KonvaEventObject<MouseEvent | TouchEvent>;
interface NodeRef {
  getNode(): Konva.Node;
}

const stageRef = ref<NodeRef | null>(null);
const trRef = ref<NodeRef | null>(null);

// The board prop may not be the open board (image export), so use its own sport.
const sport = computed(() => getSport(props.board.sport));
// Game day can show a bench under the field; the field gets the rest of the space.
const gameDay = computed(() => props.board.gameDay);
const benchShown = computed(() => gameDay.value.on && gameDay.value.subsShown !== 'beside');
const besideShown = computed(() => gameDay.value.on && gameDay.value.subsShown !== 'bench');
const benchHeight = computed(() => (benchShown.value ? Math.round(Math.min(130, Math.max(64, props.width * 0.085))) : 0));
const view = computed(() =>
  makeView(props.board.field, sport.value.runoff(props.board.field), props.width, props.maxHeight - benchHeight.value),
);
const u = computed(() => view.value.unit);
/** Pixel size that scales with the stage but never gets too small to read. */
const px = (n: number): number => Math.max(n * 0.65, n * u.value);

const siteMark = computed(() =>
  props.watermark ? { ...watermarkLayout(view.value.stageWidth, view.value.stageHeight), fontFamily: FONT } : null,
);

const canEdit = computed(() => props.interactive && store.tool === 'select');
const isSelected = (kind: SelectionKind, id: string): boolean =>
  props.interactive && store.selection?.kind === kind && store.selection.id === id;

function getStage(): Konva.Stage | null {
  return (stageRef.value?.getNode() as Konva.Stage | undefined) ?? null;
}

// ---------- field ----------
const field = computed(() => {
  const v = view.value;
  const f = props.board.field;
  const drawing = sport.value.drawField(f);
  const lineWidth = Math.max(1, 1.8 * u.value);
  return {
    background: { x: 0, y: 0, width: v.stageWidth, height: v.stageHeight, fill: f.surfaceColor },
    stripes: drawing.stripes.map((r) => {
      const s = rectToScreen(v, r);
      return { x: s.x, y: s.y, width: s.w, height: s.h, fill: '#FFFFFF', opacity: 0.06 };
    }),
    lines: drawing.lines.map((l) => ({
      points: pointsToScreen(v, l.points),
      closed: !!l.closed,
      stroke: f.lineColor,
      strokeWidth: lineWidth,
      opacity: 0.92,
      dash: l.dashed ? [6 * u.value, 5 * u.value] : undefined,
      lineCap: 'round',
      lineJoin: 'round',
    })),
    goals: drawing.goals.map((g) => ({
      points: pointsToScreen(v, g.points),
      closed: true,
      stroke: f.lineColor,
      strokeWidth: lineWidth,
      fill: hexToRgba(f.lineColor, 0.18),
    })),
    spots: drawing.spots.map((s) => {
      const p = toScreen(v, s.x, s.y);
      return { x: p.x, y: p.y, radius: Math.max(1.5, s.r * v.scale), fill: f.lineColor };
    }),
  };
});

// ---------- areas ----------
function areaScreenBox(a: Area) {
  return a.shape === 'polygon' ? boundingBox(pointsToScreen(view.value, a.points)) : rectToScreen(view.value, a);
}

const areas = computed(() =>
  props.board.areas.map((a) => {
    const v = view.value;
    const style = {
      id: a.id,
      fill: hexToRgba(a.color, a.opacity),
      stroke: hexToRgba(a.color, Math.min(1, a.opacity + 0.55)),
      strokeWidth: 1.6 * u.value,
      strokeEnabled: a.border !== 'none',
      dash: a.border === 'dashed' ? [7 * u.value, 5 * u.value] : undefined,
      draggable: canEdit.value,
      strokeScaleEnabled: false,
      opacity: opacityOf(a.id),
    };
    let shape: Record<string, unknown>;
    if (a.shape === 'rect') {
      const s = rectToScreen(v, a);
      shape = { ...style, x: s.x, y: s.y, width: s.w, height: s.h };
    } else if (a.shape === 'ellipse') {
      const s = rectToScreen(v, a);
      shape = { ...style, x: s.x + s.w / 2, y: s.y + s.h / 2, radiusX: s.w / 2, radiusY: s.h / 2 };
    } else {
      shape = { ...style, points: pointsToScreen(v, a.points), closed: true, lineJoin: 'round' };
    }
    const box = areaScreenBox(a);
    const fontSize = px(13);
    const label =
      a.label === 'hidden' || !a.name
        ? null
        : a.label === 'centre'
          ? { x: box.x, y: box.y + box.h / 2 - fontSize / 2, width: box.w, align: 'center', text: a.name }
          : { x: box.x + 5 * u.value, y: box.y + 5 * u.value, text: a.name };
    return {
      area: a,
      shape,
      label: label && {
        ...label,
        fontSize,
        fontStyle: 'bold',
        fontFamily: FONT,
        fill: '#FFFFFF',
        shadowColor: '#000000',
        shadowBlur: 3,
        shadowOpacity: 0.6,
        listening: false,
        opacity: opacityOf(a.id),
      },
      handles:
        a.shape === 'polygon' && isSelected('area', a.id) && canEdit.value
          ? pointsToScreen(v, a.points).reduce<Point[]>((acc, val, i, arr) => {
              if (i % 2 === 0) acc.push({ x: val, y: arr[i + 1]! });
              return acc;
            }, [])
          : [],
    };
  }),
);

function onAreaDragEnd(a: Area, e: KonvaEvent): void {
  const node = e.target;
  const v = view.value;
  if (a.shape === 'polygon') {
    const dx = node.x();
    const dy = node.y();
    node.position({ x: 0, y: 0 });
    const moved = pointsToScreen(v, a.points).map((val, i) => val + (i % 2 === 0 ? dx : dy));
    store.updateArea(a.id, { points: pointsToWorld(v, moved) });
    return;
  }
  const s = rectToScreen(v, a);
  const topLeft = a.shape === 'rect' ? { x: node.x(), y: node.y() } : { x: node.x() - s.w / 2, y: node.y() - s.h / 2 };
  const w = rectToWorld(v, { ...topLeft, w: s.w, h: s.h });
  store.updateArea(a.id, { x: w.x, y: w.y });
}

function onAreaTransformEnd(a: Area, e: KonvaEvent): void {
  const node = e.target as Konva.Shape;
  const sx = node.scaleX();
  const sy = node.scaleY();
  node.scale({ x: 1, y: 1 });
  let rect;
  if (a.shape === 'ellipse') {
    const el = node as Konva.Ellipse;
    const rx = el.radiusX() * sx;
    const ry = el.radiusY() * sy;
    rect = { x: el.x() - rx, y: el.y() - ry, w: rx * 2, h: ry * 2 };
  } else {
    rect = { x: node.x(), y: node.y(), w: node.width() * sx, h: node.height() * sy };
  }
  store.updateArea(a.id, rectToWorld(view.value, rect));
}

function onVertexDragEnd(a: Area, index: number, e: KonvaEvent): void {
  const w = toWorld(view.value, e.target.x(), e.target.y());
  const pts = [...a.points];
  pts[index * 2] = w.x;
  pts[index * 2 + 1] = w.y;
  store.updateArea(a.id, { points: pts });
}

// ---------- arrows ----------
const arrows = computed(() =>
  props.board.arrows.map((r) => {
    const v = view.value;
    const a = toScreen(v, r.x1, r.y1);
    const b = toScreen(v, r.x2, r.y2);
    const sel = isSelected('arrow', r.id);
    return {
      arrow: r,
      config: {
        id: r.id,
        points: [a.x, a.y, b.x, b.y],
        stroke: r.color,
        fill: r.color,
        strokeWidth: px(r.kind === 'pass' ? 3 : 3.5),
        pointerLength: px(12),
        pointerWidth: px(11),
        dash: r.kind === 'pass' ? [px(10), px(7)] : undefined,
        lineCap: 'round',
        hitStrokeWidth: px(18),
        draggable: canEdit.value,
        shadowColor: '#000000',
        shadowBlur: sel ? 8 : 2,
        shadowOpacity: sel ? 0.9 : 0.35,
        opacity: opacityOf(r.id),
      },
      handles: sel && canEdit.value ? [a, b] : [],
    };
  }),
);

function onArrowDragEnd(r: Arrow, e: KonvaEvent): void {
  const v = view.value;
  const dx = e.target.x();
  const dy = e.target.y();
  e.target.position({ x: 0, y: 0 });
  const a = toScreen(v, r.x1, r.y1);
  const b = toScreen(v, r.x2, r.y2);
  const p1 = toWorld(v, a.x + dx, a.y + dy);
  const p2 = toWorld(v, b.x + dx, b.y + dy);
  store.updateArrow(r.id, { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
}

function onArrowHandleDragEnd(r: Arrow, end: 0 | 1, e: KonvaEvent): void {
  const w = toWorld(view.value, e.target.x(), e.target.y());
  store.updateArrow(r.id, end === 0 ? { x1: w.x, y1: w.y } : { x2: w.x, y2: w.y });
}

// ---------- texts, cones, ball, players ----------
let measureCtx: CanvasRenderingContext2D | null | undefined;
/** Width of the widest line of `text` in pixels, or null where it cannot be measured. */
function textWidth(text: string, font: string): number | null {
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return null;
  measureCtx.font = font;
  return Math.max(...text.split('\n').map((line) => measureCtx!.measureText(line).width));
}

const texts = computed(() =>
  props.board.texts.map((t) => {
    const p = toScreen(view.value, t.x, t.y);
    const fontSize = Math.max(8, t.size * view.value.scale);
    // A note that would run past the right edge wraps there instead.
    const room = Math.max(fontSize * 4, view.value.stageWidth - p.x - 6 * u.value);
    const natural = textWidth(t.text, `bold ${fontSize}px ${FONT}`);
    const wrap = natural !== null && natural > room ? { width: room, wrap: 'word' } : {};
    return {
      note: t,
      config: {
        id: t.id,
        x: p.x,
        y: p.y,
        text: t.text,
        ...wrap,
        fontSize,
        fontStyle: 'bold',
        fontFamily: FONT,
        fill: t.color,
        shadowColor: '#000000',
        shadowBlur: 4,
        shadowOpacity: 0.6,
        draggable: canEdit.value,
        opacity: opacityOf(t.id),
      },
    };
  }),
);

const cones = computed(() =>
  props.board.cones.map((c) => {
    const p = toScreen(view.value, c.x, c.y);
    const sel = isSelected('cone', c.id);
    return {
      cone: c,
      config: {
        id: c.id,
        x: p.x,
        y: p.y,
        sides: 3,
        radius: px(9),
        fill: c.color,
        stroke: sel ? '#FDE047' : '#FFFFFF',
        strokeWidth: sel ? px(2.5) : px(1.5),
        draggable: canEdit.value,
        opacity: opacityOf(c.id),
      },
    };
  }),
);

// The ball is drawn in units of its radius inside a group scaled to that radius.
const ball = computed(() => {
  const b = props.board.ball;
  if (!b.visible) return null;
  const p = toScreen(view.value, b.x, b.y);
  const style = BALL_STYLES[b.style] ?? BALL_STYLES.soccer;
  const r = px(8) * sizeScale(b.size);
  const oval = style.shape === 'oval';
  const ry = oval ? (style.ovalHeight ?? 0.6) : 1;
  const colorOf = (key: string): string =>
    b.colors[key] ?? style.colors.find((c) => c.key === key)?.default ?? '#FFFFFF';
  const shape = { radiusX: 1, radiusY: ry };
  return {
    oval,
    group: {
      id: 'ball',
      name: 'ball',
      x: p.x,
      y: p.y,
      scaleX: r,
      scaleY: r,
      draggable: canEdit.value,
      opacity: opacityOf('ball'),
    },
    ring: isSelected('ball', 'ball')
      ? { ...shape, radiusX: 1.35, radiusY: ry + 0.35, stroke: '#FDE047', strokeWidth: 0.2, listening: false }
      : null,
    body: { ...shape, fill: colorOf(style.body), shadowColor: '#000000', shadowBlur: 4, shadowOpacity: 0.4 },
    clip: {
      listening: false,
      clipFunc: (ctx: CanvasRenderingContext2D) => ctx.ellipse(0, 0, 1, ry, 0, 0, Math.PI * 2),
    },
    parts: style.parts.map((part) =>
      part.line
        ? { data: part.path, stroke: colorOf(part.color), strokeWidth: part.line, lineCap: 'round', listening: false }
        : { data: part.path, fill: colorOf(part.color), listening: false },
    ),
    outline: { ...shape, stroke: '#111827', strokeWidth: 0.1, listening: false },
  };
});

// ---------- game day bench ----------
const bench = computed(() => {
  if (!benchShown.value) return null;
  const b = props.board;
  const team = b.teams[gameDay.value.team];
  const W = view.value.stageWidth;
  const H = benchHeight.value;
  const top = view.value.stageHeight;
  const pad = H * 0.16;
  const font = (n: number) => Math.max(9, H * n);
  const text = (t: string, x: number, y: number, size: number, fill: string, extra: Record<string, unknown> = {}) => ({
    text: t, x, y, fontSize: font(size), fontFamily: FONT, fontStyle: 'bold', fill, listening: false, ...extra,
  });

  const waves = wavesByMinute(b);
  const legendItem = H * 0.95;
  const legendW = waves.length * legendItem;
  const labelW = H * 1.0;
  const subs = teamSubs(b, gameDay.value.team);
  const room = W - labelW - legendW - pad * 3;
  const chipW = subs.length ? Math.min(H * 2.1, room / subs.length) : 0;
  const r = H * 0.2;

  return {
    background: { x: 0, y: top, width: W, height: H, fill: '#14301F', listening: false },
    label: text('BENCH', pad, top + H / 2 - font(0.13) / 2, 0.13, '#A7C4B2', { letterSpacing: 1 }),
    empty: subs.length ? null : text('No subs yet: add them in Game day', labelW + pad, top + H / 2 - font(0.15) / 2, 0.15, '#A7C4B2', { fontStyle: 'normal' }),
    chips: subs.map((sub, i) => {
      const x = labelW + pad + i * chipW;
      const cy = top + H / 2;
      const wave = waveOf(b, sub);
      const off = b.players.find((p) => p.id === sub.replaces);
      return {
        id: sub.id,
        disc: { x: x + r, y: cy, radius: r, fill: team.shirtColor, stroke: wave?.color ?? '#FFFFFF', strokeWidth: Math.max(2, H * 0.045), listening: false },
        number: text(String(sub.number), x, cy - r, 0.17, team.numberColor, { width: r * 2, height: r * 2, align: 'center', verticalAlign: 'middle' }),
        name: text(sub.name || `#${sub.number}`, x + r * 2 + pad * 0.5, cy - font(0.15) * 1.1, 0.15, '#FFFFFF', {
          width: chipW - r * 2 - pad, wrap: 'none', ellipsis: true,
        }),
        detail: text(`for ${off?.number ?? '?'}${wave ? ` · ${wave.minute}'` : ''}`, x + r * 2 + pad * 0.5, cy + font(0.13) * 0.15, 0.13, wave?.color ?? '#A7C4B2', {
          width: chipW - r * 2 - pad, wrap: 'none', ellipsis: true,
        }),
      };
    }),
    legend: waves.map((w, i) => {
      const x = W - legendW - pad + i * legendItem;
      const cy = top + H / 2;
      return {
        id: w.id,
        dot: { x: x + H * 0.12, y: cy, radius: H * 0.11, fill: w.color, listening: false },
        text: text(`${w.minute}'`, x + H * 0.28, cy - font(0.16) / 2, 0.16, '#FFFFFF'),
      };
    }),
  };
});

const players = computed(() => {
  const scale = sizeScale(props.board.playerSize);
  const r = px(17) * scale;
  // Labels grow more slowly than the discs, so they stay readable but tidy.
  const labelScale = 0.5 + 0.5 * scale;
  return props.board.players
    .filter((p) => props.board.teams[p.team].visible)
    .map((p) => {
      const team = props.board.teams[p.team];
      const s = toScreen(view.value, p.x, p.y);
      const sel = isSelected('player', p.id);
      const onGameDay = gameDay.value.on && p.team === gameDay.value.team;
      const ring = onGameDay ? ringColor(props.board, p.id) : null;
      const beside = onGameDay && besideShown.value ? subsFor(props.board, p.id) : [];
      const small = r * 0.62;
      return {
        player: p,
        // A white edge under the ring keeps a blue ring visible on a blue shirt.
        ring: ring
          ? {
              edge: { radius: r + px(5), stroke: '#FFFFFF', strokeWidth: px(8), listening: false },
              color: { radius: r + px(5), stroke: ring, strokeWidth: px(4.5), listening: false },
            }
          : null,
        beside: beside.map((sub, i) => {
          const x = r + small * 0.6 + i * small * 2.1;
          const y = -r * 0.75;
          return {
            id: sub.id,
            circle: {
              x,
              y,
              radius: small,
              fill: team.shirtColor,
              stroke: waveOf(props.board, sub)?.color ?? '#FFFFFF',
              strokeWidth: px(3),
              opacity: 0.92,
              listening: false,
            },
            text: {
              x: x - small,
              y: y - small,
              width: small * 2,
              height: small * 2,
              align: 'center',
              verticalAlign: 'middle',
              text: String(sub.number),
              fontSize: px(10) * scale,
              fontStyle: 'bold',
              fontFamily: FONT,
              fill: team.numberColor,
              listening: false,
            },
          };
        }),
        group: { id: p.id, name: 'player', x: s.x, y: s.y, draggable: canEdit.value },
        circle: {
          radius: r,
          fill: team.shirtColor,
          stroke: sel ? '#FDE047' : '#FFFFFF',
          strokeWidth: sel ? px(3.5) : px(2),
          shadowColor: '#000000',
          shadowBlur: 6,
          shadowOpacity: 0.35,
          shadowOffsetY: 2,
        },
        number: {
          text: String(p.number),
          width: r * 2,
          height: r * 2,
          offsetX: r,
          offsetY: r,
          align: 'center',
          verticalAlign: 'middle',
          fontSize: px(14) * scale,
          fontStyle: 'bold',
          fontFamily: FONT,
          fill: team.numberColor,
          listening: false,
        },
        label:
          team.showNames && p.name
            ? {
                group: { y: r + px(3), listening: false },
                tag: {
                  fill: 'rgba(15, 23, 18, 0.75)',
                  cornerRadius: px(4),
                  pointerDirection: 'up',
                  pointerWidth: 0,
                  pointerHeight: 0,
                },
                text: { text: p.name, fontSize: px(11) * labelScale, fontStyle: 'bold', fontFamily: FONT, fill: '#FFFFFF', padding: px(3) },
              }
            : null,
      };
    });
});

function selectItem(kind: SelectionKind, id: string): void {
  if (canEdit.value) store.select({ kind, id });
}

function shift(e: KonvaEvent): boolean {
  return 'shiftKey' in e.evt && e.evt.shiftKey;
}

function onPointDragEnd(kind: 'player' | 'ball' | 'text' | 'cone', id: string, e: KonvaEvent): void {
  const w = toWorld(view.value, e.target.x(), e.target.y());
  if (kind === 'player') store.movePlayer(id, w.x, w.y, shift(e));
  else if (kind === 'ball') store.moveBall(w.x, w.y, shift(e));
  else store.moveItem(kind, id, w.x, w.y, shift(e));
}

function onLayerDragStart(e: KonvaEvent): void {
  if (e.target.name() === 'player') selectItem('player', e.target.id());
  if (e.target.name() === 'ball') selectItem('ball', 'ball');
}

function onLayerDragEnd(e: KonvaEvent): void {
  if (e.target.name() === 'player') onPointDragEnd('player', e.target.id(), e);
  if (e.target.name() === 'ball') onPointDragEnd('ball', 'ball', e);
}

function onPlayerDblClick(id: string): void {
  if (!props.interactive) return;
  store.select({ kind: 'player', id });
  // Wait for the Selection panel to mount before asking it to focus.
  setTimeout(() => window.dispatchEvent(new CustomEvent('tactics:edit-player')), 0);
}

// ---------- transformer ----------
const transformerConfig = computed(() => {
  const sel = store.selection;
  const textOnly = sel?.kind === 'text';
  return {
    rotateEnabled: false,
    keepRatio: false,
    ignoreStroke: true,
    enabledAnchors: textOnly ? [] : undefined,
    borderStroke: '#FFFFFF',
    anchorStroke: '#1F2937',
    anchorFill: '#FFFFFF',
    anchorSize: 10,
    boundBoxFunc: (oldBox: { width: number; height: number }, newBox: { width: number; height: number }) =>
      newBox.width < 8 || newBox.height < 8 ? oldBox : newBox,
  };
});

async function syncTransformer(): Promise<void> {
  await nextTick();
  const tr = trRef.value?.getNode() as Konva.Transformer | undefined;
  const stage = getStage();
  if (!tr || !stage) return;
  const sel = store.selection;
  let nodes: Konva.Node[] = [];
  if (sel && canEdit.value) {
    const area = sel.kind === 'area' ? props.board.areas.find((a) => a.id === sel.id) : undefined;
    const wanted = (area && area.shape !== 'polygon') || sel.kind === 'text';
    const node = wanted ? stage.findOne(`#${sel.id}`) : undefined;
    if (node) nodes = [node];
  }
  tr.nodes(nodes);
  tr.getLayer()?.batchDraw();
}

if (props.interactive) {
  watch(() => [store.selection, store.tool, props.board, view.value], syncTransformer, { deep: true });
}

// ---------- drawing tools ----------
interface Draft {
  tool: 'rect' | 'ellipse' | 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
const draft = ref<Draft | null>(null);
const polygon = ref<number[]>([]);
const hover = ref<Point | null>(null);

function pointer(): Point | null {
  return getStage()?.getPointerPosition() ?? null;
}

function onStageDown(e: KonvaEvent): void {
  if (!props.interactive) return;
  const pos = pointer();
  if (!pos) return;
  const tool = store.tool;
  if (tool === 'select') {
    if (e.target === e.target.getStage()) store.select(null);
    return;
  }
  const w = toWorld(view.value, pos.x, pos.y);
  switch (tool) {
    case 'rect':
    case 'ellipse':
    case 'arrow':
      draft.value = { tool, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
      break;
    case 'polygon': {
      const pts = polygon.value;
      const near = pts.length >= 6 && Math.hypot(pos.x - pts[0]!, pos.y - pts[1]!) < Math.max(10, 12 * u.value);
      if (near) finishPolygon();
      else polygon.value = [...pts, pos.x, pos.y];
      break;
    }
    case 'text':
      store.addText(w.x, w.y);
      store.tool = 'select';
      break;
    case 'cone':
      store.addCone(w.x, w.y);
      break;
    case 'ball':
      store.moveBall(w.x, w.y);
      store.select({ kind: 'ball', id: 'ball' });
      store.tool = 'select';
      break;
  }
}

function onStageMove(): void {
  const pos = pointer();
  if (!pos) return;
  if (draft.value) {
    draft.value.x2 = pos.x;
    draft.value.y2 = pos.y;
  }
  hover.value = store.tool === 'polygon' && polygon.value.length > 0 ? pos : null;
}

function onStageUp(): void {
  const d = draft.value;
  if (!d) return;
  draft.value = null;
  const v = view.value;
  if (d.tool === 'arrow') {
    if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 8) return;
    const a = toWorld(v, d.x1, d.y1);
    const b = toWorld(v, d.x2, d.y2);
    store.addArrow(a.x, a.y, b.x, b.y);
    return;
  }
  const r = normaliseRect(d.x1, d.y1, d.x2, d.y2);
  if (r.w < 6 || r.h < 6) return;
  store.addArea({ shape: d.tool, ...rectToWorld(v, r) });
  store.tool = 'select';
}

/**
 * Finishes the polygon if it has 3 or more corners. Otherwise drawing goes
 * on: Konva reports any two quick clicks as a double-click, even when they
 * are far apart, so a double-click alone must not end a short polygon.
 */
function finishPolygon(): void {
  const pts: number[] = [];
  const raw = polygon.value;
  for (let i = 0; i < raw.length; i += 2) {
    const x = raw[i]!;
    const y = raw[i + 1]!;
    const n = pts.length;
    if (n >= 2 && Math.hypot(x - pts[n - 2]!, y - pts[n - 1]!) < 3) continue;
    pts.push(x, y);
  }
  if (pts.length < 6) {
    polygon.value = pts;
    return;
  }
  polygon.value = [];
  hover.value = null;
  store.addArea({ shape: 'polygon', points: pointsToWorld(view.value, pts) });
  store.tool = 'select';
}

function onStageDblClick(): void {
  if (props.interactive && store.tool === 'polygon') finishPolygon();
}

function cancelDraft(): void {
  draft.value = null;
  polygon.value = [];
  hover.value = null;
}

if (props.interactive) {
  watch(
    () => store.tool,
    (t) => {
      if (t !== 'polygon') cancelDraft();
    },
  );
}

const draftShape = computed(() => {
  const d = draft.value;
  const common = { stroke: '#FFFFFF', strokeWidth: 2, dash: [6, 4], listening: false };
  if (!d) return null;
  if (d.tool === 'arrow') {
    return {
      kind: 'arrow',
      config: { ...common, points: [d.x1, d.y1, d.x2, d.y2], fill: '#FFFFFF', pointerLength: px(12), pointerWidth: px(11) },
    };
  }
  const r = normaliseRect(d.x1, d.y1, d.x2, d.y2);
  const fill = 'rgba(255, 255, 255, 0.18)';
  return d.tool === 'rect'
    ? { kind: 'rect', config: { ...common, fill, x: r.x, y: r.y, width: r.w, height: r.h } }
    : { kind: 'ellipse', config: { ...common, fill, x: r.x + r.w / 2, y: r.y + r.h / 2, radiusX: r.w / 2, radiusY: r.h / 2 } };
});

const polygonDraft = computed(() => {
  if (polygon.value.length === 0) return null;
  const pts = hover.value ? [...polygon.value, hover.value.x, hover.value.y] : polygon.value;
  return {
    line: { points: pts, stroke: '#FFFFFF', strokeWidth: 2, dash: [6, 4], fill: 'rgba(255, 255, 255, 0.15)', closed: pts.length >= 6, listening: false },
    first: { x: polygon.value[0], y: polygon.value[1], radius: 6, fill: '#FFFFFF', stroke: '#111827', strokeWidth: 1, listening: false },
  };
});

const handleConfig = (p: Point) => ({
  x: p.x,
  y: p.y,
  radius: px(7),
  fill: '#FFFFFF',
  stroke: '#111827',
  strokeWidth: 1.5,
  draggable: true,
});

defineExpose({ getStage, cancelDraft, finishPolygon, view });
</script>

<template>
  <div class="pitch-stage" :class="{ drawing: interactive && store.tool !== 'select' }">
    <v-stage
      ref="stageRef"
      :config="{ width: view.stageWidth, height: view.stageHeight + benchHeight }"
      @mousedown="onStageDown"
      @touchstart="onStageDown"
      @mousemove="onStageMove"
      @touchmove="onStageMove"
      @mouseup="onStageUp"
      @touchend="onStageUp"
      @dblclick="onStageDblClick"
      @dbltap="onStageDblClick"
      @dragstart="onLayerDragStart"
      @dragend="onLayerDragEnd"
    >
      <v-layer :config="{ listening: false }">
        <v-rect :config="field.background" />
        <v-rect v-for="(s, i) in field.stripes" :key="'s' + i" :config="s" />
        <v-line v-for="(g, i) in field.goals" :key="'g' + i" :config="g" />
        <v-line v-for="(l, i) in field.lines" :key="'l' + i" :config="l" />
        <v-circle v-for="(s, i) in field.spots" :key="'p' + i" :config="s" />
        <template v-if="bench">
          <v-rect :config="bench.background" />
          <v-text :config="bench.label" />
          <v-text v-if="bench.empty" :config="bench.empty" />
          <template v-for="c in bench.chips" :key="c.id">
            <v-circle :config="c.disc" />
            <v-text :config="c.number" />
            <v-text :config="c.name" />
            <v-text :config="c.detail" />
          </template>
          <template v-for="l in bench.legend" :key="l.id">
            <v-circle :config="l.dot" />
            <v-text :config="l.text" />
          </template>
        </template>
      </v-layer>

      <v-layer>
        <template v-for="a in areas" :key="a.area.id">
          <v-rect
            v-if="a.area.shape === 'rect'"
            :config="a.shape"
            @mousedown="selectItem('area', a.area.id)"
            @touchstart="selectItem('area', a.area.id)"
            @dragend="onAreaDragEnd(a.area, $event)"
            @transformend="onAreaTransformEnd(a.area, $event)"
          />
          <v-ellipse
            v-else-if="a.area.shape === 'ellipse'"
            :config="a.shape"
            @mousedown="selectItem('area', a.area.id)"
            @touchstart="selectItem('area', a.area.id)"
            @dragend="onAreaDragEnd(a.area, $event)"
            @transformend="onAreaTransformEnd(a.area, $event)"
          />
          <v-line
            v-else
            :config="a.shape"
            @mousedown="selectItem('area', a.area.id)"
            @touchstart="selectItem('area', a.area.id)"
            @dragend="onAreaDragEnd(a.area, $event)"
          />
          <v-text v-if="a.label" :config="a.label" />
        </template>

        <v-arrow
          v-for="r in arrows"
          :key="r.arrow.id"
          :config="r.config"
          @mousedown="selectItem('arrow', r.arrow.id)"
          @touchstart="selectItem('arrow', r.arrow.id)"
          @dragend="onArrowDragEnd(r.arrow, $event)"
        />

        <v-regular-polygon
          v-for="c in cones"
          :key="c.cone.id"
          :config="c.config"
          @mousedown="selectItem('cone', c.cone.id)"
          @touchstart="selectItem('cone', c.cone.id)"
          @dragend="onPointDragEnd('cone', c.cone.id, $event)"
        />

        <!-- Groups cannot take listeners, so the circle takes clicks and the stage takes drags. -->
        <v-group v-for="p in players" :key="p.player.id" :config="p.group">
          <template v-if="p.ring">
            <v-circle :config="p.ring.edge" />
            <v-circle :config="p.ring.color" />
          </template>
          <template v-for="b in p.beside" :key="b.id">
            <v-circle :config="b.circle" />
            <v-text :config="b.text" />
          </template>
          <v-circle
            :config="p.circle"
            @mousedown="selectItem('player', p.player.id)"
            @touchstart="selectItem('player', p.player.id)"
            @dblclick="onPlayerDblClick(p.player.id)"
            @dbltap="onPlayerDblClick(p.player.id)"
          />
          <v-text :config="p.number" />
          <v-label v-if="p.label" :config="p.label.group">
            <v-tag :config="p.label.tag" />
            <v-text :config="p.label.text" />
          </v-label>
        </v-group>

        <!-- Like players, the ball group's drags are handled by the stage. -->
        <v-group v-if="ball" :config="ball.group">
          <v-ellipse v-if="ball.ring" :config="ball.ring" />
          <v-ellipse
            :config="ball.body"
            @mousedown="selectItem('ball', 'ball')"
            @touchstart="selectItem('ball', 'ball')"
          />
          <v-group :config="ball.clip">
            <v-path v-for="(part, i) in ball.parts" :key="i" :config="part" />
          </v-group>
          <v-ellipse :config="ball.outline" />
        </v-group>

        <v-text
          v-for="t in texts"
          :key="t.note.id"
          :config="t.config"
          @mousedown="selectItem('text', t.note.id)"
          @touchstart="selectItem('text', t.note.id)"
          @dragend="onPointDragEnd('text', t.note.id, $event)"
        />

        <template v-if="interactive">
          <template v-for="a in areas" :key="'h' + a.area.id">
            <v-circle
              v-for="(h, i) in a.handles"
              :key="i"
              :config="handleConfig(h)"
              @dragend="onVertexDragEnd(a.area, i, $event)"
            />
          </template>
          <template v-for="r in arrows" :key="'ah' + r.arrow.id">
            <v-circle
              v-for="(h, i) in r.handles"
              :key="i"
              :config="handleConfig(h)"
              @dragend="onArrowHandleDragEnd(r.arrow, i === 0 ? 0 : 1, $event)"
            />
          </template>
          <v-transformer ref="trRef" :config="transformerConfig" />
          <template v-if="draftShape">
            <v-rect v-if="draftShape.kind === 'rect'" :config="draftShape.config" />
            <v-ellipse v-else-if="draftShape.kind === 'ellipse'" :config="draftShape.config" />
            <v-arrow v-else :config="draftShape.config" />
          </template>
          <template v-if="polygonDraft">
            <v-line :config="polygonDraft.line" />
            <v-circle :config="polygonDraft.first" />
          </template>
        </template>
      </v-layer>

      <v-layer v-if="siteMark" :config="{ listening: false }">
        <v-text :config="siteMark" />
      </v-layer>
    </v-stage>
  </div>
</template>

<style scoped>
.pitch-stage {
  line-height: 0;
  touch-action: none;
  user-select: none;
}
.pitch-stage.drawing {
  cursor: crosshair;
}
</style>
