<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSaveStore } from '@/stores/save';
import { useAddPlayers } from '@/composables/addPlayers';
import { parsePositions } from '@/model/squad';
import type { SquadMember } from '@/model/types';
import Icon from '../Icon.vue';

/**
 * Every player of the open sport's squad, in one list. Our team's spots and
 * subs are always members; a member made for a spot has no name until typed.
 */
const store = useSaveStore();
const { openAddPlayers } = useAddPlayers();
const fileInput = ref<HTMLInputElement | null>(null);
const errors = ref<Record<string, string>>({});
const report = ref<string[] | null>(null);

const squad = computed(() => [...store.sportSquad].sort((a, b) => a.number - b.number));

/** Where each member is on the open board. */
const where = computed(() => {
  const out = new Map<string, string>();
  for (const p of store.board.players) if (p.memberId) out.set(p.memberId, 'On field');
  for (const s of store.board.subs) if (s.memberId) out.set(s.memberId, 'Bench');
  return out;
});

function val(e: Event): string {
  return (e.target as HTMLInputElement).value;
}

function setError(id: string, message: string | null): void {
  const next = { ...errors.value };
  if (message) next[id] = message;
  else delete next[id];
  errors.value = next;
}

function onNumber(m: SquadMember, e: Event): void {
  const input = e.target as HTMLInputElement;
  const problem = store.updateMember(m.id, { number: Number(input.value) });
  setError(m.id, problem);
  if (problem) input.value = String(m.number);
}

async function onFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const { members, skipped } = store.importSquadCsv(await file.text());
  report.value = [
    `Added ${members.length} player${members.length === 1 ? '' : 's'} from ${file.name}.`,
    ...skipped.map((s) => `Row ${s.row} skipped: ${s.reason}`),
  ];
}
</script>

<template>
  <div class="stack squad" data-testid="squad">
    <h3 class="section-title">Squad · {{ squad.length }} player{{ squad.length === 1 ? '' : 's' }}</h3>
    <p class="hint">
      Your {{ store.sport.name.toLowerCase() }} players, for every board of the sport. Each player of our team is one of
      them: a new spot adds a player with no name. Type the name here or on the field.
    </p>
    <div class="actions">
      <button type="button" class="btn small primary" @click="openAddPlayers()"><Icon name="plus" :size="14" />Add players</button>
      <button type="button" class="btn small" @click="fileInput?.click()"><Icon name="upload" :size="14" />Import CSV</button>
      <input ref="fileInput" type="file" accept=".csv,text/csv,text/plain" hidden aria-label="Squad CSV file" @change="onFile" />
    </div>
    <p class="hint">CSV: one player per row, <code>number,name,positions</code>, e.g. <code>9,Ariel,ST/LW</code>.</p>
    <div v-if="report" class="report" role="status" data-testid="csv-report">
      <p v-for="(line, i) in report" :key="i">{{ line }}</p>
    </div>

    <p v-if="squad.length === 0" class="hint empty">No players yet.</p>
    <div v-for="m in squad" :key="m.id" class="member" :data-testid="`member-${m.number}`">
      <input
        class="input num"
        type="number"
        min="0"
        max="999"
        aria-label="Squad number"
        :value="m.number"
        @change="onNumber(m, $event)"
      />
      <input class="input" aria-label="Squad name" placeholder="Name" :value="m.name" @input="store.updateMember(m.id, { name: val($event) })" />
      <button type="button" class="btn icon small danger" :aria-label="`Delete ${m.name || m.number}`" @click="store.deleteMember(m.id)">
        <Icon name="trash" :size="14" />
      </button>
      <input
        class="input pos"
        aria-label="Squad positions"
        placeholder="Positions, e.g. ST/LW"
        :value="m.positions.join('/')"
        @change="store.updateMember(m.id, { positions: parsePositions(val($event)) })"
      />
      <span class="where">{{ where.get(m.id) ?? '' }}</span>
      <p v-if="errors[m.id]" class="error" role="alert">{{ errors[m.id] }}</p>
    </div>
  </div>
</template>

<style scoped>
.squad {
  gap: 10px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.empty {
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
}
.report {
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--accent-soft);
}
.report p {
  margin: 0;
}
.member {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 56px;
  grid-template-areas:
    'num name del'
    'pos pos where'
    'err err err';
  gap: 4px 6px;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.num {
  grid-area: num;
}
[aria-label='Squad name'] {
  grid-area: name;
}
.danger {
  grid-area: del;
  justify-self: end;
}
.pos {
  grid-area: pos;
}
.where {
  grid-area: where;
  font-size: 11px;
  color: var(--muted);
  text-align: center;
}
.error {
  grid-area: err;
  margin: 0;
  color: var(--danger);
  font-size: 12px;
  font-weight: 500;
}
.input {
  height: 36px;
  padding: 0 6px;
  font-size: 13px;
}
.btn.icon.small {
  width: 36px;
  padding: 0;
}
code {
  font-size: 12px;
}
</style>
