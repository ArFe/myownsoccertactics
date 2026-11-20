<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useSaveStore } from '@/stores/save';
import PitchStage from './PitchStage.vue';

const store = useSaveStore();
const host = ref<HTMLElement | null>(null);
const stage = ref<InstanceType<typeof PitchStage> | null>(null);
const width = ref(800);
const maxHeight = ref(800);

let observer: ResizeObserver | undefined;
function measure(): void {
  if (!host.value) return;
  width.value = Math.max(280, host.value.clientWidth);
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

const sizeLabel = computed(() => {
  const f = store.board.field;
  const kind = f.preset === 'custom' ? 'Custom' : f.preset;
  return `${kind} · ${f.length} × ${f.width} m`;
});

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
      <button type="button" class="btn" :aria-pressed="namesOn" @click="store.setNamesVisible(!namesOn)">
        Names: {{ namesOn ? 'on' : 'off' }}
      </button>
      <button
        type="button"
        class="btn"
        :aria-pressed="store.board.ball.visible"
        @click="store.setBallVisible(!store.board.ball.visible)"
      >
        Ball: {{ store.board.ball.visible ? 'on' : 'off' }}
      </button>
    </div>
    <div ref="host" class="stage-host">
      <div class="stage-frame" data-testid="pitch">
        <PitchStage ref="stage" :board="store.board" :width="width" :max-height="maxHeight" />
      </div>
    </div>
    <p class="hint tips">Drag to move · double-click a player to rename · Shift while dragging snaps to 1 m · Del removes the selected item</p>
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
  flex: 1 1 260px;
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
.stage-host {
  width: 100%;
  display: flex;
  justify-content: center;
}
.stage-frame {
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.08),
    0 8px 24px rgba(20, 40, 28, 0.12);
}
</style>
