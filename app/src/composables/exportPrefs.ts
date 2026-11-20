import { ref, watch } from 'vue';

const KEY = 'myownsoccertactics.pngTitle';

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Whether PNGs get the board name as a title. A choice of this browser, not
 * of the save file, so it is remembered here and not in the save.
 */
const pngTitle = ref(typeof window === 'undefined' ? false : read());
watch(pngTitle, (on) => {
  try {
    window.localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* storage blocked: the choice lasts until reload */
  }
});

export function useExportPrefs() {
  return { pngTitle };
}
