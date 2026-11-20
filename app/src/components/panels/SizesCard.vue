<script setup lang="ts">
import { useSaveStore } from '@/stores/save';
import { SIZES } from '@/model/balls';
import BallSettings from './BallSettings.vue';

const store = useSaveStore();
</script>

<template>
  <section class="card" data-testid="players-and-ball">
    <h3 class="section-title">Players and ball</h3>
    <div class="stack">
      <span class="field-label">Player size</span>
      <div class="seg" role="group" aria-label="Player size">
        <button
          v-for="s in SIZES"
          :key="s.id"
          type="button"
          :aria-label="s.name"
          :aria-pressed="store.board.playerSize === s.id"
          @click="store.setPlayerSize(s.id)"
        >
          {{ s.label }}
        </button>
      </div>
    </div>
    <BallSettings />
  </section>
</template>
