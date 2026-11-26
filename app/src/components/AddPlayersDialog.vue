<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useSaveStore } from '@/stores/save';
import { useAddPlayers } from '@/composables/addPlayers';
import { memberLabel, parsePositions, rolesOf } from '@/model/squad';
import Icon from './Icon.vue';

/** Adds squad players one after another; the window stays open until Done. */
const store = useSaveStore();
const { open, forBench, closeAddPlayers, added } = useAddPlayers();
const dialog = ref<HTMLDialogElement | null>(null);
const nameInput = ref<HTMLInputElement | null>(null);

const number = ref(1);
const name = ref('');
const positions = ref('');
const error = ref<string | null>(null);
const addedNow = ref<string[]>([]);

const roles = computed(() => rolesOf(store.sport));
const chosen = computed(() => parsePositions(positions.value));

function reset(): void {
  number.value = forBench.value ? store.nextUnusedNumber : store.nextSquadNumber;
  name.value = '';
  positions.value = '';
  error.value = null;
}

watch(open, async (isOpen) => {
  if (isOpen) {
    addedNow.value = [];
    reset();
    if (!dialog.value?.open) dialog.value?.showModal();
    await nextTick();
    nameInput.value?.focus();
  } else if (dialog.value?.open) {
    dialog.value.close();
  }
});

function toggleRole(role: string): void {
  const list = chosen.value;
  positions.value = (list.includes(role) ? list.filter((r) => r !== role) : [...list, role]).join('/');
}

async function add(): Promise<void> {
  const result = store.addMember(
    { number: Number(number.value), name: name.value, positions: chosen.value },
    { fillBlank: !forBench.value },
  );
  if ('error' in result) {
    error.value = result.error;
    return;
  }
  addedNow.value.push(memberLabel({ number: Number(number.value), name: name.value.trim() }));
  added(result.id);
  reset();
  await nextTick();
  nameInput.value?.focus();
}
</script>

<template>
  <dialog ref="dialog" class="add-players" aria-labelledby="add-players-title" @close="closeAddPlayers">
    <form class="inner" @submit.prevent="add">
      <div class="head">
        <h2 id="add-players-title">Add players</h2>
        <button type="button" class="btn icon close" aria-label="Close" @click="closeAddPlayers"><Icon name="close" :size="20" /></button>
      </div>
      <p class="hint">Players join the squad and can be picked for any board. Press Enter to add one and start the next.</p>
      <div class="who">
        <label class="field-label">
          Number
          <input v-model.number="number" class="input" type="number" min="0" max="999" aria-label="New player number" />
        </label>
        <label class="field-label">
          Name
          <input ref="nameInput" v-model="name" class="input" placeholder="e.g. Ariel" aria-label="New player name" maxlength="40" />
        </label>
      </div>
      <div class="stack">
        <label class="field-label" for="new-positions">Positions</label>
        <div class="roles" role="group" aria-label="Positions">
          <button
            v-for="r in roles"
            :key="r"
            type="button"
            class="chip"
            :aria-pressed="chosen.includes(r)"
            @click="toggleRole(r)"
          >
            {{ r }}
          </button>
        </div>
        <input id="new-positions" v-model="positions" class="input" placeholder="e.g. ST/LW" aria-label="New player positions" />
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="addedNow.length" class="hint" data-testid="added-now">Added: {{ addedNow.join(', ') }}</p>
      <div class="actions">
        <button type="button" class="btn" @click="closeAddPlayers">Done</button>
        <button type="submit" class="btn primary"><Icon name="plus" :size="16" />Add player</button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.add-players {
  width: min(460px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  padding: 0;
  border: 0;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
}
.add-players::backdrop {
  background: rgba(30, 38, 33, 0.6);
}
.inner {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.head h2 {
  margin: 0;
  font-size: 18px;
}
.who {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 8px;
}
.roles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  min-width: 40px;
  height: 30px;
  padding: 0 8px;
  border-radius: 15px;
  border: 1px solid var(--border-strong);
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}
.chip[aria-pressed='true'] {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.error {
  margin: 0;
  color: var(--danger);
  font-size: 13px;
  font-weight: 500;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
