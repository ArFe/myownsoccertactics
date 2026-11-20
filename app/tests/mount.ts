import { createApp, nextTick, type Component } from 'vue';
import type { Pinia } from 'pinia';

/** Mounts a component into a fresh div, with the given Pinia. */
export function mount(component: Component, pinia: Pinia) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const app = createApp(component);
  app.use(pinia);
  app.mount(el);
  return {
    el,
    get<T extends Element = HTMLElement>(selector: string): T {
      const found = el.querySelector<T>(selector);
      if (!found) throw new Error(`Not found: ${selector}`);
      return found;
    },
    all<T extends Element = HTMLElement>(selector: string): T[] {
      return [...el.querySelectorAll<T>(selector)];
    },
    unmount() {
      app.unmount();
      el.remove();
    },
  };
}

/** Sets a field's value and fires the events Vue listens to. */
export async function setValue(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await nextTick();
}

export async function click(el: Element) {
  (el as HTMLElement).click();
  await nextTick();
}
