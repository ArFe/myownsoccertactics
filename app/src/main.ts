import { createApp, watch } from 'vue';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import App from './App.vue';
import { useSaveStore } from './stores/save';
import { pathForSport, sportFromPath } from './model/route';
import './style.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(VueKonva);

// `/soccer` lands on a board of that sport. `/` and unknown addresses land
// on the default sport, and the address bar shows its route.
const store = useSaveStore(pinia);
const routeSport = sportFromPath(window.location.pathname);
store.openSport(routeSport);
const routePath = pathForSport(routeSport);
if (window.location.pathname !== routePath) {
  window.history.replaceState(null, '', routePath + window.location.search + window.location.hash);
}

// The address follows the open board's sport (the sport switch, picking a
// board of another sport, undo), and Back and Forward switch sport again.
watch(
  () => store.board.sport,
  (sport) => {
    const path = pathForSport(sport);
    if (window.location.pathname !== path) window.history.pushState(null, '', path + window.location.search);
  },
);
window.addEventListener('popstate', () => store.openSport(sportFromPath(window.location.pathname)));

app.mount('#app');

// Lets the end-to-end tests read the state. Only in development.
if (import.meta.env.DEV) {
  (window as unknown as { __tactics: unknown }).__tactics = { store };
}
