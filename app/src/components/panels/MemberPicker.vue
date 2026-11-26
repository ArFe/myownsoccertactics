<script setup lang="ts">
import { computed } from 'vue';
import { useSaveStore } from '@/stores/save';
import { useAddPlayers } from '@/composables/addPlayers';
import { memberLabel } from '@/model/squad';

/**
 * Picks a player from the open sport's squad.
 * - For a field spot: anyone; one already on the field or bench swaps with this spot.
 * - For the bench (`bench`): anyone not on the field. One player may be a
 *   sub for several players, so only those already a sub for `subFor` are left out.
 * "New player…" opens the Add players window, and the first one added is picked.
 * The empty choice (`emptyLabel`) shows only while nothing is picked.
 * `compact` shows the picked player by number only, for a narrow column.
 */
const props = defineProps<{
  current?: string;
  emptyLabel?: string;
  label: string;
  bench?: boolean;
  subFor?: string;
  compact?: boolean;
}>();
const emit = defineEmits<{ pick: [memberId: string] }>();
const store = useSaveStore();
const { openAddPlayers } = useAddPlayers();

const NEW = '__new';
const options = computed(() => {
  const b = store.board;
  const used = new Set<string>();
  if (props.bench) {
    for (const p of b.players) if (p.memberId) used.add(p.memberId);
    for (const s of b.subs) if (s.memberId && s.replaces === props.subFor) used.add(s.memberId);
  }
  return [...store.sportSquad]
    .filter((m) => m.id === props.current || !used.has(m.id))
    .sort((a, b) => a.number - b.number)
    .map((m) => ({
      id: m.id,
      label:
        props.compact && m.id === props.current
          ? String(m.number)
          : `${memberLabel(m)}${m.positions.length ? ` · ${m.positions.join('/')}` : ''}`,
    }));
});

function onChange(e: Event): void {
  const select = e.target as HTMLSelectElement;
  const v = select.value;
  // The select shows what the store says, not what was clicked.
  select.value = props.current ?? '';
  if (v === NEW) openAddPlayers((id) => emit('pick', id), { bench: props.bench });
  else if (v) emit('pick', v);
}
</script>

<template>
  <select class="select" :aria-label="label" :value="current ?? ''" @change="onChange">
    <option v-if="!current" value="">{{ emptyLabel ?? 'Pick a player…' }}</option>
    <option v-for="o in options" :key="o.id" :value="o.id">{{ o.label }}</option>
    <option :value="NEW">New player…</option>
  </select>
</template>
