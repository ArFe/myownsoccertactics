<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useSaveStore } from '@/stores/save';
import { MAX_STEP_SECONDS, MIN_STEP_SECONDS, playLength, stepAt, stepTime } from '@/model/plays';
import { useToasts } from '@/composables/toast';
import { Cancelled, FORMATS, canMake, type AnimationFormat } from '@/export/animation';
import { downloadPlay } from '@/export/renderer';
import Icon from './Icon.vue';

const store = useSaveStore();
const { show } = useToasts();

const SPEEDS = [0.5, 1, 2];
const speed = ref(1);

const plays = computed(() => store.board.plays);
const play = computed(() => store.openPlay);
const steps = computed(() => play.value?.steps ?? []);
const playing = computed(() => store.playTime !== null);
/** The step lit up in the row: the one reached during playback. */
const shownStep = computed(() =>
  play.value && store.playTime !== null ? stepAt(play.value, store.playTime) : store.stepIndex,
);

function onPick(e: Event): void {
  const id = (e.target as HTMLSelectElement).value;
  store.openPlayById(id || null);
}

function newPlay(): void {
  const id = store.createPlay(`Play ${plays.value.length + 1}`);
  if (id) show('New play. Move players and the ball, then add a step.');
}

function rename(): void {
  const p = play.value;
  if (!p) return;
  const name = window.prompt('New name for this play', p.name);
  if (name?.trim()) store.renamePlay(p.id, name);
}

function remove(): void {
  const p = play.value;
  if (!p) return;
  store.deletePlay(p.id);
  show(`Deleted "${p.name}". Undo brings it back.`);
}

// ----- playback -----
let raf = 0;
let last = 0;

function tick(now: number): void {
  const p = play.value;
  // Any edit, undo or board change stops playback by clearing the time.
  if (!p || store.playTime === null) return stopLoop();
  const t = store.playTime + ((now - last) / 1000) * speed.value;
  last = now;
  const end = playLength(p);
  if (t >= end) {
    stopLoop();
    store.selectStep(p.steps.length - 1);
    return;
  }
  store.setPlayTime(t);
  raf = requestAnimationFrame(tick);
}

function stopLoop(): void {
  cancelAnimationFrame(raf);
  raf = 0;
}

function start(): void {
  const p = play.value;
  if (!p || p.steps.length < 2) return;
  // From the open step, or from the top when already at the end.
  const from = store.stepIndex >= p.steps.length - 1 ? 0 : store.stepIndex;
  store.select(null);
  store.setPlayTime(stepTime(p, from));
  last = performance.now();
  stopLoop();
  raf = requestAnimationFrame(tick);
}

function pause(): void {
  const p = play.value;
  if (!p || store.playTime === null) return;
  const at = stepAt(p, store.playTime);
  stopLoop();
  store.selectStep(at);
}

function go(delta: -1 | 1): void {
  stopLoop();
  store.selectStep(Math.min(steps.value.length - 1, Math.max(0, shownStep.value + delta)));
}

function pick(i: number): void {
  stopLoop();
  store.selectStep(i);
}

onBeforeUnmount(() => {
  stopLoop();
  store.setPlayTime(null);
});

// ----- download as GIF or video -----
const supported = reactive<Record<AnimationFormat, boolean>>({ gif: true, webm: false, mp4: false });
// The video check loads the video library, so wait until a play is opened.
let checked = false;
watch(
  play,
  async (p) => {
    if (!p || checked) return;
    checked = true;
    for (const f of FORMATS) supported[f.id] = await canMake(f.id).catch(() => false);
  },
  { immediate: true },
);
const making = ref<AnimationFormat | null>(null);
const progress = ref(0);
let cancelled = false;

async function download(format: AnimationFormat): Promise<void> {
  const p = play.value;
  if (!p || making.value) return;
  pause();
  making.value = format;
  progress.value = 0;
  cancelled = false;
  try {
    await downloadPlay(store.board, p, format, {
      speed: speed.value,
      onProgress: (done) => (progress.value = done),
      isCancelled: () => cancelled,
    });
    show(`Downloaded "${p.name}" as ${format.toUpperCase()}.`);
  } catch (err) {
    if (!(err instanceof Cancelled)) show(`Could not make the ${format.toUpperCase()}: ${(err as Error).message}`);
  } finally {
    making.value = null;
  }
}

function cancel(): void {
  cancelled = true;
}

function formatTitle(id: AnimationFormat): string | undefined {
  if (!supported[id]) return 'This browser cannot make this format';
  if (steps.value.length < 2) return 'Add a second step first';
  return undefined;
}

function onDuration(e: Event): void {
  const n = Number((e.target as HTMLInputElement).value);
  if (Number.isFinite(n) && n > 0) store.setStepDuration(store.stepIndex, n);
}
</script>

<template>
  <section class="playbar" data-testid="plays" aria-label="Plays">
    <div class="row">
      <label class="pick">
        <span class="field-label">Play</span>
        <select class="select" aria-label="Play" :value="store.openPlayId ?? ''" @change="onPick">
          <option value="">No play · the board as drawn</option>
          <option v-for="p in plays" :key="p.id" :value="p.id">{{ p.name }} · {{ p.steps.length }} steps</option>
        </select>
      </label>
      <button type="button" class="btn" @click="newPlay"><Icon name="plus" :size="16" />New play</button>
      <template v-if="play">
        <button type="button" class="btn icon" aria-label="Rename play" title="Rename" @click="rename">
          <Icon name="edit" :size="16" />
        </button>
        <button type="button" class="btn icon danger" aria-label="Delete play" title="Delete play" @click="remove">
          <Icon name="trash" :size="16" />
        </button>
      </template>
    </div>

    <template v-if="play">
      <div class="row">
        <button type="button" class="btn icon" aria-label="Previous step" :disabled="shownStep === 0" @click="go(-1)">
          <Icon name="prev" :size="16" />
        </button>
        <button
          v-if="!playing"
          type="button"
          class="btn primary"
          :disabled="steps.length < 2"
          :title="steps.length < 2 ? 'Add a second step to play' : undefined"
          @click="start"
        >
          <Icon name="play" :size="16" />Play
        </button>
        <button v-else type="button" class="btn primary" @click="pause"><Icon name="pause" :size="16" />Pause</button>
        <button
          type="button"
          class="btn icon"
          aria-label="Next step"
          :disabled="shownStep >= steps.length - 1"
          @click="go(1)"
        >
          <Icon name="next" :size="16" />
        </button>
        <div class="seg speed" role="group" aria-label="Speed">
          <button v-for="s in SPEEDS" :key="s" type="button" :aria-pressed="speed === s" @click="speed = s">
            {{ s }}×
          </button>
        </div>
      </div>

      <div class="steps" role="group" aria-label="Steps">
        <button
          v-for="(s, i) in steps"
          :key="s.id"
          type="button"
          class="step"
          :aria-pressed="shownStep === i"
          :aria-label="`Step ${i + 1}`"
          @click="pick(i)"
        >
          {{ i + 1 }}
        </button>
        <button type="button" class="btn small" :disabled="playing" @click="store.addStep()">
          <Icon name="plus" :size="14" />Add step
        </button>
      </div>

      <div v-if="!playing" class="row">
        <label v-if="store.stepIndex > 0" class="seconds">
          <span class="field-label">Seconds to get to step {{ store.stepIndex + 1 }}</span>
          <input
            class="input"
            type="number"
            :min="MIN_STEP_SECONDS"
            :max="MAX_STEP_SECONDS"
            step="0.1"
            :value="store.openStep?.duration"
            @change="onDuration"
          />
        </label>
        <button
          type="button"
          class="btn danger small"
          :disabled="steps.length <= 1"
          @click="store.deleteStep(store.stepIndex)"
        >
          <Icon name="trash" :size="14" />Delete step {{ store.stepIndex + 1 }}
        </button>
      </div>
      <div class="row download">
        <span class="field-label">Download at {{ speed }}×</span>
        <button
          v-for="f in FORMATS"
          :key="f.id"
          type="button"
          class="btn small"
          :disabled="!!making || playing || !supported[f.id] || steps.length < 2"
          :title="formatTitle(f.id)"
          @click="download(f.id)"
        >
          <Icon name="download" :size="14" />{{ f.label }}
        </button>
      </div>
      <div v-if="making" class="row making" role="status">
        <progress :value="progress" max="1" :aria-label="`Making ${making.toUpperCase()}`" />
        <span class="hint">Making {{ making.toUpperCase() }}… {{ Math.round(progress * 100) }}%</span>
        <button type="button" class="btn small" @click="cancel">Cancel</button>
      </div>
      <p class="hint">
        Drag players and the ball to set step {{ shownStep + 1 }}. A new step starts as a copy of the open one.
        Drawings show on every step; pick their steps in the Selection tab.
      </p>
    </template>
  </section>
</template>

<style scoped>
.playbar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel);
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}
.pick {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 220px;
  min-width: 0;
}
.speed {
  width: 160px;
}
.steps {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.step {
  min-width: 40px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: var(--panel);
  font-weight: 600;
}
.step[aria-pressed='true'] {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.download {
  align-items: center;
}
.making {
  align-items: center;
}
.making progress {
  flex: 1 1 160px;
  accent-color: var(--accent);
}
.seconds {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 190px;
}
</style>
