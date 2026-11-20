/**
 * Undo/redo over snapshots (strings). Changes that share a merge key and come
 * close together, like typing in one field, become a single undo step.
 */
export interface History {
  record(snapshot: string, mergeKey?: string): void;
  undo(): string | null;
  redo(): string | null;
  reset(snapshot: string): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

export function createHistory(initial: string, limit = 100, mergeWindowMs = 1000, now = () => Date.now()): History {
  let past: string[] = [];
  let future: string[] = [];
  let present = initial;
  let lastKey: string | undefined;
  let lastTime = 0;

  return {
    record(snapshot, mergeKey) {
      if (snapshot === present) return;
      const t = now();
      const merge = mergeKey !== undefined && mergeKey === lastKey && t - lastTime < mergeWindowMs && past.length > 0;
      if (!merge) {
        past.push(present);
        if (past.length > limit) past = past.slice(past.length - limit);
      }
      present = snapshot;
      future = [];
      lastKey = mergeKey;
      lastTime = t;
    },
    undo() {
      const prev = past.pop();
      if (prev === undefined) return null;
      future.push(present);
      present = prev;
      lastKey = undefined;
      return present;
    },
    redo() {
      const next = future.pop();
      if (next === undefined) return null;
      past.push(present);
      present = next;
      lastKey = undefined;
      return present;
    },
    reset(snapshot) {
      past = [];
      future = [];
      present = snapshot;
      lastKey = undefined;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
