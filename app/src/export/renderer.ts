import JSZip from 'jszip';
import type { Board } from '@/model/types';
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
