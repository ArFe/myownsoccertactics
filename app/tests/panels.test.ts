import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import TeamsPanel from '@/components/panels/TeamsPanel.vue';
import FieldPanel from '@/components/panels/FieldPanel.vue';
import SelectionPanel from '@/components/panels/SelectionPanel.vue';
import { useSaveStore } from '@/stores/save';
import { click, mount, setValue } from './mount';

describe('panels', () => {
  let pinia: Pinia;
  let mounted: ReturnType<typeof mount> | undefined;

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });
  afterEach(() => mounted?.unmount());

  it('renames a team and a player from the Teams panel', async () => {
    const store = useSaveStore();
    mounted = mount(TeamsPanel, pinia);
    const home = mounted.get('[data-testid="team-home"]');
    await setValue(home.querySelector<HTMLInputElement>('input.input')!, 'Riverside FC');
    expect(store.board.teams.home.name).toBe('Riverside FC');
    const names = [...home.querySelectorAll<HTMLInputElement>('input[placeholder="Name"]')];
    expect(names).toHaveLength(11);
    await setValue(names[0]!, 'Keller');
    expect(store.board.players[0]!.name).toBe('Keller');
  });

  it('changes formation from the Teams panel', async () => {
    const store = useSaveStore();
    mounted = mount(TeamsPanel, pinia);
    await setValue(mounted.get<HTMLSelectElement>('[data-testid="team-home"] select'), '4-4-2');
    expect(store.board.teams.home.formation).toBe('4-4-2');
  });

  it('switches to 7v7 and sets a custom size from the Field panel', async () => {
    const store = useSaveStore();
    mounted = mount(FieldPanel, pinia);
    await click(mounted.all('button.preset').find((b) => b.textContent!.includes('7v7'))!);
    expect(store.board.field.preset).toBe('7v7');
    const [length] = mounted.all<HTMLInputElement>('input[type="number"]');
    await setValue(length!, '60');
    expect(store.board.field.length).toBe(60);
    expect(store.board.field.preset).toBe('custom');
  });

  it('edits the selected area', async () => {
    const store = useSaveStore();
    store.addArea({ shape: 'rect', x: 10, y: 10, w: 10, h: 10 });
    mounted = mount(SelectionPanel, pinia);
    await setValue(mounted.get<HTMLInputElement>('input.input'), 'Zone 14');
    expect(store.board.areas[0]!.name).toBe('Zone 14');
    await click(mounted.get('button[aria-label="Red"]'));
    expect(store.board.areas[0]!.color).toBe('#EF4444');
    await setValue(mounted.get<HTMLInputElement>('#area-opacity'), '60');
    expect(store.board.areas[0]!.opacity).toBe(0.6);
  });

  it('says when nothing is selected', () => {
    mounted = mount(SelectionPanel, pinia);
    expect(mounted.el.textContent).toContain('Nothing selected');
  });
});
