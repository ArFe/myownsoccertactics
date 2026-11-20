import { describe, expect, it } from 'vitest';
import { createBoard } from '@/model/factory';
import { HOLD_SECONDS, captureStep, createPlay, playLength } from '@/model/plays';
import { createGifWriter, evenSize, frameTimes } from '@/export/animation';

function twoStepPlay() {
  const board = createBoard('soccer', '11v11', 'Test');
  const play = createPlay(board, 'Run');
  const step = captureStep(board);
  step.duration = 2;
  play.steps.push(step);
  return play;
}

describe('animation frames', () => {
  it('covers the whole play and ends on the last step', () => {
    const play = twoStepPlay();
    const length = playLength(play);
    expect(length).toBeCloseTo(2 * HOLD_SECONDS + 2);
    const times = frameTimes(play, 10);
    expect(times[0]).toBe(0);
    expect(times.at(-1)).toBeCloseTo(length);
    expect(times).toHaveLength(Math.ceil(length * 10) + 1);
    // Twice as fast: half the frames.
    expect(frameTimes(play, 10, 2).length).toBeLessThan(times.length / 2 + 2);
  });

  it('rounds video sizes to even numbers', () => {
    expect(evenSize(1281, 853)).toEqual({ width: 1282, height: 854 });
    expect(evenSize(0, 1)).toEqual({ width: 2, height: 2 });
  });
});

describe('GIF writer', () => {
  it('writes a looping GIF with one image per frame', () => {
    const w = 4;
    const h = 2;
    const writer = createGifWriter(12.5);
    for (const shade of [0, 128, 255]) {
      const data = new Uint8ClampedArray(w * h * 4).fill(shade);
      writer.add({ data, width: w, height: h });
    }
    const bytes = writer.finish();
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('GIF89a')).toBe(true);
    expect(text).toContain('NETSCAPE2.0'); // loops
    // One image descriptor (0x2C) after each graphic control block (0x21 0xF9).
    const controls = [...text.matchAll(/\x21\xF9\x04/g)].length;
    expect(controls).toBe(3);
    // Delay is 8/100 s in each graphic control block.
    const at = text.indexOf('\x21\xF9\x04');
    expect(bytes[at + 4]).toBe(8);
    expect(bytes.at(-1)).toBe(0x3b); // trailer
  });

  it('stores a repeated frame once, shown for longer', () => {
    const writer = createGifWriter(12.5);
    const still = new Uint8ClampedArray(4 * 2 * 4).fill(90);
    for (let i = 0; i < 5; i++) writer.add({ data: still, width: 4, height: 2 });
    writer.add({ data: new Uint8ClampedArray(4 * 2 * 4).fill(200), width: 4, height: 2 });
    const bytes = writer.finish();
    const text = new TextDecoder('latin1').decode(bytes);
    const at = [...text.matchAll(/\x21\xF9\x04/g)].map((m) => m.index!);
    expect(at).toHaveLength(2);
    expect(bytes[at[0]! + 4]).toBe(40); // 5 frames of 8/100 s
    expect(bytes[at[1]! + 4]).toBe(8);
  });
});
