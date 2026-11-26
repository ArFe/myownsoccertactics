import { useSaveStore } from '@/stores/save';
import { useToasts } from './toast';

/**
 * Asks before deleting a board. Used by the sidebar and the save dialog.
 * Each sport keeps at least one board; undo brings a deleted one back.
 */
export function useDeleteBoard() {
  const store = useSaveStore();
  const { show } = useToasts();

  function removeBoard(id: string, name: string): void {
    if (store.sportBoards.length <= 1) {
      show('Each sport keeps at least one board.', 'error');
      return;
    }
    const label = name || 'Untitled board';
    if (window.confirm(`Delete the board "${label}"? You can undo this.`)) store.deleteBoard(id);
  }

  return { removeBoard };
}
