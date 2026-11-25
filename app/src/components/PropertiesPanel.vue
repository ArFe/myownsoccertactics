<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSaveStore } from '@/stores/save';
import TeamsPanel from './panels/TeamsPanel.vue';
import FieldPanel from './panels/FieldPanel.vue';
import SelectionPanel from './panels/SelectionPanel.vue';
import SquadPanel from './panels/SquadPanel.vue';

type Tab = 'teams' | 'squad' | 'field' | 'selection';
const TABS: { id: Tab; label: string }[] = [
  { id: 'teams', label: 'Teams' },
  { id: 'squad', label: 'Squad' },
  { id: 'field', label: 'Field' },
  { id: 'selection', label: 'Selection' },
];

const store = useSaveStore();
const tab = ref<Tab>('teams');

// Selecting something on the field opens its settings.
watch(
  () => store.selection,
  (sel) => {
    if (sel) tab.value = 'selection';
  },
);
</script>

<template>
  <aside class="properties" aria-label="Properties">
    <div class="seg tabs" role="tablist" aria-label="Panels">
      <button
        v-for="t in TABS"
        :id="`tab-${t.id}`"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        :aria-controls="`panel-${t.id}`"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>
    <div :id="`panel-${tab}`" role="tabpanel" :aria-labelledby="`tab-${tab}`">
      <TeamsPanel v-if="tab === 'teams'" />
      <SquadPanel v-else-if="tab === 'squad'" />
      <FieldPanel v-else-if="tab === 'field'" />
      <SelectionPanel v-else />
    </div>
  </aside>
</template>

<style scoped>
.properties {
  flex: 1 1 300px;
  max-width: 100%;
  background: var(--panel);
  border-left: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* Four tabs: each takes the room its label needs, so "Selection" fits. */
.tabs {
  grid-auto-columns: auto;
}
.tabs button {
  padding: 0 6px;
  font-size: 13px;
  white-space: nowrap;
}
@media (min-width: 1100px) {
  .properties {
    max-width: 340px;
  }
}
</style>
