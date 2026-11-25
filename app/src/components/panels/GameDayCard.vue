<script setup lang="ts">
import { computed } from 'vue';
import { useSaveStore } from '@/stores/save';
import { teamSubs, wavesByMinute } from '@/model/gameDay';
import type { SubsShown, TeamSide } from '@/model/types';
import { toColorInput } from '@/utils/color';
import Icon from '../Icon.vue';
import SubRow from './SubRow.vue';
import MemberPicker from './MemberPicker.vue';

const store = useSaveStore();
const gd = computed(() => store.board.gameDay);
const team = computed(() => store.board.teams[gd.value.team]);
const onField = computed(() => store.board.players.filter((p) => p.team === gd.value.team));
const subs = computed(() => teamSubs(store.board, gd.value.team));
const waves = computed(() => wavesByMinute(store.board));

const SHOWN: { id: SubsShown; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'bench', label: 'Bench' },
  { id: 'beside', label: 'Beside player' },
  { id: 'both', label: 'Both' },
];

function val(e: Event): string {
  return (e.target as HTMLInputElement).value;
}

/** A new sub goes in for the first player who has none yet. */
function addSub(memberId: string): void {
  const free = onField.value.find((p) => !store.board.subs.some((s) => s.replaces === p.id)) ?? onField.value[0];
  if (free) store.addSub(free.id, memberId);
}
</script>

<template>
  <section class="card game-day" data-testid="game-day">
    <h3 class="section-title">Game day</h3>
    <label class="check">
      <input type="checkbox" :checked="gd.on" @change="store.setGameDay(($event.target as HTMLInputElement).checked)" />
      Game day mode
    </label>
    <p class="hint">
      Shows only our team, its subs and when they come on. The plan is kept when it is off. During the match,
      <Icon name="swap" :size="12" /> puts a sub on in the player's spot.
    </p>

    <div class="stack">
      <span class="field-label">Our team</span>
      <div class="seg" role="group" aria-label="Our team">
        <button
          v-for="side in (['home', 'away'] as TeamSide[])"
          :key="side"
          type="button"
          :aria-pressed="gd.team === side"
          @click="store.setGameDayTeam(side)"
        >
          {{ store.board.teams[side].name }}
        </button>
      </div>
    </div>

    <div class="stack">
      <span class="field-label">Show subs</span>
      <div class="seg" role="group" aria-label="Show subs">
        <button
          v-for="s in SHOWN"
          :key="s.id"
          type="button"
          :aria-pressed="gd.subsShown === s.id"
          @click="store.setSubsShown(s.id)"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <div class="stack">
      <span class="field-label">Substitution times</span>
      <div v-for="(w, i) in waves" :key="w.id" class="row">
        <label class="swatch-btn wave-color">
          <span class="swatch" :style="{ background: w.color }" />
          <input
            type="color"
            :aria-label="`Colour of time ${i + 1}`"
            :value="toColorInput(w.color)"
            @input="store.updateWave(w.id, { color: val($event) })"
          />
        </label>
        <label class="minute">
          <input
            class="input"
            type="number"
            min="0"
            max="150"
            :aria-label="`Minute of time ${i + 1}`"
            :value="w.minute"
            @change="store.updateWave(w.id, { minute: Number(val($event)) })"
          />
          <span>'</span>
        </label>
        <button
          type="button"
          class="btn icon small danger"
          :aria-label="`Delete time ${i + 1}`"
          @click="store.deleteWave(w.id)"
        >
          <Icon name="trash" :size="14" />
        </button>
      </div>
      <button type="button" class="btn small" @click="store.addWave()"><Icon name="plus" :size="14" />Add a time</button>
    </div>

    <div class="stack">
      <span class="field-label">Subs · {{ team.name }}</span>
      <SubRow v-for="s in subs" :key="s.id" :sub="s" :on-field="onField" :waves="waves" />
      <MemberPicker v-if="onField.length" label="Add a sub" empty-label="Add a sub…" @pick="addSub" />
    </div>
  </section>
</template>

<style scoped>
.game-day {
  gap: 12px;
}
.seg button {
  font-size: 13px;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.wave-color {
  min-height: 36px;
  width: 44px;
  justify-content: center;
}
.minute {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}
.minute .input {
  width: 72px;
  height: 36px;
}
.btn.icon.small {
  width: 36px;
  padding: 0;
}
</style>
