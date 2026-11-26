# My Own Soccer Tactics

Vue 3 + TypeScript + Vite + Pinia + Konva app in `app/`. See README.md.

- Everything runs and is tested locally: `cd app && npm run check`.
- Positions are in metres; only `model/view.ts` knows about pixels.
- Sport rules live only in `model/sports/<sport>/` (presets, size limits,
  markings, field lines, formations, surface colour) behind the
  `SportDefinition` interface. Everything else reads `getSport(board.sport)`
  or `store.sport`; never hard-code "11v11", a marking key or a formation
  outside that folder.
- Sports so far: soccer and volleyball. A net (volleyball) is a
  `FieldDrawing.nets` entry, post to post: a thick line in 2D, posts and a
  mesh in 3D (`buildNet`). Goals stay for goal-like things.
- Each sport has a route: `/<sport id>` (`/soccer`) opens a board of that
  sport (`model/route.ts`, `openSport()` in the store). `/` and unknown
  addresses land on the default sport and show `/soccer`. On the site, a
  CloudFront function serves `index.html` for any path with no file
  extension (`infra/envs/prod/main.tf`). The sport drop-down in the
  sidebar calls `openSport()`; `main.ts` keeps the address on the open
  board's sport (pushState) and Back switches sport again (popstate).
- Boards are per sport: one save holds them all, but the sidebar and the
  save dialog list only `store.sportBoards` (the open sport's). Each sport
  keeps at least one board, new ones are numbered within the sport, and
  moving a board skips boards of other sports.
- Ball looks live in `model/balls.ts`: shapes drawn in units of the ball's
  radius, with named colour slots; `tests/balls.test.ts` checks each style.
- Adding a sport: write `model/sports/<sport>/`, add its id to `SportId` in
  `model/types.ts` and to `SPORTS` in `model/sports/index.ts`.
  `tests/sports.test.ts` then checks it (presets in limits, formations
  exist and match team sizes, lines inside the run-off). The sport
  drop-down in the sidebar lists it by itself. Still to build then: units shown
  (yards for American football), and sport-only objects like a hoop.
- Plays live in `model/plays.ts`. A step stores places by player id, the
  ball, and the ids of drawings it hides. The field always draws
  `store.frame` (the board, the open step, or a moment of playback), and
  moves made with a step open go into that step, not the board.
- Plays download frame by frame (`export/animation.ts`): the hidden export
  stage draws each moment, then gifenc (GIF, 12.5 fps) or Mediabunny
  (WebM/MP4, 30 fps) encodes it. Mediabunny loads when a play is first
  opened (to check which formats work); one the browser cannot make is greyed out.
- The 3D view is plain Three.js in `three/`, shown by the 2D/3D switch.
  `SceneSync` keeps the scene in step with `store.frame`: objects are built
  again only when they look different, and players and the ball just move,
  so plays run in 3D too. Goal height comes from the sport's drawing
  (`goalHeight`). Players and the ball are drawn 1.5× life size, or they
  vanish on a full field. Editing stays in 2D.
- Poses are 3D only (`model/pose.ts`, save version 9): each player may
  have `arms` (`up`; missing = down) and `lift` (metres off the ground,
  0 to 1.5; missing = 0). Defaults are left out of the file. With a step
  open, `setPlayerPose()` writes the pose into the step's spot, like a
  move; playback blends the height and switches arms half way. `lift` is
  not in `figureKey`, so a jump only moves the figure (`liftY`). The
  board's `numberSpot` (`top`, `shirt`, `off`) applies to every player
  and is picked in the 3D view's bar. A click (not a drag) on a figure
  in 3D selects that player (`SceneSync.pickPlayer`), so the Selection
  panel can edit it there; a yellow ring on the grass marks it.
- Download names go through `stampedName()` in `export/download.ts`
  (`name_YYYY-MM-DD_HH-MM-SS.ext`); use it for any new download.
- Every downloaded PNG, GIF and video names the site (`SITE` in
  `export/watermark.ts`), small and faint in the field's bottom-right
  corner, above any bench. Only the hidden export stage draws it
  (`PitchStage`'s `watermark` prop), so the editor never shows it.
- Game day lives in `model/gameDay.ts`. Subs point at a field player by
  id; `tidySubs()` runs on every board change, so a sub whose player is
  gone (smaller team, new preset) goes too. The bench is drawn by
  `PitchStage` under the field, so PNGs and the zip include it; the 3D
  view does not show subs. A long bench wraps onto more rows (each chip
  keeps at least 1.9 row heights, so names fit), and the field shrinks
  to make room. The "Show subs" switch (none, bench, beside,
  both; save version 7) works with game day on or off; game day only
  hides the other team. Beside a player, each sub is a tag with its
  name (its number if it has none). In game day, a selected player of
  our team lists its subs in the Selection panel; the row (`SubRow.vue`)
  is shared with the Game day card.
- The squad lives in `model/squad.ts` and `save.squad` (save version 10):
  our players, one squad per sport (`member.sport`, `store.sportSquad`),
  numbers unique within a sport. Every field player and sub of our team
  (`gameDay.team`) is a member: `commit()` and loading run
  `ensureSquad()`, which links each spot by number and makes a member with
  no name when there is none (a "blank" member). The other team links to
  no one. A spot keeps a copy of the number and name; `syncMember()`
  updates the copies on every board. A member is their number: typing a
  new number on a spot puts that member there (or a new blank one); a
  name typed on a spot goes to the member. Adding a player with a blank
  member's number fills that member in. Deleting a member who is on a
  board leaves a new blank member with the same number. No two players of
  a team share a number (`fixNumberClashes()`), except one member who is
  a sub for several players: each `Sub` is one plan (player + time), so
  a bench player can have several, never two for the same player, and
  swapping them on drops their other plans (`swapIn()`). Players are
  added in the "Add players" window (`composables/addPlayers.ts`, stays
  open) or from a CSV (`number,name,positions`, positions split by "/").
  `MemberPicker.vue` picks members: for a field spot anyone (they swap),
  for the bench anyone not on the field.
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
- [x] 3D view of a board, orbit camera. Plain Three.js, not TresJS.
- [x] Player's-eye camera: pick a player, free look by dragging.

## Game day · substitutes
Save file version 6. Settled 2026-11-20: subs stay on the board (saved
positions do not carry them); game day is a mode on any board; times are
match minutes; subs show on a bench, beside the player, or both.
- [x] **Substitute players per position.** `board.subs`, each with a
      `replaces` player id and an optional time (`waveId`). One player can
      have several subs.
- [x] **Game day mode: one team, substitution times per colour.** Hides
      the other team with `Team.visible`; each time has a colour and a
      minute; the player coming off gets a ring in that colour.
- [x] **Make a swap.** A button on each sub (`swapIn()`): the spot keeps
      its id, `x`, `y` and `role` and takes the sub's `number` and `name`;
      the player coming off goes to the bench for that spot with no time,
      so a rolling sub can be swapped back. Undo takes a swap back.

## Small things seen in Phase 1
- [x] PNG export has no title; add the board name as an option.
- [x] Zoom in and out on the field (in the mockup, not built).
- [x] Long text notes can run off the field edge; wrap them.
- [x] Every download's name ends with the local date and time, so files
      never overwrite each other.
