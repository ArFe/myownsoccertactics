import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { cloneBoardWithNewIds, createBoard, deepCopy, newId, nowIso, playersInFormation } from '@/model/factory';
import { PRESET_SIZES, clampSize, createField } from '@/model/field';
import { DEFAULT_FORMATIONS, getFormation } from '@/model/formations';
import { clampToField, round, scaleBoardContents, tidy } from '@/model/geometry';
import { createHistory } from '@/model/history';
import { loadFromStorage, writeToStorage } from '@/model/persistence';
import type {
  Area,
  Arrow,
  ArrowKind,
  Board,
  Cone,
  FieldPreset,
  FieldSettings,
  Markings,
  Player,
  SaveFile,
  Team,
  TeamSide,
  TextNote,
} from '@/model/types';

export type Tool = 'select' | 'rect' | 'ellipse' | 'polygon' | 'arrow' | 'text' | 'cone' | 'ball';
export type SelectionKind = 'player' | 'area' | 'arrow' | 'text' | 'cone' | 'ball';
export interface Selection {
  kind: SelectionKind;
  id: string;
}
export type ImportMode = 'add' | 'replace';

export const AREA_COLORS = ['#FACC15', '#EF4444', '#3B82F6', '#22C55E', '#A855F7', '#FFFFFF', '#111827'];
export const ARROW_COLORS: Record<ArrowKind, string> = { pass: '#FFFFFF', run: '#FDE047' };

const AUTOSAVE_DELAY_MS = 400;

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

/** What undo/redo tracks: everything except which board is open. */
function snapshotOf(save: SaveFile): string {
  return JSON.stringify({ name: save.name, boards: save.boards });
}

export const useSaveStore = defineStore('save', () => {
  const loaded = loadFromStorage(storage());
  const save = ref<SaveFile>(loaded.save);
  const notice = ref<string | null>(loaded.warning ?? null);
  const selection = ref<Selection | null>(null);
  const tool = ref<Tool>('select');
  const arrowKind = ref<ArrowKind>('pass');
  const lastSavedAt = ref<Date | null>(null);
  const storageFailed = ref(false);

  const history = createHistory(snapshotOf(save.value));
  const canUndo = ref(false);
  const canRedo = ref(false);

  const board = computed<Board>(
    () => save.value.boards.find((b) => b.id === save.value.activeBoardId) ?? save.value.boards[0]!,
  );

  function syncHistoryFlags(): void {
    canUndo.value = history.canUndo();
    canRedo.value = history.canRedo();
  }

  /** Records an undo step. Call after every change to the save. */
  function commit(mergeKey?: string): void {
    save.value.updatedAt = nowIso();
    history.record(snapshotOf(save.value), mergeKey);
    syncHistoryFlags();
  }

  function changeBoard(fn: (b: Board) => void, mergeKey?: string): void {
    const b = board.value;
    fn(b);
    b.updatedAt = nowIso();
    commit(mergeKey);
  }

  function applySnapshot(snapshot: string): void {
    const data = JSON.parse(snapshot) as Pick<SaveFile, 'name' | 'boards'>;
    save.value.name = data.name;
    save.value.boards = data.boards;
    if (!data.boards.some((b) => b.id === save.value.activeBoardId)) {
      save.value.activeBoardId = data.boards[0]!.id;
    }
    if (selection.value && !findSelected()) selection.value = null;
    syncHistoryFlags();
  }

  function undo(): void {
    const snap = history.undo();
    if (snap) applySnapshot(snap);
  }

  function redo(): void {
    const snap = history.redo();
    if (snap) applySnapshot(snap);
  }

  // ----- autosave -----
  let timer: ReturnType<typeof setTimeout> | undefined;
  function saveNow(): void {
    clearTimeout(timer);
    const ok = writeToStorage(storage(), save.value);
    storageFailed.value = !ok;
    if (ok) lastSavedAt.value = new Date();
  }
  watch(
    save,
    () => {
      clearTimeout(timer);
      timer = setTimeout(saveNow, AUTOSAVE_DELAY_MS);
    },
    { deep: true },
  );

  // ----- save file and boards -----
  function renameSave(name: string): void {
    save.value.name = name;
    commit('save-name');
  }

  function setActiveBoard(id: string): void {
    if (!save.value.boards.some((b) => b.id === id)) return;
    save.value.activeBoardId = id;
    selection.value = null;
  }

  function addBoard(preset: Exclude<FieldPreset, 'custom'>): string {
    const b = createBoard(preset, `Board ${save.value.boards.length + 1}`);
    save.value.boards.push(b);
    save.value.activeBoardId = b.id;
    selection.value = null;
    commit();
    return b.id;
  }

  function duplicateBoard(id: string): string | null {
    const i = save.value.boards.findIndex((b) => b.id === id);
    if (i < 0) return null;
    const copy = cloneBoardWithNewIds(save.value.boards[i]!, `${save.value.boards[i]!.name} (copy)`);
    save.value.boards.splice(i + 1, 0, copy);
    save.value.activeBoardId = copy.id;
    selection.value = null;
    commit();
    return copy.id;
  }

  /** A save always keeps at least one board. Returns false if refused. */
  function deleteBoard(id: string): boolean {
    if (save.value.boards.length <= 1) return false;
    const i = save.value.boards.findIndex((b) => b.id === id);
    if (i < 0) return false;
    save.value.boards.splice(i, 1);
    if (save.value.activeBoardId === id) {
      save.value.activeBoardId = save.value.boards[Math.max(0, i - 1)]!.id;
      selection.value = null;
    }
    commit();
    return true;
  }

  function moveBoard(id: string, delta: -1 | 1): void {
    const list = save.value.boards;
    const i = list.findIndex((b) => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    commit();
  }

  function renameBoard(name: string): void {
    changeBoard((b) => (b.name = name), `board-name-${board.value.id}`);
  }

  function importSave(incoming: SaveFile, mode: ImportMode): number {
    if (mode === 'replace') {
      save.value = deepCopy(incoming);
    } else {
      const added = incoming.boards.map((b) => cloneBoardWithNewIds(b));
      save.value.boards.push(...added);
      save.value.activeBoardId = added[0]!.id;
    }
    selection.value = null;
    commit();
    return incoming.boards.length;
  }

  // ----- field -----
  function setPreset(preset: Exclude<FieldPreset, 'custom'>): void {
    changeBoard((b) => {
      const size = PRESET_SIZES[preset];
      const teamSize = preset === '7v7' ? 7 : 11;
      const fresh = createField(preset);
      const keep = { orientation: b.field.orientation, grassColor: b.field.grassColor, lineColor: b.field.lineColor };
      scaleBoardContents(b, size.length / b.field.length, size.width / b.field.width);
      b.field = { ...fresh, ...keep };
      // Moving between 11v11 and 7v7 changes the team size: use that size's
      // default formations and keep names in order.
      for (const side of ['home', 'away'] as const) {
        if (b.players.filter((p) => p.team === side).length !== teamSize) {
          const formation = DEFAULT_FORMATIONS[teamSize][side];
          b.teams[side].formation = formation;
          const prev = b.players.filter((p) => p.team === side);
          const next = playersInFormation(side, formation, b.field, prev);
          b.players = [...b.players.filter((p) => p.team !== side), ...next];
        }
      }
    });
  }

  function setFieldSize(length: number, width: number): void {
    const L = clampSize(length);
    const W = clampSize(width);
    changeBoard((b) => {
      if (L === b.field.length && W === b.field.width) return;
      scaleBoardContents(b, L / b.field.length, W / b.field.width);
      b.field.length = L;
      b.field.width = W;
      b.field.preset = 'custom';
    }, `field-size-${board.value.id}`);
  }

  function updateField(patch: Partial<Pick<FieldSettings, 'orientation' | 'grassColor' | 'lineColor'>>): void {
    changeBoard((b) => Object.assign(b.field, patch), `field-${Object.keys(patch).join()}`);
  }

  function setMarking(key: keyof Markings, on: boolean): void {
    changeBoard((b) => (b.field.markings[key] = on));
  }

  // ----- teams and players -----
  function updateTeam(side: TeamSide, patch: Partial<Omit<Team, 'formation'>>): void {
    changeBoard((b) => Object.assign(b.teams[side], patch), `team-${side}-${Object.keys(patch).join()}`);
  }

  function setNamesVisible(on: boolean): void {
    changeBoard((b) => {
      b.teams.home.showNames = on;
      b.teams.away.showNames = on;
    });
  }

  function applyFormation(side: TeamSide, name: string): void {
    if (!getFormation(name)) return;
    changeBoard((b) => {
      const prev = b.players.filter((p) => p.team === side);
      const next = playersInFormation(side, name, b.field, prev);
      b.players = [...b.players.filter((p) => p.team !== side), ...next];
      b.teams[side].formation = name;
    });
    if (selection.value?.kind === 'player' && !findSelected()) selection.value = null;
  }

  function updatePlayer(id: string, patch: Partial<Pick<Player, 'name' | 'number'>>): void {
    changeBoard((b) => {
      const p = b.players.find((x) => x.id === id);
      if (p) Object.assign(p, patch);
    }, `player-${id}-${Object.keys(patch).join()}`);
  }

  function place(b: Board, x: number, y: number, snap: boolean): { x: number; y: number } {
    const c = clampToField(b.field, x, y);
    return snap ? { x: round(c.x, 1), y: round(c.y, 1) } : { x: tidy(c.x), y: tidy(c.y) };
  }

  function movePlayer(id: string, x: number, y: number, snap = false): void {
    changeBoard((b) => {
      const p = b.players.find((q) => q.id === id);
      if (p) Object.assign(p, place(b, x, y, snap));
    });
  }

  function moveBall(x: number, y: number, snap = false): void {
    changeBoard((b) => Object.assign(b.ball, place(b, x, y, snap), { visible: true }));
  }

  function setBallVisible(on: boolean): void {
    changeBoard((b) => (b.ball.visible = on));
  }

  // ----- areas -----
  function addArea(input: Pick<Area, 'shape'> & Partial<Pick<Area, 'x' | 'y' | 'w' | 'h' | 'points'>>): string {
    const id = newId('a');
    changeBoard((b) => {
      const n = b.areas.length + 1;
      b.areas.push({
        id,
        name: `Area ${n}`,
        shape: input.shape,
        x: tidy(input.x ?? 0),
        y: tidy(input.y ?? 0),
        w: tidy(input.w ?? 0),
        h: tidy(input.h ?? 0),
        points: (input.points ?? []).map(tidy),
        color: AREA_COLORS[(n - 1) % 5]!,
        opacity: 0.25,
        border: 'solid',
        label: 'top-left',
        note: '',
      });
    });
    selection.value = { kind: 'area', id };
    return id;
  }

  function updateArea(id: string, patch: Partial<Omit<Area, 'id'>>, mergeKey?: string): void {
    changeBoard((b) => {
      const a = b.areas.find((x) => x.id === id);
      if (!a) return;
      Object.assign(a, patch);
      if (patch.points) a.points = patch.points.map(tidy);
      for (const k of ['x', 'y', 'w', 'h'] as const) a[k] = tidy(k === 'w' || k === 'h' ? Math.max(0.5, a[k]) : a[k]);
    }, mergeKey);
  }

  function moveAreaBy(id: string, dx: number, dy: number): void {
    const a = board.value.areas.find((x) => x.id === id);
    if (!a) return;
    updateArea(id, { x: a.x + dx, y: a.y + dy, points: a.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) });
  }

  function duplicateArea(id: string): void {
    const a = board.value.areas.find((x) => x.id === id);
    if (!a) return;
    const copy: Area = { ...deepCopy(a), id: newId('a'), name: `${a.name} (copy)` };
    copy.x += 2;
    copy.y += 2;
    copy.points = copy.points.map((v) => v + 2);
    changeBoard((b) => b.areas.push(copy));
    selection.value = { kind: 'area', id: copy.id };
  }

  function bringAreaToFront(id: string): void {
    changeBoard((b) => {
      const i = b.areas.findIndex((x) => x.id === id);
      if (i >= 0) b.areas.push(...b.areas.splice(i, 1));
    });
  }

  // ----- arrows, text, cones -----
  function addArrow(x1: number, y1: number, x2: number, y2: number, kind: ArrowKind = arrowKind.value): string {
    const id = newId('r');
    changeBoard((b) =>
      b.arrows.push({ id, kind, x1: tidy(x1), y1: tidy(y1), x2: tidy(x2), y2: tidy(y2), color: ARROW_COLORS[kind] }),
    );
    selection.value = { kind: 'arrow', id };
    return id;
  }

  function updateArrow(id: string, patch: Partial<Omit<Arrow, 'id'>>): void {
    changeBoard((b) => {
      const r = b.arrows.find((x) => x.id === id);
      if (!r) return;
      if (patch.kind && patch.kind !== r.kind && r.color === ARROW_COLORS[r.kind] && !patch.color) {
        r.color = ARROW_COLORS[patch.kind];
      }
      Object.assign(r, patch);
      for (const k of ['x1', 'y1', 'x2', 'y2'] as const) r[k] = tidy(r[k]);
    });
  }

  function addText(x: number, y: number): string {
    const id = newId('t');
    changeBoard((b) => b.texts.push({ id, text: 'Note', x: tidy(x), y: tidy(y), color: '#FFFFFF', size: 2.2 }));
    selection.value = { kind: 'text', id };
    return id;
  }

  function updateText(id: string, patch: Partial<Omit<TextNote, 'id'>>): void {
    changeBoard((b) => {
      const t = b.texts.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    }, `text-${id}-${Object.keys(patch).join()}`);
  }

  function addCone(x: number, y: number): string {
    const id = newId('c');
    changeBoard((b) => b.cones.push({ id, x: tidy(x), y: tidy(y), color: '#F97316' }));
    return id;
  }

  function updateCone(id: string, patch: Partial<Omit<Cone, 'id'>>): void {
    changeBoard((b) => {
      const c = b.cones.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    });
  }

  function moveItem(kind: 'text' | 'cone', id: string, x: number, y: number, snap = false): void {
    changeBoard((b) => {
      const item = kind === 'text' ? b.texts.find((t) => t.id === id) : b.cones.find((c) => c.id === id);
      if (item) Object.assign(item, place(b, x, y, snap));
    });
  }

  // ----- selection -----
  function select(sel: Selection | null): void {
    selection.value = sel;
  }

  function findSelected(): Player | Area | Arrow | TextNote | Cone | Board['ball'] | null {
    const s = selection.value;
    if (!s) return null;
    const b = board.value;
    switch (s.kind) {
      case 'player':
        return b.players.find((x) => x.id === s.id) ?? null;
      case 'area':
        return b.areas.find((x) => x.id === s.id) ?? null;
      case 'arrow':
        return b.arrows.find((x) => x.id === s.id) ?? null;
      case 'text':
        return b.texts.find((x) => x.id === s.id) ?? null;
      case 'cone':
        return b.cones.find((x) => x.id === s.id) ?? null;
      case 'ball':
        return b.ball.visible ? b.ball : null;
    }
  }

  /** Deletes the selected item. Players are not deleted; they belong to the formation. */
  function deleteSelected(): void {
    const s = selection.value;
    if (!s || s.kind === 'player') return;
    changeBoard((b) => {
      if (s.kind === 'area') b.areas = b.areas.filter((x) => x.id !== s.id);
      if (s.kind === 'arrow') b.arrows = b.arrows.filter((x) => x.id !== s.id);
      if (s.kind === 'text') b.texts = b.texts.filter((x) => x.id !== s.id);
      if (s.kind === 'cone') b.cones = b.cones.filter((x) => x.id !== s.id);
      if (s.kind === 'ball') b.ball.visible = false;
    });
    selection.value = null;
  }

  function dismissNotice(): void {
    notice.value = null;
  }

  return {
    save,
    board,
    notice,
    selection,
    tool,
    arrowKind,
    lastSavedAt,
    storageFailed,
    canUndo,
    canRedo,
    undo,
    redo,
    saveNow,
    renameSave,
    setActiveBoard,
    addBoard,
    duplicateBoard,
    deleteBoard,
    moveBoard,
    renameBoard,
    importSave,
    setPreset,
    setFieldSize,
    updateField,
    setMarking,
    updateTeam,
    setNamesVisible,
    applyFormation,
    updatePlayer,
    movePlayer,
    moveBall,
    setBallVisible,
    addArea,
    updateArea,
    moveAreaBy,
    duplicateArea,
    bringAreaToFront,
    addArrow,
    updateArrow,
    addText,
    updateText,
    addCone,
    updateCone,
    moveItem,
    select,
    findSelected,
    deleteSelected,
    dismissNotice,
  };
});
