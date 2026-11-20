import { ref } from 'vue';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

const toasts = ref<Toast[]>([]);
let next = 1;

export function useToasts() {
  function show(text: string, kind: Toast['kind'] = 'info', ms = 4000): void {
    const id = next++;
    toasts.value.push({ id, text, kind });
    setTimeout(() => dismiss(id), ms);
  }
  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }
  return { toasts, show, dismiss };
}
