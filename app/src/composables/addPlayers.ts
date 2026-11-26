import { ref } from 'vue';

/** Whether the "Add players" window is open. */
const open = ref(false);
/**
 * Opened for the bench: everyone in the squad is taken, nameless players on
 * the field too, so a new sub never takes over one of them.
 */
const forBench = ref(false);
/** Called with the first player added, e.g. to put them in the spot that opened the window. */
let onFirst: ((memberId: string) => void) | null = null;

export function useAddPlayers() {
  function openAddPlayers(first?: (memberId: string) => void, options: { bench?: boolean } = {}): void {
    onFirst = first ?? null;
    forBench.value = !!options.bench;
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
  return { open, forBench, openAddPlayers, closeAddPlayers, added };
}
