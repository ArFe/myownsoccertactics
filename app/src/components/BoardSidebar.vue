<script setup lang="ts">
import { useSaveStore, type Tool } from '@/stores/save';
import { presetLabel } from '@/model/field';
import { SPORTS, SPORT_IDS, getSport } from '@/model/sports';
import Icon from './Icon.vue';

const store = useSaveStore();

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'select', label: 'Select', key: 'V' },
  { id: 'rect', label: 'Rectangle', key: 'R' },
  { id: 'ellipse', label: 'Ellipse', key: 'E' },
  { id: 'polygon', label: 'Polygon', key: 'P' },
  { id: 'arrow', label: 'Arrow', key: 'A' },
  { id: 'text', label: 'Text', key: 'T' },
  { id: 'cone', label: 'Cone', key: 'C' },
  { id: 'ball', label: 'Ball', key: 'B' },
];

const HINTS: Partial<Record<Tool, string>> = {
  rect: 'Drag on the field to draw an area.',
  ellipse: 'Drag on the field to draw an area.',
  polygon: 'Click to add corners. Click the first corner, double-click or press Enter to finish. Esc cancels.',
  arrow: 'Drag from start to end.',
  text: 'Click where the note goes.',
  cone: 'Click to place cones. Press V when done.',
  ball: 'Click to put the ball there.',
};
</script>

<template>
  <nav class="sidebar" aria-label="Boards and tools">
    <section class="stack">
      <div class="head">
        <h2 class="section-title">Sport</h2>
      </div>
      <div class="seg" role="group" aria-label="Sport">
        <button
          v-for="id in SPORT_IDS"
          :key="id"
          type="button"
          :aria-pressed="store.board.sport === id"
          @click="store.openSport(id)"
        >
          {{ SPORTS[id].name }}
        </button>
      </div>
    </section>

    <section class="stack">
      <div class="head">
        <h2 class="section-title">Boards in this save</h2>
        <span class="count">{{ store.save.boards.length }}</span>
      </div>
      <ul class="boards">
        <li v-for="b in store.save.boards" :key="b.id">
          <button
            type="button"
            class="board"
            :class="{ active: b.id === store.board.id }"
            :aria-current="b.id === store.board.id ? 'page' : undefined"
            @click="store.setActiveBoard(b.id)"
          >
            <span class="board-name">{{ b.name || 'Untitled board' }}</span>
            <span class="tag">{{ presetLabel(getSport(b.sport), b.field.preset) }}</span>
          </button>
        </li>
      </ul>
      <div class="grid-2">
        <button
          v-for="p in store.sport.presets"
          :key="p.id"
          type="button"
          class="btn small new"
          :aria-label="`New ${p.label} board`"
          @click="store.addBoard(p.id)"
        >
          <Icon name="plus" :size="16" />{{ p.label }}
        </button>
      </div>
    </section>

    <section class="stack">
      <h2 class="section-title">Tools</h2>
      <div class="tools">
        <button
          v-for="t in TOOLS"
          :key="t.id"
          type="button"
          class="tool"
          :aria-pressed="store.tool === t.id"
          :title="`${t.label} (${t.key})`"
          @click="store.tool = t.id"
        >
          <Icon :name="t.id" />
          <span>{{ t.label }}</span>
        </button>
      </div>
      <div v-if="store.tool === 'arrow'" class="seg" role="group" aria-label="Arrow type">
        <button type="button" :aria-pressed="store.arrowKind === 'pass'" @click="store.arrowKind = 'pass'">Pass</button>
        <button type="button" :aria-pressed="store.arrowKind === 'run'" @click="store.arrowKind = 'run'">Run</button>
      </div>
      <p v-if="HINTS[store.tool]" class="hint tool-hint">{{ HINTS[store.tool] }}</p>
    </section>

    <section class="keys">
      <span class="keys-title">Keyboard</span>
      <span>V select · R rect · E ellipse · P polygon · A arrow · T text · C cone · B ball · Del remove · + − 0 zoom · Ctrl+Z undo · Shift while dragging snaps to 1 m</span>
    </section>
  </nav>
</template>

<style scoped>
.sidebar {
  width: 100%;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  background: var(--panel);
  border-right: 1px solid var(--border);
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 6px 4px;
}
.count {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.boards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.board {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: var(--panel);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
}
.board:hover {
  background: #f7f8f6;
}
.board.active {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent-dark);
  font-weight: 600;
}
.board-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  background: var(--seg);
  padding: 2px 6px;
  border-radius: 4px;
}
.new {
  border-style: dashed;
  color: var(--accent);
  font-weight: 600;
}
.tools {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.tool {
  min-height: 44px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  white-space: nowrap;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  font-size: 13px;
  font-weight: 500;
}
.tool[aria-pressed='true'] {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent-dark);
  font-weight: 600;
}
.tool-hint {
  padding: 0 4px;
}
.keys {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 10px;
  background: var(--bg);
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}
.keys-title {
  font-weight: 600;
}
</style>
