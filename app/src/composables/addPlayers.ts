import { ref } from 'vue';

/** Whether the "Add players" window is open. */
const open = ref(false);
/** Called with the first player added, e.g. to put them in the spot that opened the window. */
let onFirst: ((memberId: string) => void) | null = null;

export function useAddPlayers() {
  function openAddPlayers(first?: (memberId: string) => void): void {
    onFirst = first ?? null;
    open.value = true;
  }
  function closeAddPlayers(): void {
    open.value = false;
    onFirst = null;
  }
  /** Tells whoever opened the window about the first player added, once. */
  function added(memberId: string): void {
    const cb = onFirst;
    onFirst = null;
    cb?.(memberId);
  }
  return { open, openAddPlayers, closeAddPlayers, added };
}
