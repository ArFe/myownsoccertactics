# My Own Soccer Tactics

A web app to draw and explain soccer tactics. It runs fully in the browser.

- Fields: 11v11 (105 × 68 m), 7v7 (55 × 36 m) or any custom size.
- Default formations for both sizes. Every colour and name can be changed.
- Mark areas on the field (rectangle, ellipse, polygon), with a name, colour
  and transparency.
- Arrows for passes and runs, text notes, cones and the ball.
- One save holds many boards. It is kept in the browser and can be
  downloaded or uploaded as a `.json` file.
- Download a board as a PNG, or all boards as a zip of PNGs.

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
app/src/model/       plain TypeScript: types, field lines, formations,
                     metre <-> pixel view, undo history, save file reading
app/src/stores/      one Pinia store; every change goes through it
app/src/components/  Vue components; PitchStage draws with Konva
app/src/export/      PNG and zip downloads
app/tests/           unit tests       app/e2e/  browser tests
infra/               AWS hosting plan (not built yet)
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
