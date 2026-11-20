<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSaveStore } from '@/stores/save';
import TeamsPanel from './panels/TeamsPanel.vue';
import FieldPanel from './panels/FieldPanel.vue';
import SelectionPanel from './panels/SelectionPanel.vue';

type Tab = 'teams' | 'field' | 'selection';
const TABS: { id: Tab; label: string }[] = [
  { id: 'teams', label: 'Teams' },
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
    <div class="seg" role="tablist" aria-label="Panels">
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
@media (min-width: 1100px) {
  .properties {
    max-width: 340px;
  }
}
</style>
