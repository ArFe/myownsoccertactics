import { ref } from 'vue';

/** Zoom levels of the 2D field. 1 fits the field to the space. */
export const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3];

/** The next zoom level in or out from `z`. */
export function stepZoom(z: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((s) => s > z + 1e-6) ?? ZOOM_STEPS.at(-1)!;
  return [...ZOOM_STEPS].reverse().find((s) => s < z - 1e-6) ?? ZOOM_STEPS[0]!;
}

/**
 * Where to scroll so the point under `anchor` (pixels from the top-left of
 * the visible part) stays under it when the content grows by `ratio`.
 */
export function anchoredScroll(scroll: number, anchor: number, ratio: number): number {
  return Math.max(0, (scroll + anchor) * ratio - anchor);
}

const zoom = ref(1);
/** A point to keep still on the next zoom, e.g. under the mouse. */
let anchor: { x: number; y: number } | null = null;

export function useFieldZoom() {
  return {
    zoom,
    zoomBy(dir: 1 | -1, at: { x: number; y: number } | null = null): void {
      anchor = at;
      zoom.value = stepZoom(zoom.value, dir);
    },
    resetZoom(): void {
      anchor = null;
      zoom.value = 1;
    },
    takeAnchor(): { x: number; y: number } | null {
      const a = anchor;
      anchor = null;
      return a;
    },
  };
}
