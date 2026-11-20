# My Own Soccer Tactics

Vue 3 + TypeScript + Vite + Pinia + Konva app in `app/`. See README.md.

- Everything runs and is tested locally: `cd app && npm run check`.
- Positions are in metres; only `model/view.ts` knows about pixels.
- All changes to a save go through the store (`stores/save.ts`), so undo and
  autosave see them.
- Changing the save file shape: bump `SAVE_VERSION` and add a step to
  `migrate()` in `model/persistence.ts`, with a test.
- Node 26 (see `.nvmrc`). TypeScript stays on 6: vue-tsc does not support 7
  yet.
- `fsevents` install script is denied in `allowScripts` on purpose: it ships a
  prebuilt binary, so the node-gyp rebuild is not needed.

# Todo

## Phase 2 · saved starting positions
- [ ] Save the current positions of a team (or both) under a name.
- [ ] Load saved positions onto any board; they live in the save file.
- [ ] Save file version 2 with a migration from version 1.

## Phase 3 · movement
- [ ] Record steps (keyframes) of all positions; play them back smoothly.
- [ ] Download as GIF (gifenc) and as video (WebM via MediaRecorder, MP4
      via WebCodecs + mp4-muxer).

## Phase 4 · 3D
- [ ] 3D view of a board (Three.js via TresJS), orbit camera.
- [ ] Player's-eye camera.

## Hosting (personal AWS account)
- [ ] Terraform for S3 + CloudFront + OAC and the state bucket (see
      `infra/README.md`).
- [ ] Manual GitHub Actions deploy with an OIDC role (immutable subject).
- [ ] Custom domain, later.

## Small things seen in Phase 1
- [ ] PNG export has no title; add the board name as an option.
- [ ] Zoom in and out on the field (in the mockup, not built).
- [ ] Long text notes can run off the field edge; wrap them.
