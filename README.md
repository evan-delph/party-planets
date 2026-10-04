# Party Planets · v0.8

A 3D party game about green alien tourists, playable in the browser with friends. **Four planets, four hand-designed boards with their own gimmicks, 28 minigames, 1 vs 3 and 2 vs 2 team rounds, and online rooms for up to four players.** Boards, the UFO, the aliens and the Nabbit are Blender-built models; terrain uses CC0 scanned textures.

See the [Game Design Document](docs/GDD.md) for the full rules.

## Play

Run the server (below) and open **http://localhost:3000/**. Press any key, click, or press a controller button on the solar-system screen. Pick a planet, open Play, choose rounds, diamond goal and AI difficulty, then launch. Customize your alien in the Character Studio first if you like.

For a standalone solo copy, run `pnpm build:offline` and open the generated **Party Planets - Offline.html** beside the source folder. It embeds the code, 3D models, textures and fonts (about 33 MB) and works without a server; it doesn't support online rooms.

**Controls:** WASD/arrows to move, Space for the primary action, E or Shift for the secondary action. Controllers work too: left stick/D-pad, A, B, and Start/Menu to ready up or pause. Touch screens get on-screen buttons in minigames.

## Online with friends

1. Open **Online party** → **Create a party**. Pick the board and settings.
2. Click **Invite link** (or share the 8-character room code). Friends open the link on the same hosted address and join.
3. The host presses **Start party**. Empty seats become CPUs.

Friends must use the same *hosted* address: `localhost` only works on your own computer. Everything is run by the server: board movement, votes and minigame simulation. During the match you can send quick emotes from the right-hand bar.

If someone disconnects, a CPU takes over their seat after 30 seconds and hands it back when they return. If you close the tab, reopening the game offers **Rejoin party**. Rooms last 24 hours.

## Run and edit

Use Node 22.13 or newer and the pnpm lockfile.

```sh
pnpm install --frozen-lockfile
pnpm db:setup
pnpm dev
```

For a compiled local server, stop the dev server and run `pnpm build` then `pnpm start` (binds http://127.0.0.1:3000). Stop the compiled server before rebuilding on Windows.

```sh
pnpm test              # rules, boards, minigames, migration, room API
pnpm test:online       # four-client room run against a running server
pnpm build:offline     # standalone HTML
npx tsc --noEmit       # type check
```

### Rebuilding the art

The Blender scripts in `art/blender/` regenerate every model and baked texture headlessly (Blender 5.x):

```sh
node scripts/fetch-assets.mjs                       # CC0 texture scans into art/source/
blender -b -P art/blender/board.py -- crown         # also crater, fissure, coral
blender -b -P art/blender/alien.py
blender -b -P art/blender/ufo.py
blender -b -P art/blender/planets.py
blender -b -P art/blender/nabbit.py
```

Board layouts for the Blender scripts come from `node scripts/test-loader.cjs scripts/export-boards.ts` (writes `art/boards/*.json`). Outputs land in `public/models/` and `public/textures/`.

| Change                                        | Main files                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| Prices, items, dice, space info               | `game/config.ts`                                                         |
| Rules, teams, events, gimmicks, saves         | `game/engine.ts`                                                         |
| Board layouts (tile codes), gimmick roads     | `game/boards.ts`                                                         |
| Menus, studio, lobby, HUD                     | `game/Party.tsx`, `game/art.tsx`, `app/skin.css`                         |
| Board scene, tiles, gimmick visuals           | `game/BoardScene.tsx`, `game/BoardTiles.tsx`, `game/BoardGimmicks.ts`    |
| Dice, pop-ups, stomps, steals                 | `game/BoardDirector.ts`                                                  |
| Alien, UFO, finale                            | `game/avatar.ts`, `game/Ufo.ts`, `game/Finale.ts`                        |
| Menu planets                                  | `game/PlanetGlobe.ts`, `game/Planetarium.ts`                             |
| Minigames                                     | `game/arcade/` (catalogs, simulations, renderers, `ArcadeGame.tsx`)      |
| Sound effects                                 | `game/audio.ts`                                                          |
| Online room server                            | `app/api/room/route.ts`                                                  |

Keep game and board IDs stable; old saves migrate through `migrateGame` in `game/engine.ts`. Hosted D1 migrations live in `drizzle/`; local setup uses `scripts/local-schema.sql`. Keep `.openai/hosting.json` when continuing the same hosted Site.

Party Planets is original work: it includes no Nintendo characters, art, audio, maps or code. Third-party textures are CC0 (Poly Haven), listed in `art/assets.json`.
