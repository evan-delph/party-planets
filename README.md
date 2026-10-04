# Party Planets · v0.7

An editable 3D party game about green alien tourists: **three planets, nine 138-space boards, and 28 active minigames**. This source includes the latest board transitions, minigame overhaul, selectable board-party minigame pool, UFO start logo, shops, lottery, music, controllers, and online room server.

## Play

Run the server below, then open **http://localhost:3000/** in a modern desktop browser. For a standalone solo copy, run `pnpm build:offline` and open the generated **Party Planets - Offline.html** from the parent folder. Its scripts, styles and UFO artwork are embedded; it does not support online rooms.

Press any key, click, or press a controller button on the solar-system start screen. Select a planet and board, open Play, choose turns, diamond goal and AI difficulty, then launch. Customize a permanently green alien in the Character studio, including Hawaiian shirts. The space menu shows slowly orbiting planets around a glowing sun. Selecting a board zooms in and switches the UI to light mode. During a match, panning and zooming stay on the board; moving characters bring the camera back to follow them. Item shops have a storefront and SHOP sign next to their space.

Diamonds cost 50 points and move to an eligible unoccupied destination after purchase. Every diamond encounter pauses the roll, including passing, landing, and being carried back by a hazard. Choose Buy or Continue; if you cannot afford it, choose Continue. Human decisions do not time out. After the choice, any remaining steps resume. Three minigame choices receive votes after each round; a tied vote picks randomly among the tied leaders. Fork choices appear when the character reaches the fork.

Controllers: use the left stick or D-pad to navigate menus and move in minigames, A to confirm/use the primary action, and B for back/secondary action. Start/Menu readies a minigame, pauses solo play, or leaves the online minigame view while the match continues. Right trigger and right bumper also map to primary and secondary actions. Press a button after connecting so the browser detects the controller.

Event spaces trigger each board's landmark phenomenon, removing up to 20 points per player according to distance. These losses do not enter the bank. Passing a bank deposits up to 5 points; landing claims the whole pot with a hovering coin-bag animation. At the turn limit, the ship lounge awards bonus diamonds for final points, actual money-loss landings and event landings. Tied leaders share awards; an empty landing category awards none. Goal victories include a piña colada, dance, umbrella cocktails for the crew and UFO disco lights.

## Online

The server edition supports four humans, or fewer humans with AI filling open seats at the host's selected difficulty. Rooms, votes, board movement and minigame simulation are authoritative on the server. Create a room, share its eight-character code, then have friends choose Join on the same hosted game address. Internet players must all use the hosted address; localhost is local to each computer. The intended hosted access is invite-only, with invitations managed by Sites separately from in-game room codes.

Leaving through the game releases the seat. If the host leaves the lobby, the next player becomes host. Leaving a running match turns that seat into a CPU. Temporary connection failures retry with a delay; requests time out instead of freezing controls. Keep a tab open if you intend to reconnect: abruptly closing a browser does not explicitly leave the room. Rooms expire after 24 hours.

## Run and edit

Use Node 22.13 or newer and the existing pnpm lockfile.

```sh
pnpm install --frozen-lockfile
pnpm db:setup
pnpm dev
```

Keep the terminal running while playing. The database setup is safe to repeat and does not erase existing local rooms. For a compiled local server, stop the dev server and run:

```sh
pnpm build
pnpm start
```

Additional commands:

```sh
pnpm build:offline
pnpm test
pnpm test:performance
pnpm test:online
```

The dev server runs at http://localhost:3000; the compiled server binds http://127.0.0.1:3000. Stop the compiled server before rebuilding on Windows to release output files. The online test needs a running server and creates temporary test rooms; set `PARTY_ORIGIN` to test another address. It covers four-player rooms, turns, voting, authoritative minigame controls, CPU fill, host transfer, and leaving a match. `node node_modules/typescript/bin/tsc --noEmit` checks types.

No installed dependencies, local room databases, session tokens, or generated server files are included in the source archive. Install dependencies after extracting. Keep `.openai/hosting.json` when continuing this same Site; it contains its non-secret Site identity. Hosted D1 migrations are in `drizzle/`; local initialization is in `scripts/local-schema.sql`.

| Change                                       | Main files                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| Prices, items, dice, symbols, alien defaults | game/config.ts                                                                    |
| Rules, events, bonuses, saves                | game/engine.ts                                                                    |
| Planets, routes, landmarks                   | game/boards.ts                                                                    |
| Menus, studio, room UI                       | game/Party.tsx, app/globals.css                                                   |
| Alien, UFO, finale                           | game/avatar.ts, game/Ufo.ts, game/Finale.ts                                       |
| Textures, scenery, orbit, effects            | game/Surfaces.ts, game/AlienScenery.ts, game/Planetarium.ts, game/BoardEffects.ts |
| Latest remade minigames                      | game/arcade/overhaul.ts, overhaul-renderer.ts, remix.ts, remix-renderer.ts        |
| Original 12 games                            | game/arcade/simulation.ts, expansion.ts, renderer.ts, expansion-renderer.ts       |
| Planet minigame styling                      | game/arcade/planet-style.ts                                                       |
| Controls and network prediction              | game/arcade/ArcadeGame.tsx                                                        |
| Sound effects                                | game/audio.ts                                                                     |
| Online room server                           | app/api/room/route.ts                                                             |

Stable shells/pearls fields and sp-* browser keys preserve saves. New loss/event counters start at zero for older saves; prior landing history cannot be reconstructed. An old in-progress redesigned minigame restarts at its new briefing while preserving board balances. Retired games remain internally readable for legacy in-progress games and results, but are absent from new ballots and the 28-game menu.

The default tests cover current rules, all active games, nine full matches, bonuses, migration and deterministic replay. tests/grand.test.ts and the earlier expansion documents preserve the historical 50-game specification; they are not the v0.7 roster or default suite.

The live frame-rate badge reports rendering health and can reduce detail under sustained load. Settings include Performance graphics, reduced motion and mute. Background throttling is distinguished from actual render overload.

[Current GDD](docs/GDD.md) · [v0.7 release notes](<docs/Party Planets Update.md>)

This is original procedural game code intended for continued editing. It includes no Nintendo characters, art, audio, maps or source code. Further hands-on balancing, bespoke production assets and internet latency testing remain useful work toward a larger production release.
