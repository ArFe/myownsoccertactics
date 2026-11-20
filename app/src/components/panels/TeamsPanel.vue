<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSaveStore } from '@/stores/save';
import { FORMATIONS } from '@/model/formations';
import type { TeamSide } from '@/model/types';
import { toColorInput } from '@/utils/color';

const store = useSaveStore();
const open = ref<Record<TeamSide, boolean>>({ home: true, away: false });

const SIDES: { side: TeamSide; label: string }[] = [
  { side: 'home', label: 'Home' },
  { side: 'away', label: 'Away' },
];

const groups = [
  { label: '11 players', items: FORMATIONS.filter((f) => f.size === 11) },
  { label: '7 players', items: FORMATIONS.filter((f) => f.size === 7) },
];

const playersBySide = computed(() => ({
  home: store.board.players.filter((p) => p.team === 'home'),
  away: store.board.players.filter((p) => p.team === 'away'),
}));

function direction(side: TeamSide): string {
  const vertical = store.board.field.orientation === 'vertical';
  if (side === 'home') return vertical ? 'attacks up' : 'attacks right';
  return vertical ? 'attacks down' : 'attacks left';
}

function onNumber(id: string, e: Event): void {
  const n = Number((e.target as HTMLInputElement).value);
  if (Number.isInteger(n) && n >= 0 && n <= 999) store.updatePlayer(id, { number: n });
}
</script>

<template>
  <div class="stack teams">
    <section v-for="{ side, label } in SIDES" :key="side" class="card" :data-testid="`team-${side}`">
      <div class="team-head">
        <span class="team-dot" :style="{ background: store.board.teams[side].shirtColor }" />
        <h3 class="section-title">{{ label }} · {{ direction(side) }}</h3>
        <button
          type="button"
          class="btn small"
          :aria-expanded="open[side]"
          :aria-controls="`team-body-${side}`"
          @click="open[side] = !open[side]"
        >
          {{ open[side] ? 'Hide' : 'Edit' }}
        </button>
      </div>

      <p v-if="!open[side]" class="hint">
        {{ store.board.teams[side].name }} · {{ store.board.teams[side].formation }}
        <template v-if="!store.board.teams[side].visible"> · hidden</template>
      </p>

      <div v-else :id="`team-body-${side}`" class="stack body">
        <label class="field-label">
          Team name
          <input
            class="input"
            :value="store.board.teams[side].name"
            @input="store.updateTeam(side, { name: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <div class="grid-2">
          <label class="swatch-btn">
            <span class="swatch" :style="{ background: store.board.teams[side].shirtColor }" />Shirt
            <input
              type="color"
              :aria-label="`${label} shirt colour`"
              :value="toColorInput(store.board.teams[side].shirtColor)"
              @input="store.updateTeam(side, { shirtColor: ($event.target as HTMLInputElement).value })"
            />
          </label>
          <label class="swatch-btn">
            <span class="swatch" :style="{ background: store.board.teams[side].numberColor }" />Number
            <input
              type="color"
              :aria-label="`${label} number colour`"
              :value="toColorInput(store.board.teams[side].numberColor)"
              @input="store.updateTeam(side, { numberColor: ($event.target as HTMLInputElement).value })"
            />
          </label>
        </div>
        <label class="field-label">
          Formation
          <select
            class="select"
            :value="store.board.teams[side].formation"
            @change="store.applyFormation(side, ($event.target as HTMLSelectElement).value)"
          >
            <optgroup v-for="g in groups" :key="g.label" :label="g.label">
              <option v-for="f in g.items" :key="f.name" :value="f.name">{{ f.name }}</option>
            </optgroup>
          </select>
        </label>
        <p class="hint">Picking a formation moves this team's players into it. Names are kept.</p>
        <div class="row-between">
          <label class="check">
            <input
              type="checkbox"
              :checked="store.board.teams[side].visible"
              @change="store.updateTeam(side, { visible: ($event.target as HTMLInputElement).checked })"
            />Show team
          </label>
          <label class="check">
            <input
              type="checkbox"
              :checked="store.board.teams[side].showNames"
              @change="store.updateTeam(side, { showNames: ($event.target as HTMLInputElement).checked })"
            />Show names
          </label>
        </div>
        <div class="players">
          <div class="players-head"><span>No.</span><span>Name</span><span>Role</span></div>
          <div v-for="p in playersBySide[side]" :key="p.id" class="player-row">
            <input
              class="input num"
              type="number"
              min="0"
              max="999"
              :aria-label="`Shirt number, ${p.role}`"
              :value="p.number"
              @input="onNumber(p.id, $event)"
            />
            <input
              class="input"
              :aria-label="`Player name, number ${p.number}`"
              :value="p.name"
              placeholder="Name"
              @input="store.updatePlayer(p.id, { name: ($event.target as HTMLInputElement).value })"
            />
            <span class="role">{{ p.role }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.teams {
  gap: 12px;
}
.team-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.team-head .section-title {
  flex: 1;
}
.team-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);
}
.body {
  gap: 12px;
}
.row-between {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 12px;
}
.players {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.players-head,
.player-row {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr) 40px;
  gap: 8px;
  align-items: center;
}
.players-head {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.player-row .input {
  height: 36px;
}
.num {
  text-align: center;
  font-weight: 600;
  padding: 0 4px;
}
.role {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-align: center;
}
</style>
