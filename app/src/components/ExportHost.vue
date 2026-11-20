<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { Board } from '@/model/types';
import { deepCopy } from '@/model/factory';
import { registerRenderer } from '@/export/renderer';
import { dataUrlToBlob } from '@/export/download';
import PitchStage from './PitchStage.vue';

/** Width of exported images, in pixels (height follows the field). */
const EXPORT_WIDTH = 1600;

const job = shallowRef<{ board: Board; key: number } | null>(null);
const stage = ref<InstanceType<typeof PitchStage> | null>(null);
let queue: Promise<unknown> = Promise.resolve();
let key = 0;

async function render(board: Board): Promise<Blob> {
  // Konva draws text with whatever font is ready, so wait for web fonts.
  await document.fonts?.ready;
  job.value = { board: deepCopy(board), key: ++key };
  await nextTick();
  await nextTick();
  const konvaStage = stage.value?.getStage();
  if (!konvaStage) throw new Error('The image could not be made.');
  konvaStage.draw();
  const url = konvaStage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 });
  job.value = null;
  return dataUrlToBlob(url);
}

onMounted(() =>
  registerRenderer((board) => {
    const run = queue.then(() => render(board));
    queue = run.catch(() => undefined);
    return run;
  }),
);
onBeforeUnmount(() => registerRenderer(null));
</script>

<template>
  <div class="export-host" aria-hidden="true">
    <PitchStage
      v-if="job"
      ref="stage"
      :key="job.key"
      :board="job.board"
      :width="EXPORT_WIDTH"
      :max-height="EXPORT_WIDTH * 1.6"
      :interactive="false"
    />
  </div>
</template>

<style scoped>
.export-host {
  position: fixed;
  left: -10000px;
  top: 0;
  pointer-events: none;
}
</style>
