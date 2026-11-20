import JSZip from 'jszip';
import { frameAt, type Frame } from '@/model/plays';
import type { Board, Play } from '@/model/types';
import { FPS, WIDTH, evenSize, frameTimes, makeAnimation, type AnimationFormat } from './animation';
import { downloadBlob, fileSlug, uniqueNames } from './download';

type Renderer = (board: Board) => Promise<Blob>;

let renderer: Renderer | null = null;

/** The hidden export stage registers itself here when it mounts. */
export function registerRenderer(fn: Renderer | null): void {
  renderer = fn;
}

export async function renderBoardPng(board: Board): Promise<Blob> {
  if (!renderer) throw new Error('Image export is not ready yet.');
  return renderer(board);
}

export async function downloadBoardPng(board: Board): Promise<void> {
  const blob = await renderBoardPng(board);
  downloadBlob(blob, `${fileSlug(board.name, 'board')}.png`);
}

export async function downloadBoardsZip(boards: Board[], saveName: string): Promise<void> {
  const zip = new JSZip();
  const names = uniqueNames(boards.map((b) => fileSlug(b.name, 'board')));
  for (const [i, board] of boards.entries()) {
    zip.file(`${names[i]}.png`, await renderBoardPng(board));
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${fileSlug(saveName)}-images.zip`);
}

// ---------- plays as GIF or video ----------

/** A hidden stage kept open while the frames of one play are drawn. */
export interface FrameSession {
  width: number;
  height: number;
  draw(frame: Frame): Promise<HTMLCanvasElement>;
  close(): void;
}

type FrameRenderer = (board: Board, width: number) => Promise<FrameSession>;
let frameRenderer: FrameRenderer | null = null;

export function registerFrameRenderer(fn: FrameRenderer | null): void {
  frameRenderer = fn;
}

export interface PlayFileOptions {
  speed?: number;
  onProgress?(done: number): void;
  isCancelled?(): boolean;
}

/** Makes a GIF or video of a play, frame by frame. */
export async function makePlayFile(
  board: Board,
  play: Play,
  format: AnimationFormat,
  options: PlayFileOptions = {},
): Promise<Blob> {
  if (!frameRenderer) throw new Error('Export is not ready yet.');
  const times = frameTimes(play, FPS[format], options.speed);
  const session = await frameRenderer(board, WIDTH[format]);
  try {
    const canvas = document.createElement('canvas');
    Object.assign(canvas, evenSize(session.width, session.height));
    return await makeAnimation({
      format,
      count: times.length,
      canvas,
      draw: async (i, c) => {
        const image = await session.draw(frameAt(board, play, times[i]!));
        c.getContext('2d')!.drawImage(image, 0, 0, c.width, c.height);
      },
      onProgress: options.onProgress,
      isCancelled: options.isCancelled,
    });
  } finally {
    session.close();
  }
}

export async function downloadPlay(
  board: Board,
  play: Play,
  format: AnimationFormat,
  options: PlayFileOptions = {},
): Promise<void> {
  const blob = await makePlayFile(board, play, format, options);
  downloadBlob(blob, `${fileSlug(board.name, 'board')}-${fileSlug(play.name, 'play')}.${format}`);
}
