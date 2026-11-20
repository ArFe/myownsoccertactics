<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSaveStore, type ImportMode } from '@/stores/save';
import { parseSave, serializeSave, SaveFormatError } from '@/model/persistence';
import { downloadBlob, fileSlug } from '@/export/download';
import { downloadBoardsZip } from '@/export/renderer';
import { useToasts } from '@/composables/toast';
import Icon from './Icon.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const store = useSaveStore();
const { show } = useToasts();
const dialog = ref<HTMLDialogElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const included = ref<Set<string>>(new Set());
const mode = ref<ImportMode>('add');
const busy = ref(false);
const dragOver = ref(false);
const uploadError = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (open) {
      included.value = new Set(store.save.boards.map((b) => b.id));
      uploadError.value = null;
      if (!dialog.value?.open) dialog.value?.showModal();
    } else if (dialog.value?.open) {
      dialog.value.close();
    }
  },
);

// Keep the ticks in step when boards are added or removed while open.
watch(
  () => store.save.boards.map((b) => b.id),
  (ids, old) => {
    const next = new Set([...included.value].filter((id) => ids.includes(id)));
    ids.filter((id) => !old?.includes(id)).forEach((id) => next.add(id));
    included.value = next;
  },
);

const chosen = computed(() => store.save.boards.filter((b) => included.value.has(b.id)));

function toggle(id: string, on: boolean): void {
  const next = new Set(included.value);
  if (on) next.add(id);
  else next.delete(id);
  included.value = next;
}

function itemsLabel(b: (typeof store.save.boards)[number]): string {
  const players = b.players.filter((p) => b.teams[p.team].visible).length;
  const areas = b.areas.length;
  return `${players} players · ${areas} ${areas === 1 ? 'area' : 'areas'}`;
}

function changedLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function downloadJson(): void {
  const save = { ...store.save, boards: chosen.value };
  if (!save.boards.some((b) => b.id === save.activeBoardId)) save.activeBoardId = save.boards[0]!.id;
  const blob = new Blob([serializeSave(save)], { type: 'application/json' });
  downloadBlob(blob, `${fileSlug(store.save.name)}.tactics.json`);
}

async function downloadZip(): Promise<void> {
  busy.value = true;
  try {
    await downloadBoardsZip(chosen.value, store.save.name);
  } catch (err) {
    show(err instanceof Error ? err.message : 'The images could not be made.', 'error');
  } finally {
    busy.value = false;
  }
}

function removeBoard(id: string, name: string): void {
  if (store.save.boards.length <= 1) {
    show('A save needs at least one board.', 'error');
    return;
  }
  if (window.confirm(`Delete the board "${name}"? You can undo this.`)) store.deleteBoard(id);
}

async function readFile(file: File): Promise<void> {
  uploadError.value = null;
  try {
    const parsed = parseSave(await file.text());
    if (mode.value === 'replace' && !window.confirm('Replace this whole save with the file? You can undo this.')) return;
    const n = store.importSave(parsed, mode.value);
    show(mode.value === 'add' ? `Added ${n} ${n === 1 ? 'board' : 'boards'}.` : 'Save replaced.');
  } catch (err) {
    uploadError.value = err instanceof SaveFormatError ? err.message : 'The file could not be read.';
  }
}

function onPick(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void readFile(file);
  input.value = '';
}

function onDrop(e: DragEvent): void {
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) void readFile(file);
}

defineExpose({ pickFile: () => fileInput.value?.click() });
</script>

<template>
  <dialog ref="dialog" class="save-dialog" aria-labelledby="save-title" @close="emit('close')">
    <div class="inner">
      <div class="head">
        <h2 id="save-title">Save file</h2>
        <button type="button" class="btn icon close" aria-label="Close" @click="emit('close')"><Icon name="close" :size="20" /></button>
      </div>

      <div class="top">
        <label class="field-label">
          Save name
          <input
            class="input"
            :value="store.save.name"
            @input="store.renameSave(($event.target as HTMLInputElement).value)"
          />
        </label>
        <div class="warn">
          <Icon name="warn" />
          <span>
            Saved only in this browser. Clearing browser data deletes it, so download a copy now and then.
          </span>
        </div>
      </div>

      <section class="stack">
        <h3 class="section-title">Boards in this save</h3>
        <div class="table" role="table" aria-label="Boards">
          <div class="row header" role="row">
            <span role="columnheader"><span class="sr-only">Include</span></span>
            <span role="columnheader">Name</span>
            <span role="columnheader">Field</span>
            <span role="columnheader">Items</span>
            <span role="columnheader">Changed</span>
            <span role="columnheader"><span class="sr-only">Actions</span></span>
          </div>
          <div v-for="(b, i) in store.save.boards" :key="b.id" class="row" role="row">
            <span role="cell">
              <input
                type="checkbox"
                class="tick"
                :checked="included.has(b.id)"
                :aria-label="`Include ${b.name}`"
                @change="toggle(b.id, ($event.target as HTMLInputElement).checked)"
              />
            </span>
            <span role="cell" class="name">
              <button type="button" class="link" @click="store.setActiveBoard(b.id); emit('close')">{{ b.name || 'Untitled board' }}</button>
            </span>
            <span role="cell" class="muted">{{ b.field.preset }}</span>
            <span role="cell" class="muted">{{ itemsLabel(b) }}</span>
            <span role="cell" class="muted">{{ changedLabel(b.updatedAt) }}</span>
            <span role="cell" class="row-actions">
              <button type="button" class="icon-btn" :aria-label="`Move ${b.name} up`" :disabled="i === 0" @click="store.moveBoard(b.id, -1)"><Icon name="up" :size="16" /></button>
              <button type="button" class="icon-btn" :aria-label="`Move ${b.name} down`" :disabled="i === store.save.boards.length - 1" @click="store.moveBoard(b.id, 1)"><Icon name="down" :size="16" /></button>
              <button type="button" class="icon-btn" :aria-label="`Duplicate ${b.name}`" @click="store.duplicateBoard(b.id)"><Icon name="copy" :size="16" /></button>
              <button type="button" class="icon-btn danger" :aria-label="`Delete ${b.name}`" @click="removeBoard(b.id, b.name)"><Icon name="trash" :size="16" /></button>
            </span>
          </div>
        </div>
      </section>

      <div class="bottom">
        <section class="card">
          <h3 class="card-title">Download</h3>
          <p class="hint">One .json file with the ticked boards and their teams, areas and notes.</p>
          <button type="button" class="btn primary" :disabled="chosen.length === 0" @click="downloadJson">
            <Icon name="download" />Download {{ chosen.length }} {{ chosen.length === 1 ? 'board' : 'boards' }} (.json)
          </button>
          <button type="button" class="btn" :disabled="chosen.length === 0 || busy" @click="downloadZip">
            {{ busy ? 'Making images…' : 'Download PNGs (.zip)' }}
          </button>
        </section>

        <section
          class="card drop"
          :class="{ over: dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="onDrop"
        >
          <h3 class="card-title">Upload</h3>
          <p class="hint">
            Drop a .json save here, or
            <button type="button" class="link" @click="fileInput?.click()">choose a file</button>.
          </p>
          <input ref="fileInput" type="file" accept=".json,application/json" class="sr-only" data-testid="upload-input" @change="onPick" />
          <fieldset class="modes">
            <legend class="field-label">When it loads</legend>
            <label class="check"><input v-model="mode" type="radio" value="add" />Add its boards to this save</label>
            <label class="check"><input v-model="mode" type="radio" value="replace" />Replace this save</label>
          </fieldset>
          <p v-if="uploadError" class="error" role="alert">{{ uploadError }}</p>
        </section>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.save-dialog {
  width: min(880px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  padding: 0;
  border: 0;
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
}
.save-dialog::backdrop {
  background: rgba(30, 38, 33, 0.6);
}
.inner {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.head h2 {
  margin: 0;
  flex: 1;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
}
.close {
  border: 0;
}
.top,
.bottom {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  align-items: end;
}
.bottom {
  align-items: stretch;
}
.warn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: var(--radius);
  background: var(--warn-bg);
  color: var(--warn-text);
  font-size: 13px;
  line-height: 1.4;
}
.warn svg {
  flex: none;
}
.table {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow-x: auto;
}
.row {
  display: grid;
  grid-template-columns: 40px minmax(140px, 1fr) 60px 150px 130px 168px;
  gap: 8px;
  align-items: center;
  padding: 4px 12px;
  border-top: 1px solid var(--border);
  min-width: 640px;
}
.row.header {
  border-top: 0;
  background: var(--bg);
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  padding: 8px 12px;
}
.tick {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.muted {
  color: var(--muted);
  font-size: 13px;
  white-space: nowrap;
}
.link {
  border: 0;
  background: none;
  padding: 0;
  color: var(--accent);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.name .link {
  color: var(--text);
  text-decoration: none;
}
.name .link:hover {
  text-decoration: underline;
}
.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}
.icon-btn {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  border-radius: 6px;
  color: var(--muted);
}
.icon-btn:hover:not(:disabled) {
  background: var(--seg);
}
.icon-btn.danger {
  color: var(--danger);
}
.card-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.drop {
  border-style: dashed;
  border-color: #b9c0b7;
  background: #fafbf9;
}
.drop.over {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.modes {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.modes legend {
  padding-bottom: 4px;
}
.error {
  margin: 0;
  color: var(--danger);
  font-size: 13px;
  font-weight: 500;
}
</style>
