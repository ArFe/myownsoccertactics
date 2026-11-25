# My Own Soccer Tactics

A web app to draw and explain soccer tactics. It runs fully in the browser.

- Fields: 11v11 (105 × 68 m), 7v7 (55 × 36 m) or any custom size.
- Default formations for both sizes. Every colour and name can be changed.
- Volleyball: indoor 6v6 (18 × 9 m, 5-1, 4-2 or 6-2) or beach 2v2
  (16 × 8 m), with the net across the middle in 2D and 3D.
- Switch sport at the top of the sidebar. Each sport has its own address
  (`/soccer`, `/volleyball`); one save holds boards of every sport.
- Mark areas on the field (rectangle, ellipse, polygon), with a name, colour
  and transparency.
- Arrows for passes and runs, text notes, cones and the ball.
- Player size (S, M, L, XL) per board. The ball has its own size and a
  style (soccer, volleyball, basketball, American football), each with its
  own colours.
- One save holds many boards. It is kept in the browser and can be
  downloaded or uploaded as a `.json` file.
- Save the players' places as named starting positions (one team or both),
  and load them onto any board of the same sport. They are kept as fractions
  of the field, so they fit any field size; a home set loaded onto the away
  team is turned around. The ball is saved and loaded with them.
- Game day: show only your team, with its subs on a bench under the field,
  beside the player they replace, or both. Each substitution time has a
  colour and a minute (blue 20', red 35'); the player coming off wears a
  ring in that colour. During the match, the swap button puts a sub on in
  the player's spot and sends the player to the bench.
- Plays: record named moves step by step (players and the ball), then play
  them back smoothly at 0.5×, 1× or 2×. Each step sets how long it takes
  to get there. Areas, arrows, notes and cones can show on some steps only;
  they fade in and out. Download a play as a GIF, WebM or MP4.
- 3D view: switch any board to 3D and turn around it, or see it through a
  player's eyes and look around. Plays run in 3D too.
- Download a board as a PNG, or all boards as a zip of PNGs, with the
  board name as a title if you like. Every download is named with the date
  and time, so nothing is overwritten. Images, GIFs and videos carry a
  small, faint "myowntactics.ca" in the corner.
- Zoom the 2D field from 100% to 300% (buttons, + − 0 keys, or Ctrl/⌘ and
  the wheel). Long notes wrap before the edge of the field.

## Run it locally

Needs Node 24.15+ or 26 (see `.nvmrc`).

```bash
cd app
npm install
npx playwright install chromium   # once, for the browser tests
npm run dev                        # http://localhost:5173
```

## Test it

```bash
cd app
npm run typecheck   # TypeScript, including .vue files
npm test            # unit tests (Vitest)
npm run e2e         # browser tests (Playwright, starts its own dev server)
npm run build       # production build in app/dist
npm run check       # all of the above
```

## How it is built

```
app/src/model/       plain TypeScript: types, metre <-> pixel view,
                     undo history, save file reading and upgrades
app/src/model/sports/  one folder per sport (soccer, volleyball): presets,
                     markings, field lines, formations
app/src/stores/      one Pinia store; every change goes through it
app/src/components/  Vue components; PitchStage draws with Konva
app/src/export/      PNG and zip downloads
app/tests/           unit tests       app/e2e/  browser tests
infra/               AWS hosting (S3 + CloudFront, myowntactics.ca)
```

```
user drags / types ─► store action ─► save (metres) ─► Konva redraws
                           │
                           ├─► undo history
                           └─► localStorage (after 0.4 s)
```

- Everything is stored in metres, never pixels. The 2D view converts.
  The later 3D view can read the same data.
- Save files have a `version`. Older files will be upgraded when they are
  read (see `parseSave` in `app/src/model/persistence.ts`).
