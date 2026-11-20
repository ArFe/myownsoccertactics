<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ZOOM_STEPS, anchoredScroll, useFieldZoom } from '@/composables/zoom';
import { useSaveStore } from '@/stores/save';
import { fieldLabel } from '@/model/field';
import PitchStage from './PitchStage.vue';
import PlayBar from './PlayBar.vue';

// Three.js is big, so the 3D view loads the first time it is opened.
const Pitch3D = defineAsyncComponent(() => import('./Pitch3D.vue'));
const view = ref<'2d' | '3d'>('2d');

const store = useSaveStore();
const host = ref<HTMLElement | null>(null);
const stage = ref<InstanceType<typeof PitchStage> | null>(null);
const width = ref(800);
const maxHeight = ref(800);

let observer: ResizeObserver | undefined;
function measure(): void {
  if (!host.value) return;
  // The outer width, so scroll bars that come with zoom do not change it.
  width.value = Math.max(280, Math.floor(host.value.getBoundingClientRect().width));
  // Leave room for the header and toolbar above the field.
  maxHeight.value = Math.max(320, window.innerHeight - 190);
}
onMounted(() => {
  measure();
  observer = new ResizeObserver(measure);
  if (host.value) observer.observe(host.value);
  window.addEventListener('resize', measure);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  window.removeEventListener('resize', measure);
});

// ----- zoom (2D only) -----
const { zoom, zoomBy, resetZoom, takeAnchor } = useFieldZoom();
const maxZoom = ZOOM_STEPS.at(-1)!;

// Keep the point under the mouse (or the middle) still while zooming.
watch(zoom, async (next, prev) => {
  const el = host.value;
  const at = takeAnchor() ?? (el ? { x: el.clientWidth / 2, y: el.clientHeight / 2 } : null);
  await nextTick();
  if (!el || !at) return;
  el.scrollLeft = anchoredScroll(el.scrollLeft, at.x, next / prev);
  el.scrollTop = anchoredScroll(el.scrollTop, at.y, next / prev);
});

// Ctrl/⌘ + wheel, or a trackpad pinch, zooms; small pinch steps add up.
let wheelSum = 0;
function onWheel(e: WheelEvent): void {
  if (view.value !== '2d' || !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  wheelSum += e.deltaY;
  if (Math.abs(wheelSum) < 40) return;
  const box = host.value!.getBoundingClientRect();
  zoomBy(wheelSum < 0 ? 1 : -1, { x: e.clientX - box.left, y: e.clientY - box.top });
  wheelSum = 0;
}

const sizeLabel = computed(() => fieldLabel(store.sport, store.board.field));

const namesOn = computed(() => store.board.teams.home.showNames || store.board.teams.away.showNames);

defineExpose({
  cancelDraft: () => stage.value?.cancelDraft(),
  finishPolygon: () => stage.value?.finishPolygon(),
});
</script>

<template>
  <main class="board-view">
    <div class="toolbar">
      <label class="title-wrap">
        <span class="field-label">Board</span>
        <input
          class="title"
          :value="store.board.name"
          aria-label="Board name"
          @input="store.renameBoard(($event.target as HTMLInputElement).value)"
        />
      </label>
      <span class="chip">{{ sizeLabel }}</span>
      <div class="seg view-switch" role="group" aria-label="View">
        <button type="button" :aria-pressed="view === '2d'" @click="view = '2d'">2D</button>
        <button type="button" :aria-pressed="view === '3d'" @click="view = '3d'">3D</button>
      </div>
      <div v-if="view === '2d'" class="zoom" role="group" aria-label="Zoom">
        <button type="button" class="btn icon" aria-label="Zoom out" :disabled="zoom <= 1" @click="zoomBy(-1)">−</button>
        <button type="button" class="btn zoom-level" aria-label="Fit the field" title="Fit the field (0)" @click="resetZoom">
          {{ Math.round(zoom * 100) }}%
        </button>
        <button type="button" class="btn icon" aria-label="Zoom in" :disabled="zoom >= maxZoom" @click="zoomBy(1)">+</button>
      </div>
      <button
        type="button"
        class="btn"
        :aria-pressed="store.board.gameDay.on"
        title="Only our team, its subs and when they come on"
        @click="store.setGameDay(!store.board.gameDay.on)"
      >
        Game day: {{ store.board.gameDay.on ? 'on' : 'off' }}
      </button>
      <button type="button" class="btn" :aria-pressed="namesOn" @click="store.setNamesVisible(!namesOn)">
        Names: {{ namesOn ? 'on' : 'off' }}
      </button>
      <button
        type="button"
        class="btn"
        :aria-pressed="store.frame.ball.visible"
        @click="store.setBallVisible(!store.frame.ball.visible)"
      >
        Ball: {{ store.frame.ball.visible ? 'on' : 'off' }}
      </button>
    </div>
    <div
      ref="host"
      class="stage-host"
      :class="{ zoomed: view === '2d' && zoom > 1 }"
      :style="view === '2d' && zoom > 1 ? { maxHeight: `${maxHeight + 24}px` } : undefined"
      data-testid="stage-host"
      @wheel="onWheel"
    >
      <Pitch3D
        v-if="view === '3d'"
        :board="store.frame"
        :fade="store.frameFade"
        :width="width"
        :max-height="maxHeight"
      />
      <div v-else class="stage-frame" data-testid="pitch">
        <PitchStage
          ref="stage"
          :board="store.frame"
          :fade="store.frameFade"
          :interactive="store.playTime === null"
          :width="width * zoom"
          :max-height="maxHeight * zoom"
        />
      </div>
    </div>
    <PlayBar />
    <p v-if="view === '3d'" class="hint tips">The 3D view shows the board and its plays. Switch to 2D to edit.</p>
    <p v-else class="hint tips">Drag to move · double-click a player to rename · Shift while dragging snaps to 1 m · Del removes the selected item</p>
  </main>
</template>

<style scoped>
.board-view {
  flex: 999 1 560px;
  min-width: 0;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 14px;
}
.title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 160px;
  min-width: 0;
}
.title {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 600;
  border: 1px solid transparent;
  background: transparent;
  padding: 2px 4px;
  margin-left: -4px;
  border-radius: 6px;
  width: 100%;
}
.title:hover,
.title:focus {
  border-color: var(--border-strong);
  background: var(--panel);
}
.chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--chip);
  color: var(--accent-dark);
  font-size: 13px;
  font-weight: 600;
}
.view-switch {
  width: 120px;
}
.zoom {
  display: flex;
  gap: 4px;
}
.zoom .btn.icon {
  font-size: 18px;
}
.zoom-level {
  min-width: 64px;
  padding: 0 8px;
  font-variant-numeric: tabular-nums;
}
.stage-host {
  width: 100%;
  display: flex;
}
/* margin: auto centres the field, and still lets it scroll when zoomed in. */
.stage-host > * {
  margin: 0 auto;
}
.stage-host.zoomed {
  overflow: auto;
  border-radius: 12px;
}
.stage-host.zoomed > * {
  margin: auto;
}
.stage-frame {
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.08),
    0 8px 24px rgba(20, 40, 28, 0.12);
}
</style>
