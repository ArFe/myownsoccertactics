import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { playLength } from '@/model/plays';
import type { Play } from '@/model/types';

export type AnimationFormat = 'gif' | 'webm' | 'mp4';

export const FORMATS: { id: AnimationFormat; label: string; mime: string }[] = [
  { id: 'gif', label: 'GIF', mime: 'image/gif' },
  { id: 'webm', label: 'WebM', mime: 'video/webm' },
  { id: 'mp4', label: 'MP4', mime: 'video/mp4' },
];

/**
 * GIF frame delays are kept in hundredths of a second, so 12.5 fps (8/100 s)
 * is exact. Videos are smooth at 30 fps.
 */
export const FPS: Record<AnimationFormat, number> = { gif: 12.5, webm: 30, mp4: 30 };
/** Width in pixels; GIFs are smaller, since every frame is stored whole. */
export const WIDTH: Record<AnimationFormat, number> = { gif: 800, webm: 1280, mp4: 1280 };

/**
 * Play times (seconds) of each frame. `speed` 2 plays twice as fast. The
 * last frame is the end of the play, so the video ends on the last step.
 */
export function frameTimes(play: Play, fps: number, speed = 1): number[] {
  const length = playLength(play);
  const count = Math.max(1, Math.ceil((length / speed) * fps));
  return Array.from({ length: count + 1 }, (_, i) => Math.min(length, (i / fps) * speed));
}

/** Video encoders want even sizes. */
export function evenSize(width: number, height: number): { width: number; height: number } {
  return { width: Math.max(2, Math.round(width / 2) * 2), height: Math.max(2, Math.round(height / 2) * 2) };
}

export interface RgbaFrame {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Writes frames into a looping GIF, each with its own 256-colour palette.
 * A frame the same as the one before (a pause on a step) is not stored
 * again; the one before just shows longer.
 */
export function createGifWriter(fps: number): { add(frame: RgbaFrame): void; finish(): Uint8Array } {
  const gif = GIFEncoder();
  const step = 1000 / fps;
  let first = true;
  let pending: { frame: RgbaFrame; delay: number } | null = null;

  const write = (): void => {
    if (!pending) return;
    const { data, width, height } = pending.frame;
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    const delay = Math.round(pending.delay);
    gif.writeFrame(index, width, height, first ? { palette, delay, repeat: 0 } : { palette, delay });
    first = false;
  };

  return {
    add(frame) {
      if (pending && sameFrame(pending.frame, frame)) {
        pending.delay += step;
        return;
      }
      write();
      pending = { frame: { ...frame, data: frame.data.slice() }, delay: step };
    },
    finish() {
      write();
      gif.finish();
      return gif.bytes();
    },
  };
}

function sameFrame(a: RgbaFrame, b: RgbaFrame): boolean {
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) return false;
  // Compare 32 bits at a time.
  const x = new Uint32Array(a.data.buffer, a.data.byteOffset, a.data.length >> 2);
  const y = new Uint32Array(b.data.buffer, b.data.byteOffset, b.data.length >> 2);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

/** Whether this browser can make a format. GIF works everywhere. */
export async function canMake(format: AnimationFormat): Promise<boolean> {
  if (format === 'gif') return true;
  if (typeof VideoEncoder === 'undefined') return false;
  const { canEncodeVideo } = await import('mediabunny');
  const size = { width: 1280, height: 720 };
  if (format === 'mp4') return canEncodeVideo('avc', size);
  return (await canEncodeVideo('vp9', size)) || (await canEncodeVideo('vp8', size));
}

export class Cancelled extends Error {
  constructor() {
    super('Cancelled.');
  }
}

export interface MakeOptions {
  format: AnimationFormat;
  /** Number of frames to make. */
  count: number;
  /** Draws frame `i` onto `canvas`. */
  draw(i: number, canvas: HTMLCanvasElement): Promise<void>;
  canvas: HTMLCanvasElement;
  onProgress?(done: number): void;
  isCancelled?(): boolean;
}

/** Makes the file, one frame at a time. */
export async function makeAnimation(o: MakeOptions): Promise<Blob> {
  const mime = FORMATS.find((f) => f.id === o.format)!.mime;
  const fps = FPS[o.format];
  const check = (i: number): void => {
    if (o.isCancelled?.()) throw new Cancelled();
    o.onProgress?.(i / o.count);
  };

  if (o.format === 'gif') {
    const writer = createGifWriter(fps);
    const ctx = o.canvas.getContext('2d', { willReadFrequently: true })!;
    for (let i = 0; i < o.count; i++) {
      check(i);
      await o.draw(i, o.canvas);
      const { width, height } = o.canvas;
      writer.add({ data: ctx.getImageData(0, 0, width, height).data, width, height });
    }
    return new Blob([writer.finish() as Uint8Array<ArrayBuffer>], { type: mime });
  }

  // Loaded only when a video is made: it is the biggest part of the app.
  const mb = await import('mediabunny');
  const codec =
    o.format === 'mp4'
      ? 'avc'
      : (await mb.canEncodeVideo('vp9', { width: o.canvas.width, height: o.canvas.height }))
        ? 'vp9'
        : 'vp8';
  const target = new mb.BufferTarget();
  const output = new mb.Output({
    format: o.format === 'mp4' ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(),
    target,
  });
  const source = new mb.CanvasSource(o.canvas, { codec, quality: mb.QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();
  try {
    for (let i = 0; i < o.count; i++) {
      check(i);
      await o.draw(i, o.canvas);
      await source.add(i / fps, 1 / fps);
    }
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  }
  return new Blob([target.buffer!], { type: mime });
}
