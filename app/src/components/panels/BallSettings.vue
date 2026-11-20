<script setup lang="ts">
import { computed } from 'vue';
import { useSaveStore } from '@/stores/save';
import { BALL_STYLES, BALL_STYLE_IDS, SIZES, type BallStyleId } from '@/model/balls';
import { toColorInput } from '@/utils/color';

const store = useSaveStore();
const ball = computed(() => store.board.ball);
const style = computed(() => BALL_STYLES[ball.value.style]);
</script>

<template>
  <div class="stack ball-settings">
    <label class="field-label">
      Ball style
      <select
        class="select"
        :value="ball.style"
        @change="store.setBallStyle(($event.target as HTMLSelectElement).value as BallStyleId)"
      >
        <option v-for="id in BALL_STYLE_IDS" :key="id" :value="id">{{ BALL_STYLES[id].label }}</option>
      </select>
    </label>
    <div class="colors">
      <label v-for="c in style.colors" :key="c.key" class="swatch-btn">
        <span class="swatch" :style="{ background: ball.colors[c.key] ?? c.default }" />{{ c.label }}
        <input
          type="color"
          :aria-label="`Ball colour: ${c.label}`"
          :value="toColorInput(ball.colors[c.key] ?? c.default)"
          @input="store.setBallColor(c.key, ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>
    <div class="stack">
      <span class="field-label">Ball size</span>
      <div class="seg" role="group" aria-label="Ball size">
        <button
          v-for="s in SIZES"
          :key="s.id"
          type="button"
          :aria-label="s.name"
          :aria-pressed="ball.size === s.id"
          @click="store.setBallSize(s.id)"
        >
          {{ s.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.colors {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}
</style>
