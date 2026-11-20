<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { AREA_COLORS, useSaveStore } from '@/stores/save';
import type { Area, AreaBorder, AreaLabel, Arrow, ArrowKind, Cone, Player, TextNote } from '@/model/types';
import { toColorInput } from '@/utils/color';
import Icon from '../Icon.vue';

const store = useSaveStore();
const nameInput = ref<HTMLInputElement | null>(null);

const item = computed(() => store.findSelected());
const kind = computed(() => (item.value ? store.selection?.kind : undefined));
const area = computed(() => (kind.value === 'area' ? (item.value as Area) : null));
const arrow = computed(() => (kind.value === 'arrow' ? (item.value as Arrow) : null));
const player = computed(() => (kind.value === 'player' ? (item.value as Player) : null));
const note = computed(() => (kind.value === 'text' ? (item.value as TextNote) : null));
const cone = computed(() => (kind.value === 'cone' ? (item.value as Cone) : null));

const SHAPE_LABEL = { rect: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon' } as const;
const COLOR_NAMES = ['Yellow', 'Red', 'Blue', 'Green', 'Purple', 'White', 'Black'];

function val(e: Event): string {
  return (e.target as HTMLInputElement).value;
}

function numVal(e: Event): number | null {
  const n = Number(val(e));
  return Number.isFinite(n) ? n : null;
}

function updateArea(patch: Partial<Area>, key?: string): void {
  if (area.value) store.updateArea(area.value.id, patch, key ? `area-${area.value.id}-${key}` : undefined);
}

function setBox(key: 'x' | 'y' | 'w' | 'h', e: Event): void {
  const n = numVal(e);
  if (n !== null) updateArea({ [key]: n });
}

async function focusName(): Promise<void> {
  await nextTick();
  nameInput.value?.focus();
  nameInput.value?.select();
}
onMounted(() => window.addEventListener('tactics:edit-player', focusName));
onBeforeUnmount(() => window.removeEventListener('tactics:edit-player', focusName));
defineExpose({ focusName });
</script>

<template>
  <div class="stack selection">
    <p v-if="!item" class="hint empty">
      Nothing selected. Click a player, area, arrow, note or cone on the field to edit it here.
    </p>

    <!-- Player -->
    <template v-else-if="player">
      <h3 class="section-title">Player · {{ store.board.teams[player.team].name }}</h3>
      <div class="player-grid">
        <label class="field-label">
          Number
          <input
            class="input"
            type="number"
            min="0"
            max="999"
            :value="player.number"
            @input="(e) => { const n = numVal(e); if (n !== null && Number.isInteger(n)) store.updatePlayer(player!.id, { number: n }); }"
          />
        </label>
        <label class="field-label">
          Name
          <input
            ref="nameInput"
            class="input"
            :value="player.name"
            placeholder="Name"
            @input="store.updatePlayer(player!.id, { name: val($event) })"
          />
        </label>
      </div>
      <p class="hint">Role: {{ player.role || '—' }}. Change the formation in the Teams tab.</p>
    </template>

    <!-- Area -->
    <template v-else-if="area">
      <h3 class="section-title">Area · {{ SHAPE_LABEL[area.shape] }}</h3>
      <label class="field-label">
        Name
        <input class="input" :value="area.name" @input="updateArea({ name: val($event) }, 'name')" />
      </label>
      <div v-if="area.shape !== 'polygon'" class="stack">
        <span class="field-label">Shape</span>
        <div class="seg" role="group" aria-label="Shape">
          <button type="button" :aria-pressed="area.shape === 'rect'" @click="updateArea({ shape: 'rect' })">Rectangle</button>
          <button type="button" :aria-pressed="area.shape === 'ellipse'" @click="updateArea({ shape: 'ellipse' })">Ellipse</button>
        </div>
      </div>
      <div class="stack">
        <span class="field-label">Colour</span>
        <div class="swatches">
          <button
            v-for="(c, i) in AREA_COLORS"
            :key="c"
            type="button"
            class="color"
            :style="{ background: c }"
            :aria-label="COLOR_NAMES[i]"
            :aria-pressed="area.color.toLowerCase() === c.toLowerCase()"
            @click="updateArea({ color: c })"
          />
          <label class="btn small custom">
            Custom…
            <input type="color" aria-label="Custom colour" :value="toColorInput(area.color)" @input="updateArea({ color: val($event) }, 'color')" />
          </label>
        </div>
      </div>
      <div class="stack">
        <div class="row-between">
          <label class="field-label" for="area-opacity">Opacity</label>
          <span class="value">{{ Math.round(area.opacity * 100) }}%</span>
        </div>
        <input
          id="area-opacity"
          class="range"
          type="range"
          min="0"
          max="100"
          :value="Math.round(area.opacity * 100)"
          @input="updateArea({ opacity: Number(val($event)) / 100 }, 'opacity')"
        />
      </div>
      <div class="grid-2">
        <label class="field-label">
          Border
          <select class="select" :value="area.border" @change="updateArea({ border: val($event) as AreaBorder })">
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="none">None</option>
          </select>
        </label>
        <label class="field-label">
          Name on field
          <select class="select" :value="area.label" @change="updateArea({ label: val($event) as AreaLabel })">
            <option value="top-left">Top left</option>
            <option value="centre">Centre</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
      </div>
      <div v-if="area.shape !== 'polygon'" class="stack">
        <span class="field-label">Position and size (metres)</span>
        <div class="box-grid">
          <label v-for="k in (['x', 'y', 'w', 'h'] as const)" :key="k" class="field-label small">
            {{ k.toUpperCase() }}
            <input class="input" type="number" step="0.5" :value="area[k]" @change="setBox(k, $event)" />
          </label>
        </div>
      </div>
      <p v-else class="hint">Drag the white dots on the field to move corners.</p>
      <label class="field-label">
        Note
        <textarea class="textarea" rows="3" :value="area.note" @input="updateArea({ note: val($event) }, 'note')" />
      </label>
      <div class="actions">
        <button type="button" class="btn" @click="store.duplicateArea(area.id)"><Icon name="copy" :size="16" />Duplicate</button>
        <button type="button" class="btn" @click="store.bringAreaToFront(area.id)">Bring to front</button>
        <button type="button" class="btn danger" @click="store.deleteSelected()"><Icon name="trash" :size="16" />Delete</button>
      </div>
    </template>

    <!-- Arrow -->
    <template v-else-if="arrow">
      <h3 class="section-title">Arrow</h3>
      <div class="seg" role="group" aria-label="Arrow type">
        <button
          v-for="k in (['pass', 'run'] as ArrowKind[])"
          :key="k"
          type="button"
          :aria-pressed="arrow.kind === k"
          @click="store.updateArrow(arrow!.id, { kind: k })"
        >
          {{ k === 'pass' ? 'Pass (dashed)' : 'Run (solid)' }}
        </button>
      </div>
      <label class="swatch-btn">
        <span class="swatch" :style="{ background: arrow.color }" />Colour
        <input type="color" aria-label="Arrow colour" :value="toColorInput(arrow.color)" @input="store.updateArrow(arrow!.id, { color: val($event) })" />
      </label>
      <p class="hint">Drag the white dots to move the ends.</p>
      <div class="actions">
        <button type="button" class="btn danger" @click="store.deleteSelected()"><Icon name="trash" :size="16" />Delete</button>
      </div>
    </template>

    <!-- Text -->
    <template v-else-if="note">
      <h3 class="section-title">Text note</h3>
      <label class="field-label">
        Text
        <textarea class="textarea" rows="3" :value="note.text" @input="store.updateText(note!.id, { text: val($event) })" />
      </label>
      <div class="grid-2">
        <label class="field-label">
          Size
          <select class="select" :value="String(note.size)" @change="store.updateText(note!.id, { size: Number(val($event)) })">
            <option value="1.6">Small</option>
            <option value="2.2">Medium</option>
            <option value="3.2">Large</option>
          </select>
        </label>
        <label class="swatch-btn color-pick">
          <span class="swatch" :style="{ background: note.color }" />Colour
          <input type="color" aria-label="Text colour" :value="toColorInput(note.color)" @input="store.updateText(note!.id, { color: val($event) })" />
        </label>
      </div>
      <div class="actions">
        <button type="button" class="btn danger" @click="store.deleteSelected()"><Icon name="trash" :size="16" />Delete</button>
      </div>
    </template>

    <!-- Cone -->
    <template v-else-if="cone">
      <h3 class="section-title">Cone</h3>
      <label class="swatch-btn">
        <span class="swatch" :style="{ background: cone.color }" />Colour
        <input type="color" aria-label="Cone colour" :value="toColorInput(cone.color)" @input="store.updateCone(cone!.id, { color: val($event) })" />
      </label>
      <div class="actions">
        <button type="button" class="btn danger" @click="store.deleteSelected()"><Icon name="trash" :size="16" />Delete</button>
      </div>
    </template>

    <!-- Ball -->
    <template v-else-if="kind === 'ball'">
      <h3 class="section-title">Ball</h3>
      <p class="hint">Drag the ball to move it, or pick the Ball tool and click on the field.</p>
      <div class="actions">
        <button type="button" class="btn danger" @click="store.deleteSelected()">Hide ball</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.selection {
  gap: 14px;
}
.empty {
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
}
.player-grid {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 8px;
}
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.color {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.color[aria-pressed='true'] {
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px var(--text);
}
.custom {
  position: relative;
}
.custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.row-between {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.value {
  font-size: 13px;
  font-weight: 600;
}
.range {
  width: 100%;
  accent-color: var(--accent);
  height: 24px;
}
.box-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.field-label.small {
  font-size: 11px;
}
.box-grid .input {
  height: 36px;
  padding: 0 6px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
