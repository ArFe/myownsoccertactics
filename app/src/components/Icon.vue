<script setup lang="ts">
const PATHS = {
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  upload: 'M12 15V3m-5 5 5-5 5 5M5 21h14',
  download: 'M12 3v12m-5-5 5 5 5-5M5 21h14',
  image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm4 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm12 8-5-5L5 21',
  plus: 'M12 5v14M5 12h14',
  select: 'M4 4l7 17 2.5-7.5L21 11z',
  rect: 'M4 5h16v14H4z',
  ellipse: 'M3 12a9 6.5 0 1 0 18 0a9 6.5 0 1 0-18 0',
  polygon: 'M12 3l9 6.5-3.5 10.5h-11L3 9.5z',
  arrow: 'M5 19L19 5M10 5h9v9',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  cone: 'M9.5 4h5l3.5 14h-12zM4 20h16',
  ball: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z',
  copy: 'M10 8h10v12H10zM16 8V4H4v12h4',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  close: 'M6 6l12 12M18 6 6 18',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  save: 'M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 3v6h8V3M7 21v-7h10v7',
  play: 'M7 4v16l13-8z',
  pause: 'M7 4v16M17 4v16',
  prev: 'M6 5v14M19 5 9 12l10 7z',
  next: 'M18 5v14M5 5l10 7-10 7z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  warn: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
} as Record<string, string>;

withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>
