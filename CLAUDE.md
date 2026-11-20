# My Own Soccer Tactics

Vue 3 + TypeScript + Vite + Pinia + Konva app in `app/`. See README.md.

- Everything runs and is tested locally: `cd app && npm run check`.
- Positions are in metres; only `model/view.ts` knows about pixels.
- Sport rules live only in `model/sports/<sport>/` (presets, size limits,
  markings, field lines, formations, surface colour) behind the
  `SportDefinition` interface. Everything else reads `getSport(board.sport)`
  or `store.sport`; never hard-code "11v11", a marking key or a formation
  outside that folder.
- Ball looks live in `model/balls.ts`: shapes drawn in units of the ball's
  radius, with named colour slots; `tests/balls.test.ts` checks each style.
- Adding a sport: write `model/sports/<sport>/`, add its id to `SportId` in
  `model/types.ts` and to `SPORTS` in `model/sports/index.ts`.
  `tests/sports.test.ts` then checks it (presets in limits, formations
  exist and match team sizes, lines inside the run-off). Still to build
  then: picking the sport for a new board, units shown (yards for
  American football), and sport-only objects like a net or a hoop.
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
- [x] Save the current positions of a team (or both) under a name.
- [x] Load saved positions onto any board; they live in the save file.
- [x] Save file version 3 with a migration from version 2.
- [x] The ball is saved with a set and turns with the team.

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
