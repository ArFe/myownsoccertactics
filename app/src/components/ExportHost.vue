<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { Board } from '@/model/types';
import { deepCopy } from '@/model/factory';
import { registerFrameRenderer, registerRenderer, type FrameSession, type ImageOptions } from '@/export/renderer';
import { withTitle } from '@/export/title';
import type { Frame } from '@/model/plays';
import PitchStage from './PitchStage.vue';

/** Width of exported images, in pixels (height follows the field). */
const EXPORT_WIDTH = 1600;

interface Job {
  board: Board;
  fade: Frame['fade'];
  width: number;
  key: number;
}
const job = shallowRef<Job | null>(null);
const stage = ref<InstanceType<typeof PitchStage> | null>(null);
let queue: Promise<unknown> = Promise.resolve();
let key = 0;

async function render(board: Board, options: ImageOptions): Promise<Blob> {
  // Konva draws text with whatever font is ready, so wait for web fonts.
  await document.fonts?.ready;
  job.value = { board: deepCopy(board), fade: {}, width: EXPORT_WIDTH, key: ++key };
  await nextTick();
  await nextTick();
  const konvaStage = stage.value?.getStage();
  if (!konvaStage) throw new Error('The image could not be made.');
  konvaStage.draw();
  let image = konvaStage.toCanvas({ pixelRatio: 1 });
  job.value = null;
  if (options.title) image = withTitle(image, board.name);
  return new Promise((resolve, reject) =>
    image.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The image could not be made.'))), 'image/png'),
  );
}

/** Keeps one stage open and redraws it for each frame of a play. */
async function openSession(board: Board, width: number): Promise<Omit<FrameSession, 'close'>> {
  await document.fonts?.ready;
  job.value = { board: deepCopy(board), fade: {}, width, key: ++key };
  await nextTick();
  await nextTick();
  const first = stage.value?.getStage();
  if (!first) throw new Error('The play could not be drawn.');
  return {
    width: first.width(),
    height: first.height(),
    async draw(frame) {
      job.value = { ...job.value!, board: frame.board, fade: frame.fade };
      await nextTick();
      const konvaStage = stage.value?.getStage();
      if (!konvaStage) throw new Error('The play could not be drawn.');
      konvaStage.draw();
      return konvaStage.toCanvas({ pixelRatio: 1 });
    },
  };
}

onMounted(() => {
  registerRenderer((board, options) => {
    const run = queue.then(() => render(board, options));
    queue = run.catch(() => undefined);
    return run;
  });
  // A session holds the stage until it is closed; other exports wait.
  registerFrameRenderer((board, width) => {
    let release!: () => void;
    const closed = new Promise<void>((r) => (release = r));
    const run = queue.then(() => openSession(board, width));
    queue = run.then(
      () => closed,
      () => undefined,
    );
    return run.then(
      (s) => ({
        ...s,
        close: () => {
          job.value = null;
          release();
        },
      }),
      (err) => {
        job.value = null;
        release();
        throw err;
      },
    );
  });
});
onBeforeUnmount(() => {
  registerRenderer(null);
  registerFrameRenderer(null);
});
</script>

<template>
  <div class="export-host" aria-hidden="true">
    <PitchStage
      v-if="job"
      ref="stage"
      :key="job.key"
      :board="job.board"
      :fade="job.fade"
      :width="job.width"
      :max-height="job.width * 1.6"
      :interactive="false"
      watermark
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
