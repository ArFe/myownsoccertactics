<script setup lang="ts">
import { computed } from 'vue';
import { useSaveStore } from '@/stores/save';

const props = defineProps<{ drawingId: string }>();
const store = useSaveStore();

const steps = computed(() => store.openPlay?.steps ?? []);
const shownOn = (i: number): boolean => !steps.value[i]?.hidden.includes(props.drawingId);
const onAll = computed(() => steps.value.every((_, i) => shownOn(i)));
</script>

<template>
  <div v-if="store.openPlay" class="stack" data-testid="step-visibility">
    <span class="field-label">Show on steps of "{{ store.openPlay.name }}"</span>
    <div class="steps" role="group" aria-label="Show on steps">
      <button
        v-for="(s, i) in steps"
        :key="s.id"
        type="button"
        class="step"
        :aria-pressed="shownOn(i)"
        :aria-label="`Show on step ${i + 1}`"
        @click="store.setDrawingOnStep(drawingId, i, !shownOn(i))"
      >
        {{ i + 1 }}
      </button>
    </div>
    <div class="actions">
      <button type="button" class="btn small" :disabled="onAll" @click="store.setDrawingSteps(drawingId, 'all')">
        All steps
      </button>
      <button type="button" class="btn small" @click="store.setDrawingSteps(drawingId, store.stepIndex)">
        Only step {{ store.stepIndex + 1 }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.steps,
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.step {
  min-width: 36px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: var(--panel);
  color: var(--muted);
  font-weight: 600;
  text-decoration: line-through;
}
.step[aria-pressed='true'] {
  background: var(--chip);
  color: var(--accent-dark);
  border-color: var(--accent);
  text-decoration: none;
}
</style>
