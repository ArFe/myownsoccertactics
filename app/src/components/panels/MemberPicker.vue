<script setup lang="ts">
import { computed } from 'vue';
import { useSaveStore } from '@/stores/save';
import { useAddPlayers } from '@/composables/addPlayers';
import { memberLabel, membersOnBoard } from '@/model/squad';

/**
 * Picks a squad player: those not yet on this board, plus `current`.
 * "New player…" opens the Add players window, and the first one added is picked.
 */
const props = defineProps<{ current?: string; emptyLabel: string; label: string }>();
const emit = defineEmits<{ pick: [memberId: string]; none: [] }>();
const store = useSaveStore();
const { openAddPlayers } = useAddPlayers();

const NEW = '__new';
const options = computed(() => {
  const used = membersOnBoard(store.board);
  return [...store.save.squad]
    .filter((m) => m.id === props.current || !used.has(m.id))
    .sort((a, b) => a.number - b.number)
    .map((m) => ({ id: m.id, label: `${memberLabel(m)}${m.positions.length ? ` · ${m.positions.join('/')}` : ''}` }));
});

function onChange(e: Event): void {
  const select = e.target as HTMLSelectElement;
  const v = select.value;
  // The select shows what the store says, not what was clicked.
  select.value = props.current ?? '';
  if (v === NEW) openAddPlayers((id) => emit('pick', id));
  else if (v === '') emit('none');
  else emit('pick', v);
}
</script>

<template>
  <select class="select" :aria-label="label" :value="current ?? ''" @change="onChange">
    <option value="">{{ emptyLabel }}</option>
    <option v-for="o in options" :key="o.id" :value="o.id">{{ o.label }}</option>
    <option :value="NEW">New player…</option>
  </select>
</template>
