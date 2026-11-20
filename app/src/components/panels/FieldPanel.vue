<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSaveStore } from '@/stores/save';
import { sportMarkingAvailable } from '@/model/field';
import { CUSTOM_PRESET } from '@/model/types';
import { toColorInput } from '@/utils/color';

const store = useSaveStore();

// Presets, markings and size limits all come from the board's sport.
const presets = computed(() =>
  store.sport.presets.map((p) => ({ id: p.id, label: p.label, size: `${p.length} × ${p.width}` })),
);
const markings = computed(() =>
  store.sport.markings.filter((m) => sportMarkingAvailable(store.sport, store.board.field.preset, m.key)),
);
const limits = computed(() => store.sport.sizeLimits);

// Size fields are applied on change (blur or Enter), not on every key.
const length = ref(store.board.field.length);
const width = ref(store.board.field.width);
watch(
  () => [store.board.field.length, store.board.field.width],
  ([l, w]) => {
    length.value = l!;
    width.value = w!;
  },
);

function applySize(): void {
  store.setFieldSize(Number(length.value), Number(width.value));
  length.value = store.board.field.length;
  width.value = store.board.field.width;
}
</script>

<template>
  <div class="stack field-panel">
    <section class="stack">
      <h3 class="section-title">Field size</h3>
      <div class="presets">
        <button
          v-for="p in presets"
          :key="p.id"
          type="button"
          class="preset"
          :aria-pressed="store.board.field.preset === p.id"
          @click="store.setPreset(p.id)"
        >
          <span class="preset-name">{{ p.label }}</span>
          <span class="preset-size">{{ p.size }}</span>
        </button>
        <span class="preset" :aria-pressed="store.board.field.preset === CUSTOM_PRESET" role="note">
          <span class="preset-name">Custom</span>
          <span class="preset-size">type a size</span>
        </span>
      </div>
      <div class="grid-2">
        <label class="field-label">
          Length (m)
          <input v-model="length" class="input" type="number" :min="limits.min" :max="limits.max" step="0.5" @change="applySize" />
        </label>
        <label class="field-label">
          Width (m)
          <input v-model="width" class="input" type="number" :min="limits.min" :max="limits.max" step="0.5" @change="applySize" />
        </label>
      </div>
      <p class="hint">
        Typing a size switches to Custom ({{ limits.min }}–{{ limits.max }} m). Everything on the board stretches with the
        field. A preset with another team size also resets the teams to its default formations.
      </p>
    </section>

    <section class="stack">
      <h3 class="section-title">Orientation</h3>
      <div class="seg" role="group" aria-label="Orientation">
        <button
          type="button"
          :aria-pressed="store.board.field.orientation === 'horizontal'"
          @click="store.updateField({ orientation: 'horizontal' })"
        >
          Horizontal
        </button>
        <button
          type="button"
          :aria-pressed="store.board.field.orientation === 'vertical'"
          @click="store.updateField({ orientation: 'vertical' })"
        >
          Vertical
        </button>
      </div>
    </section>

    <section class="stack">
      <h3 class="section-title">Markings</h3>
      <label
        v-for="m in markings"
        :key="m.key"
        class="check"
      >
        <input
          type="checkbox"
          :checked="store.board.field.markings[m.key]"
          @change="store.setMarking(m.key, ($event.target as HTMLInputElement).checked)"
        />{{ m.label }}
      </label>
    </section>

    <section class="stack">
      <h3 class="section-title">Colours</h3>
      <div class="grid-2">
        <label class="swatch-btn">
          <span class="swatch" :style="{ background: store.board.field.surfaceColor }" />{{ store.sport.surface.label }}
          <input
            type="color"
            :aria-label="`${store.sport.surface.label} colour`"
            :value="toColorInput(store.board.field.surfaceColor)"
            @input="store.updateField({ surfaceColor: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <label class="swatch-btn">
          <span class="swatch" :style="{ background: store.board.field.lineColor }" />Lines
          <input
            type="color"
            aria-label="Line colour"
            :value="toColorInput(store.board.field.lineColor)"
            @input="store.updateField({ lineColor: ($event.target as HTMLInputElement).value })"
          />
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.field-panel {
  gap: 18px;
}
.presets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 6px;
}
.preset {
  min-height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background: var(--panel);
}
.preset[aria-pressed='true'] {
  border: 2px solid var(--accent);
  background: var(--accent-soft);
  color: var(--accent-dark);
}
span.preset {
  border-style: dashed;
}
.preset-name {
  font-size: 14px;
  font-weight: 600;
}
.preset-size {
  font-size: 11px;
  color: var(--muted);
}
</style>
