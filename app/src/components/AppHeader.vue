<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSaveStore } from '@/stores/save';
import { serializeSave } from '@/model/persistence';
import { downloadBlob, fileSlug } from '@/export/download';
import { downloadBoardPng } from '@/export/renderer';
import { useToasts } from '@/composables/toast';
import Icon from './Icon.vue';

const emit = defineEmits<{ 'open-save': []; upload: [] }>();
const store = useSaveStore();
const { show } = useToasts();
const busy = ref(false);

const status = computed(() => {
  if (store.storageFailed) return { ok: false, text: 'Not saved: browser storage is full or blocked' };
  return { ok: true, text: 'Saved in this browser' };
});

function downloadSave(): void {
  const blob = new Blob([serializeSave(store.save)], { type: 'application/json' });
  downloadBlob(blob, `${fileSlug(store.save.name)}.tactics.json`);
}

async function downloadPng(): Promise<void> {
  busy.value = true;
  try {
    await downloadBoardPng(store.frame);
  } catch (err) {
    show(err instanceof Error ? err.message : 'The image could not be made.', 'error');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect x="1" y="5" width="28" height="20" rx="3" fill="#1F6F4A" />
        <g fill="none" stroke="#FFFFFF" stroke-width="1.4">
          <rect x="3.5" y="7.5" width="23" height="15" rx="0.5" />
          <line x1="15" y1="7.5" x2="15" y2="22.5" />
          <circle cx="15" cy="15" r="3" />
        </g>
      </svg>
      <span class="brand-name">Tactics Board</span>
    </div>
    <div class="save-info">
      <button type="button" class="save-name" title="Save file: boards, download and upload" @click="emit('open-save')">
        {{ store.save.name || 'Untitled save' }}
      </button>
      <span class="status" :class="{ bad: !status.ok }" role="status">
        <span class="dot" />{{ status.text }}
      </span>
    </div>
    <div class="spacer" />
    <div class="actions">
      <button type="button" class="btn icon" aria-label="Undo" title="Undo (Ctrl+Z)" :disabled="!store.canUndo" @click="store.undo()">
        <Icon name="undo" />
      </button>
      <button type="button" class="btn icon" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" :disabled="!store.canRedo" @click="store.redo()">
        <Icon name="redo" />
      </button>
      <span class="divider" />
      <button type="button" class="btn" @click="emit('upload')"><Icon name="upload" />Upload save</button>
      <button type="button" class="btn" @click="downloadSave"><Icon name="download" />Download save</button>
      <button type="button" class="btn primary" :disabled="busy" @click="downloadPng"><Icon name="image" />Download PNG</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 10px 20px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-name {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
}
.save-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  padding-left: 16px;
  border-left: 1px solid var(--border);
}
.save-name {
  border: 0;
  background: transparent;
  padding: 6px 4px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 6px;
}
.save-name:hover {
  background: var(--seg);
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22a35a;
}
.status.bad {
  color: var(--danger);
}
.status.bad .dot {
  background: var(--danger);
}
.spacer {
  flex: 1;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.divider {
  width: 1px;
  height: 28px;
  background: var(--border);
}
</style>
