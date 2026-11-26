<script setup lang="ts">
import { computed } from 'vue';
import { useSaveStore } from '@/stores/save';
import type { Player, Sub, SubWave } from '@/model/types';
import Icon from '../Icon.vue';
import MemberPicker from './MemberPicker.vue';

/**
 * One sub: who (from the squad), who they come on for, when, swap and delete.
 * One bench player can have several rows: one per player they may come on for.
 */
const props = defineProps<{ sub: Sub; onField: Player[]; waves: SubWave[] }>();
const store = useSaveStore();

/** Players this sub may come on for: not those the same bench player already covers in another row. */
const forOptions = computed(() =>
  props.onField.filter(
    (p) =>
      p.id === props.sub.replaces ||
      !store.board.subs.some((s) => s.id !== props.sub.id && s.memberId === props.sub.memberId && s.replaces === p.id),
  ),
);

function val(e: Event): string {
  return (e.target as HTMLInputElement).value;
}

function playerLabel(id: string): string {
  const p = props.onField.find((x) => x.id === id);
  return p ? `${p.number}${p.name ? ` ${p.name}` : ''}` : '';
}
</script>

<template>
  <div class="sub" :data-testid="`sub-${sub.number}`">
    <span class="sub-dot" :style="{ borderColor: waves.find((w) => w.id === sub.waveId)?.color ?? 'var(--border-strong)' }" />
    <MemberPicker
      class="who"
      label="Sub player"
      bench
      :sub-for="sub.replaces"
      :current="sub.memberId"
      @pick="(m) => store.assignMemberTo('sub', sub.id, m)"
    />
    <div class="sub-plan">
      <select class="select" aria-label="Comes on for" :value="sub.replaces" @change="store.updateSub(sub.id, { replaces: val($event) })">
        <option v-for="p in forOptions" :key="p.id" :value="p.id">for {{ playerLabel(p.id) }}</option>
      </select>
      <select class="select" aria-label="Time" :value="sub.waveId ?? ''" @change="store.updateSub(sub.id, { waveId: val($event) || null })">
        <option value="">No time yet</option>
        <option v-for="w in waves" :key="w.id" :value="w.id">{{ w.minute }}'</option>
      </select>
    </div>
    <button
      type="button"
      class="btn icon small swap"
      :aria-label="`Swap ${sub.number} on for ${playerLabel(sub.replaces)}`"
      :title="`Swap on: ${sub.number} goes on for ${playerLabel(sub.replaces)}, who goes to the bench`"
      @click="store.swapSub(sub.id)"
    >
      <Icon name="swap" :size="14" />
    </button>
    <button type="button" class="btn icon small danger" aria-label="Delete sub" @click="store.deleteSub(sub.id)">
      <Icon name="trash" :size="14" />
    </button>
  </div>
</template>

<style scoped>
.sub {
  display: grid;
  grid-template-columns: 10px 58px minmax(0, 1fr) 36px 36px;
  grid-template-areas:
    'dot who who swap del'
    '. plan plan plan plan';
  gap: 4px 6px;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.sub-dot {
  grid-area: dot;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 3px solid;
}
.who {
  grid-area: who;
}
.swap {
  grid-area: swap;
}
[aria-label='Delete sub'] {
  grid-area: del;
}
.sub-plan {
  grid-area: plan;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 6px;
}
.input,
.select {
  height: 36px;
  padding: 0 6px;
  font-size: 13px;
}
.btn.icon.small {
  width: 36px;
  padding: 0;
}
</style>
