import { createApp } from 'vue';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import App from './App.vue';
import { useSaveStore } from './stores/save';
import './style.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(VueKonva);
app.mount('#app');

// Lets the end-to-end tests read the state. Only in development.
if (import.meta.env.DEV) {
  (window as unknown as { __tactics: unknown }).__tactics = { store: useSaveStore(pinia) };
}
