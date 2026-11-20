<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSaveStore } from '@/stores/save';
import { setSides, setTeamSize, targetOptions } from '@/model/positions';
import type { SavedPositions, TeamSide } from '@/model/types';
import { useToasts } from '@/composables/toast';
import Icon from '../Icon.vue';

const store = useSaveStore();
const { show } = useToasts();

const SIDE_LABEL: Record<TeamSide, string> = { home: 'Home', away: 'Away' };
const SAVE_CHOICES: { id: string; label: string; sides: TeamSide[] }[] = [
  { id: 'both', label: 'Both teams', sides: ['home', 'away'] },
  { id: 'home', label: 'Home', sides: ['home'] },
  { id: 'away', label: 'Away', sides: ['away'] },
];

const sets = computed(() => store.positionSets);
const selectedId = ref<string>(sets.value[0]?.id ?? '');
const selected = computed(() => sets.value.find((s) => s.id === selectedId.value) ?? null);
const options = computed(() => (selected.value ? targetOptions(selected.value) : []));
const targetId = ref('');
const withNames = ref(false);
const withBall = ref(true);
const newName = ref('');
const saveChoice = ref('both');
const saveBall = ref(true);

// Keep the picks valid as sets are added, deleted or the board changes sport.
watch(
  sets,
  (list) => {
    if (!list.some((s) => s.id === selectedId.value)) selectedId.value = list[0]?.id ?? '';
  },
  { deep: true },
);
watch(
  options,
  (opts) => {
    if (!opts.some((o) => o.id === targetId.value)) targetId.value = opts[0]?.id ?? '';
  },
  { immediate: true },
);

function describe(set: SavedPositions): string {
  const sides = setSides(set);
  const who = sides.length === 2 ? 'both teams' : SIDE_LABEL[sides[0]!].toLowerCase();
  return `${set.name} · ${who} · ${setTeamSize(set)} players${set.ball ? ' · ball' : ''}`;
}

/** Warns when loading changes how many players a team has. */
const sizeNote = computed(() => {
  const set = selected.value;
  const option = options.value.find((o) => o.id === targetId.value);
  if (!set || !option) return '';
  const notes = option.targets
    .map(({ from, to }) => {
      const now = store.board.players.filter((p) => p.team === to).length;
      const next = set[from]?.length ?? now;
      return now === next ? '' : `${SIDE_LABEL[to]} from ${now} to ${next} players`;
    })
    .filter(Boolean);
  return notes.length ? `This changes ${notes.join(' and ')}.` : '';
});

function load(): void {
  const set = selected.value;
  const option = options.value.find((o) => o.id === targetId.value);
  if (!set || !option) return;
  store.loadPositions(set.id, option.targets, { withNames: withNames.value, withBall: withBall.value });
  show(`Loaded "${set.name}".`);
}

function save(): void {
  const choice = SAVE_CHOICES.find((c) => c.id === saveChoice.value)!;
  const id = store.savePositions(newName.value, choice.sides, saveBall.value);
  if (!id) return;
  show(`Saved "${newName.value.trim()}".`);
  newName.value = '';
  selectedId.value = id;
}

function rename(): void {
  const set = selected.value;
  if (!set) return;
  const name = window.prompt('New name for these positions', set.name);
  if (name?.trim()) store.renamePositions(set.id, name.trim());
}

function remove(): void {
  const set = selected.value;
  if (!set) return;
  store.deletePositions(set.id);
  show(`Deleted "${set.name}". Undo brings it back.`);
}
</script>

<template>
  <section class="card positions" data-testid="positions">
    <h3 class="section-title">Starting positions</h3>

    <template v-if="sets.length">
      <div class="field-label">
        <label for="saved-positions">Saved positions</label>
        <select id="saved-positions" v-model="selectedId" class="select">
          <option v-for="s in sets" :key="s.id" :value="s.id">{{ describe(s) }}</option>
        </select>
      </div>
      <div class="stack">
        <span class="field-label">Load onto</span>
        <div class="seg" role="group" aria-label="Load onto">
          <button
            v-for="o in options"
            :key="o.id"
            type="button"
            :aria-pressed="targetId === o.id"
            @click="targetId = o.id"
          >
            {{ o.label }}
          </button>
        </div>
      </div>
      <label class="check"><input v-model="withNames" type="checkbox" />Also use their names and numbers</label>
      <label v-if="selected?.ball" class="check"><input v-model="withBall" type="checkbox" />Also move the ball</label>
      <p v-if="sizeNote" class="hint warn">{{ sizeNote }}</p>
      <div class="actions">
        <button type="button" class="btn primary" @click="load">Load positions</button>
        <button type="button" class="btn" @click="rename">Rename</button>
        <button type="button" class="btn icon danger" aria-label="Delete saved positions" title="Delete" @click="remove">
          <Icon name="trash" :size="16" />
        </button>
      </div>
    </template>
    <p v-else class="hint">
      None saved yet. Place the players, then save them here to use again on any {{ store.sport.name.toLowerCase() }} board.
    </p>

    <div class="divider" />

    <label class="field-label">
      Save current positions as
      <input v-model="newName" class="input" placeholder="e.g. Build-up shape" @keydown.enter="save" />
    </label>
    <div class="seg" role="group" aria-label="Teams to save">
      <button
        v-for="c in SAVE_CHOICES"
        :key="c.id"
        type="button"
        :aria-pressed="saveChoice === c.id"
        @click="saveChoice = c.id"
      >
        {{ c.label }}
      </button>
    </div>
    <label class="check">
      <input v-model="saveBall" type="checkbox" :disabled="!store.frame.ball.visible" />
      Include the ball<template v-if="!store.frame.ball.visible"> (hidden on this board)</template>
    </label>
    <button type="button" class="btn" :disabled="!newName.trim()" @click="save">Save positions</button>
  </section>
</template>

<style scoped>
.positions {
  gap: 10px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
.warn {
  color: var(--warn-text);
  background: var(--warn-bg);
  padding: 6px 10px;
  border-radius: 6px;
}
.seg button {
  font-size: 13px;
}
</style>
