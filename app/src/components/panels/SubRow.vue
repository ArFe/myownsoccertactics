<script setup lang="ts">
import { useSaveStore } from '@/stores/save';
import type { Player, Sub, SubWave } from '@/model/types';
import Icon from '../Icon.vue';

/** One sub: number, name, who it comes on for, when, swap and delete. */
const props = defineProps<{ sub: Sub; onField: Player[]; waves: SubWave[] }>();
const store = useSaveStore();

function val(e: Event): string {
  return (e.target as HTMLInputElement).value;
}

function playerLabel(id: string): string {
  const p = props.onField.find((x) => x.id === id);
  return p ? `${p.number}${p.name ? ` ${p.name}` : ''}` : '';
}

function onNumber(e: Event): void {
  const n = Number(val(e));
  if (Number.isInteger(n)) store.updateSub(props.sub.id, { number: n });
}
</script>

<template>
  <div class="sub" :data-testid="`sub-${sub.number}`">
    <span class="sub-dot" :style="{ borderColor: waves.find((w) => w.id === sub.waveId)?.color ?? 'var(--border-strong)' }" />
    <input class="input num" type="number" min="0" max="999" aria-label="Sub number" :value="sub.number" @input="onNumber" />
    <input class="input" aria-label="Sub name" placeholder="Name" :value="sub.name" @input="store.updateSub(sub.id, { name: val($event) })" />
    <div class="sub-plan">
      <select class="select" aria-label="Comes on for" :value="sub.replaces" @change="store.updateSub(sub.id, { replaces: val($event) })">
        <option v-for="p in onField" :key="p.id" :value="p.id">for {{ playerLabel(p.id) }}</option>
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
    'dot num name swap del'
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
.num {
  grid-area: num;
}
[aria-label='Sub name'] {
  grid-area: name;
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
