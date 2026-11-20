<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useSaveStore, type Tool } from '@/stores/save';
import { useToasts } from '@/composables/toast';
import AppHeader from './components/AppHeader.vue';
import BoardSidebar from './components/BoardSidebar.vue';
import BoardView from './components/BoardView.vue';
import PropertiesPanel from './components/PropertiesPanel.vue';
import SaveDialog from './components/SaveDialog.vue';
import ExportHost from './components/ExportHost.vue';
import { useFieldZoom } from './composables/zoom';

const fieldZoom = useFieldZoom();

const store = useSaveStore();
const { toasts, dismiss } = useToasts();
const saveOpen = ref(false);
const dialog = ref<InstanceType<typeof SaveDialog> | null>(null);
const boardView = ref<InstanceType<typeof BoardView> | null>(null);

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  r: 'rect',
  e: 'ellipse',
  p: 'polygon',
  a: 'arrow',
  t: 'text',
  c: 'cone',
  b: 'ball',
};

async function openUpload(): Promise<void> {
  saveOpen.value = true;
  await nextTick();
  dialog.value?.pickFile();
}

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

function onKey(e: KeyboardEvent): void {
  if (saveOpen.value) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') {
    if (typing(e.target)) return; // let inputs undo their own text
    e.preventDefault();
    if (e.shiftKey) store.redo();
    else store.undo();
    return;
  }
  if (mod && e.key.toLowerCase() === 'y') {
    if (typing(e.target)) return;
    e.preventDefault();
    store.redo();
    return;
  }
  if (typing(e.target) || mod || e.altKey) return;

  if (e.key === 'Escape') {
    boardView.value?.cancelDraft();
    if (store.tool !== 'select') store.tool = 'select';
    else store.select(null);
    return;
  }
  if (e.key === 'Enter' && store.tool === 'polygon') {
    boardView.value?.finishPolygon();
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    store.deleteSelected();
    return;
  }
  if (e.key === '+' || e.key === '=') return fieldZoom.zoomBy(1);
  if (e.key === '-') return fieldZoom.zoomBy(-1);
  if (e.key === '0') return fieldZoom.resetZoom();
  const tool = TOOL_KEYS[e.key.toLowerCase()];
  if (tool) store.tool = tool;
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="app">
    <AppHeader @open-save="saveOpen = true" @upload="openUpload" />
    <div v-if="store.notice" class="notice" role="alert">
      <span>{{ store.notice }}</span>
      <button type="button" class="btn small" @click="store.dismissNotice()">OK</button>
    </div>
    <div class="workspace">
      <div class="side">
        <BoardSidebar />
      </div>
      <BoardView ref="boardView" />
      <PropertiesPanel />
    </div>
    <SaveDialog ref="dialog" :open="saveOpen" @close="saveOpen = false" />
    <ExportHost />
    <div class="toasts" aria-live="polite">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.kind" @click="dismiss(t.id)">{{ t.text }}</div>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.notice {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  background: var(--warn-bg);
  color: var(--warn-text);
  font-size: 13px;
}
.notice span {
  flex: 1;
}
.workspace {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
}
.side {
  /* Wide enough for two tool buttons a row ("Rectangle" is the longest). */
  flex: 1 1 240px;
  display: flex;
}
@media (min-width: 1100px) {
  .side {
    max-width: 260px;
  }
}
/* On small screens the field comes first. */
@media (max-width: 899px) {
  .workspace > :deep(.board-view) {
    order: -1;
  }
}
.toasts {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
}
.toast {
  padding: 10px 16px;
  border-radius: 8px;
  background: #18201b;
  color: #fff;
  font-size: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  cursor: pointer;
}
.toast.error {
  background: var(--danger);
}
</style>
