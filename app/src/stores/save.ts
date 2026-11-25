import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { cloneBoardWithNewIds, createBoard, deepCopy, newId, nowIso, playersInFormation } from '@/model/factory';
import { clampSize, createField, presetDef } from '@/model/field';
import { getFormation } from '@/model/formations';
import { getSport } from '@/model/sports';
import { BALL_STYLES, defaultBallColors, type BallStyleId, type SizeId } from '@/model/balls';
import { applyPositions, capturePositions, type PositionTarget } from '@/model/positions';
import type { SportDefinition } from '@/model/sports/types';
import { clampToField, round, scaleBoardContents, tidy } from '@/model/geometry';
import { createHistory } from '@/model/history';
import { MAX_SUBS, MAX_WAVES, createSub, createWave, swapIn, tidySubs } from '@/model/gameDay';
import {
  MAX_SQUAD,
  assignMember,
  cleanPositions,
  createMember,
  fixNumberClashes,
  memberProblem,
  nextFreeNumber,
  numberHolder,
  parseSquadCsv,
  syncMember,
  takenMessage,
  teamOf,
  unlinkMember,
  validNumber,
  type CsvResult,
  type Holder,
} from '@/model/squad';
import {
  MAX_PLAYS,
  MAX_STEPS,
  boardAtStep,
  captureStep,
  clampSeconds,
  createPlay as newPlay,
  drawingIds,
  frameAt,
  type Frame,
} from '@/model/plays';
import { loadFromStorage, writeToStorage } from '@/model/persistence';
import type {
  Area,
  Arrow,
  ArrowKind,
  Board,
  Cone,
  FieldSettings,
  Play,
  PlayStep,
  Player,
  SaveFile,
  SportId,
  SquadMember,
  Sub,
  SubsShown,
  SubWave,
  Team,
  TeamSide,
  TextNote,
} from '@/model/types';
import { CUSTOM_PRESET } from '@/model/types';

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
  return JSON.stringify({ name: save.name, boards: save.boards, savedPositions: save.savedPositions, squad: save.squad });
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
  /** The rules of the open board's sport. */
  const sport = computed<SportDefinition>(() => getSport(board.value.sport));

  // ----- the open play (view state, not saved and not undone) -----
  const openPlayId = ref<string | null>(null);
  const stepIndex = ref(0);
  /** Seconds into the open play while it plays back; null when stopped. */
  const playTime = ref<number | null>(null);

  const openPlay = computed<Play | null>(() => board.value.plays.find((p) => p.id === openPlayId.value) ?? null);
  const openStep = computed<PlayStep | null>(() => openPlay.value?.steps[stepIndex.value] ?? null);

  /** What the field shows: the board, the open step, or a moment of playback. */
  const frameNow = computed<Frame>(() => {
    const play = openPlay.value;
    if (play && playTime.value !== null) return frameAt(board.value, play, playTime.value);
    if (openStep.value) return { board: boardAtStep(board.value, openStep.value), fade: {} };
    return { board: board.value, fade: {} };
  });
  const frame = computed(() => frameNow.value.board);
  const frameFade = computed(() => frameNow.value.fade);

  /** Keeps the open play and step pointing at things that exist. */
  function checkOpenPlay(): void {
    const play = openPlay.value;
    if (!play) {
      openPlayId.value = null;
      stepIndex.value = 0;
      playTime.value = null;
      return;
    }
    stepIndex.value = Math.min(Math.max(0, stepIndex.value), play.steps.length - 1);
  }

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
    playTime.value = null;
    const b = board.value;
    fn(b);
    // A sub whose player left (smaller team, new preset) goes with them.
    tidySubs(b);
    // No two players of a team share a number (a new spot, a loaded set...).
    fixNumberClashes(b);
    b.updatedAt = nowIso();
    commit(mergeKey);
  }

  function applySnapshot(snapshot: string): void {
    const data = JSON.parse(snapshot) as Pick<SaveFile, 'name' | 'boards' | 'savedPositions' | 'squad'>;
    save.value.name = data.name;
    save.value.boards = data.boards;
    save.value.savedPositions = data.savedPositions;
    save.value.squad = data.squad;
    if (!data.boards.some((b) => b.id === save.value.activeBoardId)) {
      save.value.activeBoardId = data.boards[0]!.id;
    }
    if (selection.value && !findSelected()) selection.value = null;
    checkOpenPlay();
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

  /**
   * Opens a board of the given sport (from the page address, e.g. `/soccer`):
   * the open board if it is one, else the first one, else a new one with the
   * sport's default settings.
   */
  function openSport(id: SportId): void {
    if (board.value.sport === id) return;
    const existing = save.value.boards.find((b) => b.sport === id);
    if (existing) {
      setActiveBoard(existing.id);
      return;
    }
    const b = createBoard(id, undefined, `Board ${save.value.boards.length + 1}`);
    save.value.boards.push(b);
    save.value.activeBoardId = b.id;
    selection.value = null;
    commit();
  }
  // Another board has its own plays.
  watch(
    () => save.value.activeBoardId,
    () => {
      openPlayId.value = null;
      checkOpenPlay();
    },
  );

  /** Adds a board of the open board's sport, with the given preset. */
  function addBoard(presetId: string): string {
    const b = createBoard(board.value.sport, presetId, `Board ${save.value.boards.length + 1}`);
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
      // Saved positions come along; uploading the same file twice does not repeat them.
      const have = new Set(save.value.savedPositions.map((s) => s.id));
      save.value.savedPositions.push(...deepCopy(incoming.savedPositions.filter((s) => !have.has(s.id))));
      // Squad members come along unless their id or number is here already.
      const squad = save.value.squad;
      for (const m of incoming.squad) {
        if (squad.length >= MAX_SQUAD || squad.some((x) => x.id === m.id || x.number === m.number)) continue;
        squad.push(deepCopy(m));
      }
      const ids = new Set(squad.map((m) => m.id));
      for (const b of added) {
        for (const h of [...b.players, ...b.subs]) {
          // A link to a member who did not come, or to one who is here under another number, goes.
          const m = h.memberId ? squad.find((x) => x.id === h.memberId) : undefined;
          if (h.memberId && (!ids.has(h.memberId) || m?.number !== h.number)) delete h.memberId;
        }
      }
    }
    selection.value = null;
    commit();
    return incoming.boards.length;
  }

  // ----- saved starting positions -----
  /** Saved sets of the open board's sport, newest first. */
  const positionSets = computed(() =>
    save.value.savedPositions.filter((s) => s.sport === board.value.sport).slice().reverse(),
  );

  function savePositions(name: string, sides: TeamSide[], withBall = true): string | null {
    const clean = name.trim();
    if (!clean || sides.length === 0) return null;
    // What the field shows, so a step's places can be saved too.
    const set = capturePositions(frame.value, sides, clean, withBall);
    save.value.savedPositions.push(set);
    commit();
    return set.id;
  }

  function loadPositions(
    setId: string,
    targets: PositionTarget[],
    options: { withNames: boolean; withBall: boolean } = { withNames: false, withBall: true },
  ): void {
    const set = save.value.savedPositions.find((s) => s.id === setId);
    if (!set || set.sport !== board.value.sport) return;
    changePositions((b) => applyPositions(b, set, targets, { ...options, runoff: sport.value.runoff(b.field) }));
    if (selection.value?.kind === 'player' && !findSelected()) selection.value = null;
  }

  function renamePositions(setId: string, name: string): void {
    const set = save.value.savedPositions.find((s) => s.id === setId);
    if (!set || !name.trim()) return;
    set.name = name;
    commit(`positions-name-${setId}`);
  }

  function deletePositions(setId: string): void {
    const before = save.value.savedPositions.length;
    save.value.savedPositions = save.value.savedPositions.filter((s) => s.id !== setId);
    if (save.value.savedPositions.length !== before) commit();
  }

  // ----- field -----
  function setPreset(presetId: string): void {
    const s = sport.value;
    const preset = presetDef(s, presetId);
    if (!preset) return;
    changeBoard((b) => {
      const fresh = createField(s, preset.id);
      const keep = { orientation: b.field.orientation, surfaceColor: b.field.surfaceColor, lineColor: b.field.lineColor };
      scaleBoardContents(b, preset.length / b.field.length, preset.width / b.field.width);
      b.field = { ...fresh, ...keep };
      // A preset with another team size (11v11 to 7v7) gets that preset's
      // default formations; names are kept in order.
      for (const side of ['home', 'away'] as const) {
        if (b.players.filter((p) => p.team === side).length !== preset.teamSize) {
          const formation = preset.defaultFormations[side];
          b.teams[side].formation = formation;
          const prev = b.players.filter((p) => p.team === side);
          const next = playersInFormation(s, side, formation, b.field, prev);
          b.players = [...b.players.filter((p) => p.team !== side), ...next];
        }
      }
    });
  }

  function setFieldSize(length: number, width: number): void {
    const L = clampSize(sport.value, length);
    const W = clampSize(sport.value, width);
    changeBoard((b) => {
      if (L === b.field.length && W === b.field.width) return;
      scaleBoardContents(b, L / b.field.length, W / b.field.width);
      b.field.length = L;
      b.field.width = W;
      b.field.preset = CUSTOM_PRESET;
    }, `field-size-${board.value.id}`);
  }

  function updateField(patch: Partial<Pick<FieldSettings, 'orientation' | 'surfaceColor' | 'lineColor'>>): void {
    changeBoard((b) => Object.assign(b.field, patch), `field-${Object.keys(patch).join()}`);
  }

  function setMarking(key: string, on: boolean): void {
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
    const s = sport.value;
    if (!getFormation(s, name)) return;
    changePositions((b) => {
      const prev = b.players.filter((p) => p.team === side);
      const next = playersInFormation(s, side, name, b.field, prev);
      b.players = [...b.players.filter((p) => p.team !== side), ...next];
      b.teams[side].formation = name;
    });
    if (selection.value?.kind === 'player' && !findSelected()) selection.value = null;
  }

  /**
   * Changes a player's number or name. A squad member's change goes to the
   * squad, so every board shows it. Returns why it was refused, or null.
   */
  function updatePlayer(id: string, patch: Partial<Pick<Player, 'name' | 'number'>>): string | null {
    const p = board.value.players.find((x) => x.id === id);
    if (!p) return null;
    return updateHolder(p, patch, `player-${id}-${Object.keys(patch).join()}`);
  }

  function updateHolder(h: Holder, patch: { name?: string; number?: number }, key: string): string | null {
    if (h.memberId) return updateMember(h.memberId, patch);
    if (patch.number !== undefined) {
      if (!validNumber(patch.number)) return 'A number is a whole number from 0 to 999.';
      const team = teamOf(board.value, h);
      const other = team && numberHolder(board.value, team, patch.number, h);
      if (other) return takenMessage(patch.number, other);
    }
    changeBoard(() => Object.assign(h, patch), key);
    return null;
  }

  // ----- squad -----
  function changeSquad(fn: () => void, mergeKey?: string): void {
    playTime.value = null;
    fn();
    commit(mergeKey);
  }

  /** The lowest number no one in the squad has. */
  const nextSquadNumber = computed(() => nextFreeNumber(save.value.squad.map((m) => m.number)));

  function addMember(input: { number: number; name: string; positions?: string[] }): { id: string } | { error: string } {
    if (save.value.squad.length >= MAX_SQUAD) return { error: `The squad is full (${MAX_SQUAD} players).` };
    const problem = memberProblem(save.value.squad, input);
    if (problem) return { error: problem };
    const m = createMember(input);
    changeSquad(() => save.value.squad.push(m));
    return { id: m.id };
  }

  /** Returns why it was refused (a taken number), or null. */
  function updateMember(id: string, patch: Partial<Omit<SquadMember, 'id'>>): string | null {
    const m = save.value.squad.find((x) => x.id === id);
    if (!m) return null;
    if (patch.number !== undefined) {
      const problem = memberProblem(save.value.squad, { number: patch.number, name: m.name }, id);
      if (problem) return problem;
    }
    changeSquad(() => {
      if (patch.number !== undefined) m.number = patch.number;
      if (patch.name !== undefined) m.name = patch.name.slice(0, 40);
      if (patch.positions) m.positions = cleanPositions(patch.positions);
      syncMember(save.value.boards, m);
    }, `member-${id}-${Object.keys(patch).join()}`);
    return null;
  }

  /** Spots and subs who were this member keep the number and name. */
  function deleteMember(id: string): void {
    changeSquad(() => {
      save.value.squad = save.value.squad.filter((m) => m.id !== id);
      unlinkMember(save.value.boards, id);
    });
  }

  function importSquadCsv(text: string): CsvResult {
    const result = parseSquadCsv(text, save.value.squad);
    if (result.members.length) changeSquad(() => save.value.squad.push(...result.members));
    return result;
  }

  /** Puts a squad member in a field spot or a sub, on the open board; null takes them out. */
  function assignMemberTo(kind: 'player' | 'sub', itemId: string, memberId: string | null): void {
    const member = memberId ? save.value.squad.find((m) => m.id === memberId) : null;
    if (memberId && !member) return;
    changeBoard((b) => {
      const item = kind === 'player' ? b.players.find((p) => p.id === itemId) : b.subs.find((s) => s.id === itemId);
      if (item) assignMember(b, item, member ?? null);
    });
  }

  function place(b: Board, x: number, y: number, snap: boolean): { x: number; y: number } {
    const c = clampToField(b.field, getSport(b.sport).runoff(b.field), x, y);
    return snap ? { x: round(c.x, 1), y: round(c.y, 1) } : { x: tidy(c.x), y: tidy(c.y) };
  }

  /** The open step inside the save (not a copy), or null. */
  function editingStep(): PlayStep | null {
    return openStep.value;
  }

  /**
   * Changes places. With a step open, places go into the step; who is on the
   * team (names, numbers, team size) still belongs to the board.
   */
  function changePositions(fn: (b: Board) => void): void {
    const step = editingStep();
    if (!step) return changeBoard(fn);
    changeBoard((b) => {
      const seen = boardAtStep(b, step);
      fn(seen);
      const base = new Map(b.players.map((p) => [p.id, { x: p.x, y: p.y }]));
      b.players = seen.players.map((p) => ({ ...p, ...(base.get(p.id) ?? {}) }));
      b.teams.home.formation = seen.teams.home.formation;
      b.teams.away.formation = seen.teams.away.formation;
      const now = captureStep(seen);
      step.players = now.players;
      step.ball = now.ball;
    });
  }

  function movePlayer(id: string, x: number, y: number, snap = false): void {
    const step = editingStep();
    changeBoard((b) => {
      const p = b.players.find((q) => q.id === id);
      if (!p) return;
      if (step) step.players[id] = place(b, x, y, snap);
      else Object.assign(p, place(b, x, y, snap));
    });
  }

  function moveBall(x: number, y: number, snap = false): void {
    const step = editingStep();
    changeBoard((b) => Object.assign(step ? step.ball : b.ball, place(b, x, y, snap), { visible: true }));
  }

  function setBallVisible(on: boolean): void {
    const step = editingStep();
    changeBoard((b) => ((step ? step.ball : b.ball).visible = on));
  }

  // ----- plays -----
  function openPlayById(id: string | null): void {
    openPlayId.value = id;
    stepIndex.value = 0;
    playTime.value = null;
    checkOpenPlay();
  }

  /** A new play starts with one step: the field as it is now. */
  function createPlay(name: string): string | null {
    const clean = name.trim();
    if (!clean || board.value.plays.length >= MAX_PLAYS) return null;
    const play = newPlay(frame.value, clean);
    changeBoard((b) => b.plays.push(play));
    openPlayById(play.id);
    return play.id;
  }

  function renamePlay(id: string, name: string): void {
    if (!name.trim()) return;
    changeBoard((b) => {
      const play = b.plays.find((p) => p.id === id);
      if (play) play.name = name.trim();
    });
  }

  function deletePlay(id: string): void {
    if (!board.value.plays.some((p) => p.id === id)) return;
    changeBoard((b) => (b.plays = b.plays.filter((p) => p.id !== id)));
    checkOpenPlay();
  }

  function selectStep(i: number): void {
    playTime.value = null;
    stepIndex.value = i;
    checkOpenPlay();
  }

  /** Adds a step after the open one, starting as a copy of it, and opens it. */
  function addStep(): void {
    const play = openPlay.value;
    const step = openStep.value;
    if (!play || !step || play.steps.length >= MAX_STEPS) return;
    const copy = captureStep(boardAtStep(board.value, step), step.hidden);
    const at = stepIndex.value + 1;
    changeBoard(() => play.steps.splice(at, 0, copy));
    stepIndex.value = at;
  }

  /** A play keeps at least one step. */
  function deleteStep(i: number): void {
    const play = openPlay.value;
    if (!play || play.steps.length <= 1 || !play.steps[i]) return;
    changeBoard(() => play.steps.splice(i, 1));
    checkOpenPlay();
  }

  function setStepDuration(i: number, seconds: number): void {
    const play = openPlay.value;
    const step = play?.steps[i];
    if (!play || !step || !Number.isFinite(seconds)) return;
    changeBoard(() => (step.duration = clampSeconds(seconds)), `step-duration-${step.id}`);
  }

  /** Shows or hides a drawing on one step of the open play. */
  function setDrawingOnStep(drawingId: string, i: number, shown: boolean): void {
    const step = openPlay.value?.steps[i];
    if (!step || !drawingIds(board.value).includes(drawingId)) return;
    const has = !step.hidden.includes(drawingId);
    if (has === shown) return;
    changeBoard(() => {
      step.hidden = shown ? step.hidden.filter((h) => h !== drawingId) : [...step.hidden, drawingId];
    });
  }

  /** Shows a drawing on every step of the open play, or only on one. */
  function setDrawingSteps(drawingId: string, only: number | 'all'): void {
    const play = openPlay.value;
    if (!play || !drawingIds(board.value).includes(drawingId)) return;
    changeBoard(() =>
      play.steps.forEach((step, i) => {
        const hide = only !== 'all' && i !== only;
        step.hidden = step.hidden.filter((h) => h !== drawingId);
        if (hide) step.hidden.push(drawingId);
      }),
    );
  }

  function setPlayTime(t: number | null): void {
    playTime.value = t;
  }

  /** A new style starts with its own default colours. */
  function setBallStyle(style: BallStyleId): void {
    if (!BALL_STYLES[style]) return;
    changeBoard((b) => {
      b.ball.style = style;
      b.ball.colors = defaultBallColors(style);
    });
  }

  function setBallColor(key: string, value: string): void {
    if (!BALL_STYLES[board.value.ball.style].colors.some((c) => c.key === key)) return;
    changeBoard((b) => (b.ball.colors[key] = value), `ball-color-${key}`);
  }

  function setBallSize(size: SizeId): void {
    changeBoard((b) => (b.ball.size = size));
  }

  function setPlayerSize(size: SizeId): void {
    changeBoard((b) => (b.playerSize = size));
  }

  // ----- game day and substitutes -----
  /** Game day shows only our team: the other one is hidden, and shown again after. */
  function setGameDay(on: boolean): void {
    changeBoard((b) => {
      b.gameDay.on = on;
      const other = b.gameDay.team === 'home' ? 'away' : 'home';
      b.teams[b.gameDay.team].visible = true;
      b.teams[other].visible = !on;
    });
  }

  function setGameDayTeam(team: TeamSide): void {
    changeBoard((b) => {
      b.gameDay.team = team;
      if (!b.gameDay.on) return;
      b.teams[team].visible = true;
      b.teams[team === 'home' ? 'away' : 'home'].visible = false;
    });
  }

  function setSubsShown(mode: SubsShown): void {
    changeBoard((b) => (b.gameDay.subsShown = mode));
  }

  function addWave(): string | null {
    if (board.value.waves.length >= MAX_WAVES) return null;
    const wave = createWave(board.value);
    changeBoard((b) => b.waves.push(wave));
    return wave.id;
  }

  function updateWave(id: string, patch: Partial<Omit<SubWave, 'id'>>): void {
    changeBoard((b) => {
      const w = b.waves.find((x) => x.id === id);
      if (!w) return;
      if (patch.color) w.color = patch.color;
      if (patch.minute !== undefined && Number.isFinite(patch.minute)) {
        w.minute = Math.round(Math.min(150, Math.max(0, patch.minute)));
      }
    }, `wave-${id}-${Object.keys(patch).join()}`);
  }

  /** Subs in a deleted wave stay, with no wave. */
  function deleteWave(id: string): void {
    changeBoard((b) => (b.waves = b.waves.filter((w) => w.id !== id)));
  }

  /** A new sub for `replacesId`: a squad member, or a free number with no name. */
  function addSub(replacesId: string, memberId?: string): string | null {
    const player = board.value.players.find((p) => p.id === replacesId);
    if (!player || board.value.subs.length >= MAX_SUBS) return null;
    const member = memberId ? save.value.squad.find((m) => m.id === memberId) : undefined;
    if (memberId && !member) return null;
    const sub = createSub(board.value, player);
    changeBoard((b) => {
      b.subs.push(sub);
      if (member) assignMember(b, sub, member);
    });
    return sub.id;
  }

  /** Returns why a number or name change was refused, or null. */
  function updateSub(id: string, patch: Partial<Omit<Sub, 'id' | 'memberId'>>): string | null {
    const sub = board.value.subs.find((x) => x.id === id);
    if (!sub) return null;
    const { number, name, ...rest } = patch;
    if (number !== undefined || name !== undefined) {
      const who = { ...(number !== undefined ? { number } : {}), ...(name !== undefined ? { name } : {}) };
      const problem = updateHolder(sub, who, `sub-${id}-${Object.keys(who).join()}`);
      if (problem || Object.keys(rest).length === 0) return problem;
    }
    patch = rest;
    changeBoard((b) => {
      const sub = b.subs.find((x) => x.id === id);
      if (!sub) return;
      if (patch.replaces && !b.players.some((p) => p.id === patch.replaces)) return;
      if (patch.waveId && !b.waves.some((w) => w.id === patch.waveId)) return;
      Object.assign(sub, patch);
    }, `sub-${id}-${Object.keys(patch).join()}`);
    return null;
  }

  /** Makes a swap: the sub goes on in the player's spot, the player goes to the bench. */
  function swapSub(id: string): void {
    changeBoard((b) => void swapIn(b, id));
  }

  function deleteSub(id: string): void {
    changeBoard((b) => (b.subs = b.subs.filter((s) => s.id !== id)));
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
        return frame.value.ball.visible ? b.ball : null;
    }
  }

  /** Deletes the selected item. Players are not deleted; they belong to the formation. */
  function deleteSelected(): void {
    const s = selection.value;
    if (!s || s.kind === 'player') return;
    if (s.kind === 'ball') {
      setBallVisible(false);
      selection.value = null;
      return;
    }
    changeBoard((b) => {
      for (const step of b.plays.flatMap((p) => p.steps)) step.hidden = step.hidden.filter((h) => h !== s.id);
      if (s.kind === 'area') b.areas = b.areas.filter((x) => x.id !== s.id);
      if (s.kind === 'arrow') b.arrows = b.arrows.filter((x) => x.id !== s.id);
      if (s.kind === 'text') b.texts = b.texts.filter((x) => x.id !== s.id);
      if (s.kind === 'cone') b.cones = b.cones.filter((x) => x.id !== s.id);
    });
    selection.value = null;
  }

  function dismissNotice(): void {
    notice.value = null;
  }

  return {
    save,
    board,
    sport,
    frame,
    frameFade,
    openPlayId,
    openPlay,
    openStep,
    stepIndex,
    playTime,
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
    openSport,
    addBoard,
    duplicateBoard,
    deleteBoard,
    moveBoard,
    renameBoard,
    importSave,
    positionSets,
    savePositions,
    loadPositions,
    renamePositions,
    deletePositions,
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
    setBallStyle,
    setBallColor,
    setBallSize,
    setPlayerSize,
    setGameDay,
    setGameDayTeam,
    setSubsShown,
    addWave,
    updateWave,
    deleteWave,
    addSub,
    updateSub,
    nextSquadNumber,
    addMember,
    updateMember,
    deleteMember,
    importSquadCsv,
    assignMemberTo,
    deleteSub,
    swapSub,
    openPlayById,
    createPlay,
    renamePlay,
    deletePlay,
    selectStep,
    addStep,
    deleteStep,
    setStepDuration,
    setDrawingOnStep,
    setDrawingSteps,
    setPlayTime,
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
