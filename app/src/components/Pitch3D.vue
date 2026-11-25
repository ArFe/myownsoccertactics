<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Board, NumberSpot } from '@/model/types';
import { useSaveStore } from '@/stores/save';
import { SceneSync } from '@/three/sync';
import { EYE_HEIGHT, FIGURE_SCALE } from '@/three/builders';
import { EYE_FOV, lookAt, lookTarget, orbitStart, turn, zoomFov, type Look } from '@/three/cameras';
import { sizeScale } from '@/model/balls';

const props = defineProps<{
  board: Board;
  fade: Record<string, number>;
  width: number;
  maxHeight: number;
}>();

const store = useSaveStore();
const NUMBER_SPOTS: { id: NumberSpot; label: string }[] = [
  { id: 'top', label: 'Numbers above head' },
  { id: 'shirt', label: 'Numbers on shirt' },
  { id: 'off', label: 'No numbers' },
];

const host = ref<HTMLDivElement | null>(null);
const failed = ref(false);
const mode = ref<'orbit' | 'eye'>('orbit');
const eyePlayerId = ref('');

const height = computed(() => Math.round(Math.min(props.maxHeight, props.width * 0.62)));

const playerChoices = computed(() =>
  props.board.players
    .filter((p) => props.board.teams[p.team].visible)
    .map((p) => ({
      id: p.id,
      label: `${props.board.teams[p.team].name} ${p.number}${p.name ? ` · ${p.name}` : ''}`,
    })),
);

let renderer: THREE.WebGLRenderer | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
const sync = new SceneSync();
let look: Look = { yaw: 0, pitch: 0 };
let frameRequest = 0;

/** Draws once on the next frame; many changes in one frame draw once. */
function requestRender(): void {
  if (frameRequest || !renderer || !camera) return;
  frameRequest = requestAnimationFrame(() => {
    frameRequest = 0;
    if (mode.value === 'eye') placeEye();
    renderer!.render(sync.scene, camera!);
  });
}

function eyePosition(): THREE.Vector3 | null {
  const at = sync.playerPosition(eyePlayerId.value);
  if (!at) return null;
  // The eye rises with a jump.
  return at.setY(at.y + EYE_HEIGHT * FIGURE_SCALE * sizeScale(props.board.playerSize));
}

function placeEye(): void {
  const eye = eyePosition();
  if (!eye || !camera) return;
  camera.position.copy(eye);
  const t = lookTarget(eye, look);
  camera.lookAt(t.x, t.y, t.z);
}

function resetOrbit(): void {
  if (!camera || !controls) return;
  const start = orbitStart(props.board.field);
  camera.position.set(start.x, start.y, start.z);
  controls.target.set(0, 0, 0);
  controls.maxDistance = Math.max(props.board.field.length, props.board.field.width) * 2.2;
  controls.update();
}

function setMode(next: 'orbit' | 'eye'): void {
  mode.value = next;
  if (!camera || !controls) return;
  if (next === 'eye') {
    if (!playerChoices.value.some((c) => c.id === eyePlayerId.value)) eyePlayerId.value = playerChoices.value[0]?.id ?? '';
    controls.enabled = false;
    camera.fov = EYE_FOV.start;
    eyeFov.value = EYE_FOV.start;
    faceBall();
  } else {
    controls.enabled = true;
    camera.fov = 45;
    resetOrbit();
  }
  camera.updateProjectionMatrix();
  sync.hidePlayer(next === 'eye' ? eyePlayerId.value : null);
  requestRender();
}

/** The eye starts facing the ball (or the other goal); after that, only a drag turns it. */
function faceBall(): void {
  const eye = eyePosition();
  if (!eye) return;
  const ball = sync.ballPosition();
  const team = props.board.players.find((p) => p.id === eyePlayerId.value)?.team;
  look = ball ? lookAt(eye, ball) : { yaw: team === 'away' ? Math.PI : 0, pitch: 0 };
}

function pickPlayer(id: string): void {
  eyePlayerId.value = id;
  sync.hidePlayer(id);
  faceBall();
  requestRender();
}

// A click (no drag) picks a player, as in 2D; a click on nothing clears the selection.
const CLICK_SLOP = 5;
let pressAt: { x: number; y: number } | null = null;
function pick(e: PointerEvent): void {
  if (!renderer || !camera) return;
  const r = renderer.domElement.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const x = ((e.clientX - r.left) / r.width) * 2 - 1;
  const y = -((e.clientY - r.top) / r.height) * 2 + 1;
  const id = sync.pickPlayer(x, y, camera);
  store.select(id ? { kind: 'player', id } : null);
}

// Free look: drag to turn the head.
let dragFrom: { x: number; y: number } | null = null;
function onPointerDown(e: PointerEvent): void {
  pressAt = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
  if (mode.value !== 'eye') return;
  dragFrom = { x: e.clientX, y: e.clientY };
  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
}
function onPointerMove(e: PointerEvent): void {
  if (!dragFrom) return;
  look = turn(look, e.clientX - dragFrom.x, e.clientY - dragFrom.y);
  dragFrom = { x: e.clientX, y: e.clientY };
  requestRender();
}
function onPointerUp(e: PointerEvent): void {
  dragFrom = null;
  const from = pressAt;
  pressAt = null;
  if (e.type === 'pointerup' && from && Math.hypot(e.clientX - from.x, e.clientY - from.y) < CLICK_SLOP) pick(e);
}

// Zoom in the eye view: the wheel or the buttons narrow the view.
const eyeFov = ref(EYE_FOV.start);
function zoom(steps: number): void {
  if (mode.value !== 'eye' || !camera) return;
  eyeFov.value = zoomFov(eyeFov.value, steps);
  camera.fov = eyeFov.value;
  camera.updateProjectionMatrix();
  requestRender();
}
function onWheel(e: WheelEvent): void {
  if (mode.value !== 'eye') return; // orbit zooms by itself
  e.preventDefault();
  zoom(-Math.sign(e.deltaY));
}

function resize(): void {
  if (!renderer || !camera) return;
  renderer.setSize(props.width, height.value, false);
  camera.aspect = props.width / height.value;
  camera.updateProjectionMatrix();
  requestRender();
}

onMounted(() => {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    failed.value = true;
    return;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.setAttribute('aria-label', '3D view of the board');
  renderer.domElement.setAttribute('role', 'img');
  host.value!.appendChild(renderer.domElement);
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = Math.PI * 0.48; // never under the grass
  controls.minDistance = 5;
  controls.addEventListener('change', requestRender);
  sync.update(props.board, props.fade);
  resetOrbit();
  resize();
});

watch(
  () => [props.board, props.fade] as const,
  ([board, fade]) => {
    sync.update(board, fade);
    if (mode.value === 'eye' && !sync.playerPosition(eyePlayerId.value)) setMode('orbit');
    requestRender();
  },
  { deep: true },
);
watch(
  () => (store.selection?.kind === 'player' ? store.selection.id : null),
  (id) => {
    sync.selectPlayer(id);
    requestRender();
  },
  { immediate: true },
);
watch(() => [props.width, height.value], resize);
watch(
  () => [props.board.field.length, props.board.field.width, props.board.field.orientation],
  () => mode.value === 'orbit' && resetOrbit(),
);

onBeforeUnmount(() => {
  cancelAnimationFrame(frameRequest);
  controls?.dispose();
  sync.dispose();
  renderer?.dispose();
  renderer?.domElement.remove();
});
</script>

<template>
  <div class="pitch-3d" data-testid="pitch-3d">
    <div class="bar">
      <div class="seg" role="group" aria-label="Camera">
        <button type="button" :aria-pressed="mode === 'orbit'" @click="setMode('orbit')">Orbit</button>
        <button type="button" :aria-pressed="mode === 'eye'" @click="setMode('eye')">Player's eye</button>
      </div>
      <select
        v-if="mode === 'eye'"
        class="select"
        aria-label="Eye of player"
        :value="eyePlayerId"
        @change="pickPlayer(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="c in playerChoices" :key="c.id" :value="c.id">{{ c.label }}</option>
      </select>
      <template v-if="mode === 'eye'">
        <button
          type="button"
          class="btn small icon"
          aria-label="Zoom out"
          :disabled="eyeFov >= EYE_FOV.max"
          @click="zoom(-1)"
        >
          −
        </button>
        <button
          type="button"
          class="btn small icon"
          aria-label="Zoom in"
          :disabled="eyeFov <= EYE_FOV.min"
          @click="zoom(1)"
        >
          +
        </button>
      </template>
      <button v-else type="button" class="btn small" @click="resetOrbit">Reset view</button>
      <select
        class="select"
        aria-label="Numbers in 3D"
        :value="board.numberSpot"
        @change="store.setNumberSpot(($event.target as HTMLSelectElement).value as NumberSpot)"
      >
        <option v-for="n in NUMBER_SPOTS" :key="n.id" :value="n.id">{{ n.label }}</option>
      </select>
      <span class="hint">
        {{
          mode === 'orbit'
            ? 'Click a player to edit · drag to turn · scroll to zoom · right-drag to move'
            : 'Click a player to edit · drag to look around · scroll to zoom'
        }}
      </span>
    </div>
    <p v-if="failed" class="hint failed">The 3D view needs WebGL, which this browser has turned off.</p>
    <div
      v-else
      ref="host"
      class="canvas-host"
      :class="{ eye: mode === 'eye' }"
      :style="{ width: `${width}px`, height: `${height}px` }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
    />
  </div>
</template>

<style scoped>
.pitch-3d {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.bar .seg {
  width: 240px;
}
.bar .select {
  width: auto;
  min-width: 200px;
}
.canvas-host {
  border-radius: 12px;
  overflow: hidden;
  touch-action: none;
  cursor: grab;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.08),
    0 8px 24px rgba(20, 40, 28, 0.12);
}
.btn.small.icon {
  width: 36px;
  font-size: 18px;
}
.canvas-host.eye {
  cursor: move;
}
.canvas-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
.failed {
  padding: 24px;
  border: 1px dashed var(--border-strong);
  border-radius: 12px;
}
</style>
