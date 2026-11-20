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
- Plays live in `model/plays.ts`. A step stores places by player id, the
  ball, and the ids of drawings it hides. The field always draws
  `store.frame` (the board, the open step, or a moment of playback), and
  moves made with a step open go into that step, not the board.
- Plays download frame by frame (`export/animation.ts`): the hidden export
  stage draws each moment, then gifenc (GIF, 12.5 fps) or Mediabunny
  (WebM/MP4, 30 fps) encodes it. Mediabunny loads when a play is first
  opened (to check which formats work); one the browser cannot make is greyed out.
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
- [x] Record steps (keyframes) of all positions; play them back smoothly.
      Named plays per board; drawings can show on some steps only.
- [x] Download as GIF (gifenc) and as video (WebM and MP4 via WebCodecs +
      Mediabunny, which replaced the deprecated mp4-muxer).

## Phase 4 · 3D
- [ ] 3D view of a board (Three.js via TresJS), orbit camera.
- [ ] Player's-eye camera.

## Game day · substitutes
Both items change the save file shape: one `SAVE_VERSION` bump and one
`migrate()` step in `model/persistence.ts` for the two.
- [ ] **Substitute players per position.** Each player on the field can
      have one or more subs waiting for that spot. Today `Player` (in
      `model/types.ts`) is only on the field; there is no bench.
      - Why: a coach plans who comes on for whom before the game.
      - Likely shape: a `subs` list per player (or a bench list with a
        `replaces` player id). A swap keeps the spot (`x`, `y`, `role`)
        and changes `number` and `name`.
      - To settle: are subs drawn on the board (beside the field, in the
        run-off) or only in a panel? Do saved positions
        (`SavedPositions`) carry the subs too?
- [ ] **A game day board: one team, substitution times per colour.** A
      board kind that shows only our team, ready for the match.
      - Hiding a team already works (`Team.visible`); reuse it, don't add
        a second path.
      - Each substitution wave gets a colour and a time (e.g. blue at
        20', red at 35'). The sub and the player they replace show that
        colour, so the plan reads at a glance.
      - To settle: is "game day" a new board type, or a mode on any board?
        Times as match minutes, or as a live clock during the game?

## Small things seen in Phase 1
- [ ] PNG export has no title; add the board name as an option.
- [ ] Zoom in and out on the field (in the mockup, not built).
- [ ] Long text notes can run off the field edge; wrap them.
