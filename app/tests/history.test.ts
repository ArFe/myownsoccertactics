import { describe, expect, it } from 'vitest';
import { createHistory } from '@/model/history';

describe('history', () => {
  it('undoes and redoes', () => {
    const h = createHistory('a');
    h.record('b');
    h.record('c');
    expect(h.undo()).toBe('b');
    expect(h.undo()).toBe('a');
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe('b');
    expect(h.canRedo()).toBe(true);
  });

  it('drops the redo list after a new change', () => {
    const h = createHistory('a');
    h.record('b');
    h.undo();
    h.record('c');
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toBe('a');
  });

  it('ignores records that change nothing', () => {
    const h = createHistory('a');
    h.record('a');
    expect(h.canUndo()).toBe(false);
  });

  it('merges quick changes with the same key into one step', () => {
    let t = 0;
    const h = createHistory('', 100, 1000, () => t);
    h.record('H', 'name');
    t = 200;
    h.record('He', 'name');
    t = 400;
    h.record('Hey', 'name');
    expect(h.undo()).toBe('');
    t = 5000;
    h.redo();
    h.record('Hey!', 'name');
    t = 7000;
    h.record('Hey!!', 'name');
    expect(h.undo()).toBe('Hey!');
  });

  it('keeps at most the limit', () => {
    const h = createHistory('0', 3);
    for (let i = 1; i <= 10; i++) h.record(String(i));
    let steps = 0;
    while (h.undo() !== null) steps++;
    expect(steps).toBe(3);
  });
});
